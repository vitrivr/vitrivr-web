"""Independent interaction-log collector. Python 3.11+, standard library only."""
from __future__ import annotations

import argparse
from contextlib import closing, contextmanager
from datetime import datetime, timezone
import hashlib
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import logging
import os
from pathlib import Path
import re
import socket
import sqlite3
import threading
from urllib.parse import parse_qs, unquote, urlsplit

PREFIX = "/api/interaction-logs"
MAX_BYTES = 128 * 1024 * 1024
LOG = logging.getLogger("interaction-logging")


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        self.status, self.message = status, message
        super().__init__(message)


def encoded(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(",", ":"))


def require(condition, message):
    if not condition:
        raise ApiError(400, message)


def integer(value, minimum=0):
    return type(value) is int and minimum <= value <= 2**63 - 1


def validate_batch(batch):
    require(isinstance(batch, dict), "Batch must be an object.")
    require(batch.get("format") == "vitrivr-interaction-batch", "Unsupported batch format.")
    require(type(batch.get("version")) is int and batch["version"] == 1, "Unsupported batch version.")
    require(isinstance(batch.get("batchId"), str) and 0 < len(batch["batchId"]) <= 256, "Invalid batchId.")
    require(integer(batch.get("createdAt")), "Invalid createdAt.")
    events = batch.get("events")
    require(isinstance(events, list) and 1 <= len(events) <= 128, "Batch must contain 1–128 events.")
    for event in events:
        require(isinstance(event, dict), "Event must be an object.")
        require(type(event.get("version")) is int and event["version"] == 1, "Unsupported event version.")
        for key in ("id", "sessionId", "pageId", "action", "category"):
            require(isinstance(event.get(key), str) and bool(event[key]), f"Invalid event {key}.")
        for key in ("id", "sessionId", "pageId"):
            require(len(event[key]) <= 256, f"Event {key} exceeds 256 characters.")
        require(integer(event.get("sequence"), 1), "Invalid sequence.")
        require(integer(event.get("timestamp")), "Invalid timestamp.")
        elapsed = event.get("elapsedMs")
        require(type(elapsed) in (int, float) and 0 <= elapsed < float("inf"), "Invalid elapsedMs.")
        for rank in ("frameRank", "videoRank"):
            require(rank not in event or integer(event[rank], 1), f"Invalid {rank}.")
        require("data" in event, "Missing event data.")
        context = event.get("context")
        require(isinstance(context, dict), "Invalid context.")
        for key in ("operatorId", "schema", "frontendView", "route"):
            require(isinstance(context.get(key), str), f"Invalid context {key}.")
        for key in ("taskId", "taskName", "evaluationId"):
            require(key in context and (context[key] is None or isinstance(context[key], str)), f"Invalid context {key}.")


