#!/usr/bin/env python3
"""Stream a read-only snapshot of collector logs into a local export file."""
import argparse
import gzip
import sqlite3
from contextlib import closing
from pathlib import Path

from server import export_chunks


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=Path(__file__).parent / "data" / "logs.sqlite3")
    parser.add_argument("--output", type=Path, required=True, help="New output file; use .gz for gzip compression.")
    parser.add_argument("--format", choices=("jsonl", "json", "rivals"), default="jsonl")
    parser.add_argument("--session", help="Optional session ID; otherwise export every user and session.")
    args = parser.parse_args()
    if not args.db.is_file():
        parser.error(f"Database does not exist: {args.db}")
    if args.db.resolve() == args.output.resolve():
        parser.error("Output must be a separate file from the database.")
    writer = gzip.open if args.output.suffix == ".gz" else open
    created = False
    try:
        # Read-only connection and WAL snapshot permit concurrent collector writes.
        with closing(sqlite3.connect(args.db.resolve().as_uri() + "?mode=ro", uri=True, timeout=10)) as db:
            db.execute("BEGIN")
            scope = " WHERE session_id=?" if args.session else ""
            params = (args.session,) if args.session else ()
            count, users, sessions = db.execute(
                "SELECT COUNT(*),COUNT(DISTINCT operator_id),COUNT(DISTINCT session_id) FROM events" + scope, params
            ).fetchone()
            with writer(args.output, "xt", encoding="utf-8") as output:
                created = True
                for chunk in export_chunks(db, args.session, args.format):
                    output.write(chunk)
        print(f"Exported {count:,} events from {users:,} users and {sessions:,} sessions to {args.output}")
    except (OSError, sqlite3.Error) as error:
        if created:
            args.output.unlink(missing_ok=True)
        parser.exit(1, f"Export failed: {error}\n")


if __name__ == "__main__":
    main()