class LogStore:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self.connect()) as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.executescript("""
                CREATE TABLE IF NOT EXISTS batches (
                    id TEXT PRIMARY KEY, digest TEXT NOT NULL, created_at INTEGER NOT NULL,
                    received_at TEXT NOT NULL, event_count INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS events (
                    id TEXT PRIMARY KEY, digest TEXT NOT NULL, session_id TEXT NOT NULL,
                    page_id TEXT NOT NULL, sequence INTEGER NOT NULL, timestamp INTEGER NOT NULL,
                    operator_id TEXT NOT NULL, evaluation_id TEXT, task_id TEXT,
                    category TEXT NOT NULL, action TEXT NOT NULL, body TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS events_session_order ON events(session_id,timestamp,page_id,sequence,id);
                CREATE INDEX IF NOT EXISTS events_operator ON events(operator_id,timestamp);
                CREATE INDEX IF NOT EXISTS events_task ON events(task_id,timestamp);
                CREATE INDEX IF NOT EXISTS events_evaluation ON events(evaluation_id,timestamp);
            """)

    def connect(self):
        db = sqlite3.connect(self.path, timeout=10, isolation_level=None)
        try:
            db.execute("PRAGMA synchronous=FULL")
            db.execute("PRAGMA busy_timeout=10000")
        except BaseException:
            db.close()
            raise
        return db

    def ingest(self, batch):
        return self.ingest_many([batch])[0]

    def ingest_many(self, batches):
        # All envelopes validate before taking the shared write lock.
        prepared = []
        for batch in batches:
            validate_batch(batch)
            digest = hashlib.sha256(encoded(batch).encode("utf-8")).hexdigest()
            rows = []
            for event in batch["events"]:
                body = encoded(event)
                ctx = event["context"]
                rows.append((event["id"], hashlib.sha256(body.encode("utf-8")).hexdigest(), event["sessionId"],
                    event["pageId"], event["sequence"], event["timestamp"], ctx["operatorId"], ctx["evaluationId"],
                    ctx["taskId"], event["category"], event["action"], body))
            prepared.append((batch, digest, rows))
        created = []
        with closing(self.connect()) as db:
            db.execute("BEGIN IMMEDIATE")
            try:
                for batch, digest, rows in prepared:
                    previous = db.execute("SELECT digest FROM batches WHERE id=?", (batch["batchId"],)).fetchone()
                    if previous:
                        if previous[0] != digest:
                            raise ApiError(409, "Batch ID already exists with different content.")
                        created.append(False)
                        continue
                    for row in rows:
                        previous = db.execute("SELECT digest FROM events WHERE id=?", (row[0],)).fetchone()
                        if previous and previous[0] != row[1]:
                            raise ApiError(409, "Event ID already exists with different content.")
                        if not previous:
                            db.execute("INSERT INTO events VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", row)
                    db.execute("INSERT INTO batches VALUES (?,?,?,?,?)", (batch["batchId"], digest, batch["createdAt"],
                        datetime.now(timezone.utc).isoformat(), len(rows)))
                    created.append(True)
                db.commit()  # Acknowledge only after every batch durably commits.
                return created
            except BaseException:
                db.rollback()
                raise

    @contextmanager
    def session(self, session_id):
        with closing(self.connect()) as db:
            db.execute("BEGIN")  # One consistent export snapshot, while WAL allows ingestion.
            if not db.execute("SELECT 1 FROM events WHERE session_id=? LIMIT 1", (session_id,)).fetchone():
                raise ApiError(404, "Session not found.")
            try:
                yield db
            finally:
                db.rollback()

    @staticmethod
    def bodies(db, session_id, operator=None):
        query = "SELECT body FROM events WHERE 1=1"
        params = []
        if session_id is not None:
            query += " AND session_id=?"
            params.append(session_id)
        if operator is not None:
            query += " AND operator_id=?"
            params.append(operator)
        query += " ORDER BY timestamp,page_id,sequence,id"
        for row in db.execute(query, params):
            yield row[0]


def export_chunks(db, session_id, format):
    if format == "jsonl":
        for body in LogStore.bodies(db, session_id):
            yield body + "\n"
        return
    if format == "json":
        sessions = [session_id] if session_id is not None else [row[0] for row in db.execute("SELECT DISTINCT session_id FROM events ORDER BY session_id")]
        header = {"format": "vitrivr-interaction-log", "version": 1, "exportedAt": datetime.now(timezone.utc).isoformat(), "sessions": sessions}
        yield encoded(header)[:-1] + ',"events":['
        for i, body in enumerate(LogStore.bodies(db, session_id)):
            yield ("," if i else "") + body
        yield "]}"
        return
    categories = {}
    operators = {}
    # Two streaming passes retain only hierarchy/operator names, not event payloads.
    scope = " WHERE session_id=?" if session_id is not None else ""
    params = (session_id,) if session_id is not None else ()
    for category, action, operator in db.execute("SELECT category,action,operator_id FROM events" + scope + " ORDER BY timestamp,page_id,sequence,id", params):
        categories.setdefault(category, set()).add(action)
        operators.setdefault(operator, None)
    hierarchy = [{"Name": name, "Visualize": True, "Children": [
        {"Name": action, "Visualize": False, "Children": []} for action in sorted(actions)]} for name, actions in categories.items()]
    yield '{"interaction_logs":[{"Name":"vitrivr-web","Hierarchy":' + encoded(hierarchy) + ',"Logs":{'
    for index, operator in enumerate(operators):
        yield ("," if index else "") + encoded(operator) + ":["
        for i, body in enumerate(LogStore.bodies(db, session_id, operator)):
            event = json.loads(body)
            entry = {"timestamp": event["timestamp"], "action": event["action"], "frameRank": event.get("frameRank"), "videoRank": event.get("videoRank"),
                "metadata": {"eventId": event["id"], "sessionId": event["sessionId"], "pageId": event["pageId"], "sequence": event["sequence"],
                    "elapsedMs": event["elapsedMs"], **event["context"], "data": event["data"]}}
            yield ("," if i else "") + encoded(entry)
        yield "]"
    yield "}}]}"


def parse_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, "Duplicate JSON object key.")
            result[key] = value
        return result
    def invalid(_value):
        raise ApiError(400, "Non-finite JSON number.")
    try:
        return json.loads(raw, object_pairs_hook=pairs, parse_constant=invalid)
    except (ValueError, UnicodeError, RecursionError) as error:
        raise ApiError(400, "Invalid JSON.") from error


class LogServer(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 128

    def __init__(self, address, store, origins, token="", max_bytes=MAX_BYTES, max_clients=16):
        self.store, self.origins, self.token, self.max_bytes = store, frozenset(origins), token, max_bytes
        self.slots = threading.BoundedSemaphore(max_clients)
        super().__init__(address, Handler)

    def process_request(self, request, address):
        if not self.slots.acquire(blocking=False):
            request.settimeout(1)
            try:
                request.sendall(b"HTTP/1.0 503 Service Unavailable\r\nConnection: close\r\nContent-Length: 0\r\n\r\n")
            except OSError:
                pass
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, address)
        except BaseException:
            self.slots.release()
            raise

    def process_request_thread(self, request, address):
        try:
            super().process_request_thread(request, address)
        finally:
            self.slots.release()


class Handler(BaseHTTPRequestHandler):
    server_version = "InteractionLogs/1"

    def setup(self):
        super().setup()
        self.connection.settimeout(20)

    def log_message(self, format, *args):
        LOG.info("%s %s", self.client_address[0], format % args)

    def end_headers(self):
        origin = self.headers.get("Origin")
        self.send_header("Vary", "Origin")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if "*" in self.server.origins:
            self.send_header("Access-Control-Allow-Origin", "*")
        elif origin in self.server.origins:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Expose-Headers", "X-Log-Event-Count")
        super().end_headers()

    def json(self, status, body):
        data = encoded(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def authorize(self):
        origin = self.headers.get("Origin")
        if origin and "*" not in self.server.origins and origin not in self.server.origins:
            raise ApiError(403, "Origin is not allowed.")
        if self.server.token and not hmac.compare_digest(self.headers.get("Authorization", "").encode("utf-8"), ("Bearer " + self.server.token).encode("utf-8")):
            raise ApiError(401, "Logging-service authentication required.")

    def dispatch(self, method):
        self.response_started = False
        try:
            self.authorize()
            method()
        except ApiError as error:
            self.json(error.status, {"error": error.message})
        except (sqlite3.Error, OSError) as error:
            if isinstance(error, (BrokenPipeError, ConnectionResetError, socket.timeout)):
                return
            LOG.exception("Log storage unavailable")
            if not self.response_started:
                self.json(503, {"error": "Log storage unavailable; retain and retry the batch."})
        except (ValueError, UnicodeError, RecursionError, OverflowError):
            self.json(400, {"error": "Invalid request encoding or value."})

    def do_OPTIONS(self):
        origin = self.headers.get("Origin")
        if not origin or ("*" not in self.server.origins and origin not in self.server.origins):
            self.json(403, {"error": "Origin is not allowed."})
            return
        if self.headers.get("Access-Control-Request-Method") not in ("GET", "POST"):
            self.json(405, {"error": "Method not allowed."})
            return
        requested = {header.strip().lower() for header in self.headers.get("Access-Control-Request-Headers", "").split(",") if header.strip()}
        if not requested <= {"content-type", "authorization"}:
            self.json(403, {"error": "Header is not allowed."})
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def do_POST(self):
        self.dispatch(self.ingest)

    def ingest(self):
        path = urlsplit(self.path).path
        if path not in (PREFIX + "/batches", PREFIX + "/batches/bulk"):
            raise ApiError(404, "Endpoint not found.")
        if self.headers.get_content_type() != "application/json":
            raise ApiError(415, "Content-Type must be application/json.")
        if self.headers.get("Transfer-Encoding") or len(self.headers.get_all("Content-Length", [])) != 1:
            raise ApiError(411, "One Content-Length is required.")
        try:
            length = int(self.headers["Content-Length"])
        except ValueError as error:
            raise ApiError(400, "Invalid Content-Length.") from error
        if length <= 0:
            raise ApiError(400, "Empty request.")
        if length > self.server.max_bytes:
            raise ApiError(413, "Batch exceeds request limit.")
        raw = self.rfile.read(length)
        require(len(raw) == length, "Incomplete request body.")
        batch = parse_json(raw)
        if path.endswith("/bulk"):
            require(isinstance(batch, dict) and batch.get("format") == "vitrivr-interaction-batches" and type(batch.get("version")) is int and batch["version"] == 1, "Invalid bulk envelope.")
            batches = batch.get("batches")
            require(isinstance(batches, list) and 1 <= len(batches) <= 16, "Bulk upload must contain 1–16 batches.")
            created = self.server.store.ingest_many(batches)
            self.json(201 if any(created) else 200, {"batchIds": [item["batchId"] for item in batches], "accepted": True})
        else:
            created = self.server.store.ingest(batch)
            self.json(201 if created else 200, {"batchId": batch["batchId"], "accepted": True})

    def do_GET(self):
        self.dispatch(self.download)

    def download(self):
        url = urlsplit(self.path)
        if url.path == PREFIX + "/health":
            with closing(self.server.store.connect()) as db:
                db.execute("SELECT 1").fetchone()
            self.json(200, {"status": "ok"})
            return
        match = re.fullmatch(re.escape(PREFIX) + r"/sessions/([^/]+)/export", url.path)
        if not match:
            raise ApiError(404, "Endpoint not found.")
        session_id = unquote(match[1])
        format = parse_qs(url.query).get("format", ["jsonl"])[0]
        if format not in ("jsonl", "json", "rivals"):
            raise ApiError(400, "Unsupported export format.")
        with self.server.store.session(session_id) as db:
            count = db.execute("SELECT count(*) FROM events WHERE session_id=?", (session_id,)).fetchone()[0]
            self.send_response(200)
            self.send_header("X-Log-Event-Count", str(count))
            self.response_started = True
            self.send_header("Content-Type", "application/x-ndjson" if format == "jsonl" else "application/json")
            # Fixed safe filename; session IDs cannot inject response headers.
            self.send_header("Content-Disposition", 'attachment; filename="vitrivr-session.' + ("jsonl" if format == "jsonl" else "json") + '"')
            self.end_headers()
            for chunk in export_chunks(db, session_id, format):
                self.wfile.write(chunk.encode("utf-8"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=9092)
    parser.add_argument("--db", type=Path, default=Path(__file__).parent / "data" / "logs.sqlite3")
    parser.add_argument("--allow-origin", action="append", default=None,
        help="Allowed frontend origin; repeat for several origins, or use '*' for all origins without cross-origin cookies.")
    parser.add_argument("--max-clients", type=int, default=16)
    args = parser.parse_args()
    if args.max_clients < 1:
        parser.error("--max-clients must be positive")
    origins = args.allow_origin or ["http://localhost:5173", "http://127.0.0.1:5173"]
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    server = LogServer((args.host, args.port), LogStore(args.db), origins, os.environ.get("LOGGING_BEARER_TOKEN", ""), max_clients=args.max_clients)
    LOG.info("Listening on http://%s:%s%s; database %s", args.host, server.server_port, PREFIX, args.db)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
