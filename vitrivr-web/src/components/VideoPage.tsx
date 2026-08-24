/**
 * VideoPage
 *
 * A detail page for viewing a selected video segment, submitting results to DRES,
 * and exploring visually similar neighbor segments.
 *
 * Features:
 * - Plays the selected video segment
 * - Restores the segment start time when metadata is loaded
 * - Supports DRES submission for text and item tasks
 * - Loads nearest-neighbor video results from the current clip vector
 * - Lets the user open neighbor results as new video pages
 * - Integrates with search, auth, and evaluation state
 *
 * Behavior:
 * - Reads the selected video `id` from the route
 * - Looks up the current item from search state
 * - Detects the active DRES submission mode (`text`, `item`, etc.)
 * - For text tasks, submits the entered text answer
 * - For item tasks, submits the current playback timestamp
 * - If a clip vector is available, runs a vector search to load nearest neighbors
 * - Stores discovered neighbor vectors back into shared state for later navigation
 *
 * Main helpers:
 * @param pickNumber - Reads numeric descriptor values safely
 * @param nsToSecondsMaybe - Converts nanoseconds to seconds
 * @param basenameFromPath - Extracts the filename from a path
 * @param toServedVideoUrl - Builds a playable served video URL
 * @param pickFloatArray - Reads numeric vector descriptors safely
 * @param videoNameFromUrl - Derives a display name from a video URL
 * @param mapNeighbors - Maps retrieval results into video neighbor items
 *
 * Example route:
 * /video/:id
 *
 * Notes:
 * - Neighbor search depends on `vectorsById[id]` being available
 * - Only video-type neighbors are shown
 * - If no clip vector exists, neighbor loading is skipped with an error message
 * - The component expects surrounding providers such as `SearchContext` and `AuthContext`
 */


"use client";
import {useLocation, useNavigate, useParams} from "react-router-dom";
import {thumbnailUrl, buildVectorQuery, servedVideoUrl} from "../lib/vitrivr";
import {useSearch} from "../state/SearchContext";
import {useEffect, useMemo, useRef, useState} from "react";
import {useAuth} from "../state/AuthContext";
import {submitVideo, submitText} from "../dres/generated/api/dresSubmit";
import {getCurrentSubmissionKind} from "../dres/generated/api/taskTypeHelper";
import ResultItem from "../components/Results/ResultItem";
import {retrieval} from "../vitirvr/api/client";

type MediaKind = "image" | "video" | "custom";

/**
 * All the people contained in the CASTLE dataset 2024
 */
const PEOPLE = ["Allie", "Bao", "Bjorn", "Cathal", "Florian", "Kitchen", "Klaus", "Living1", "Living2", "Luca",
    "Meeting", "Onanong", "Reading", "Stevan", "Tien", "Werner"];

type MediaItem = {
    id: string;
    kind: MediaKind;
    url: string;
    name: string;
    thumbUrl?: string;
    start: number;
    end: number;
    rawType?: string;
    clipVector?: number[];
};

type RetrievablesResponse = {
    retrievables?: Array<{
        id?: string;
        type?: string;
        score?: number;
        relationship?: {
            partOf?: {
                descriptors?: Record<string, unknown>;
            };
        };
        descriptors?: Record<string, unknown>;
    }>;
};

type HourlyVideo = {
    person: string;
    url: string;
};

/**
 * Checks whether a video exists for the url.
 */
function videoExists(url: string): Promise<boolean> {
    return new Promise((resolve) => {
        const video = document.createElement("video");

        const cleanup = () => {
            video.removeAttribute("src");
            video.load();
        };

        video.preload = "metadata";

        video.onloadedmetadata = () => {
            cleanup();
            resolve(true);
        };

        video.onerror = () => {
            cleanup();
            resolve(false);
        };
        video.src = url;
    });
}

/**
 * Runs async checks with a concurrency limit s.t. we don't fire too many requests at the video server.
 */
async function filterExistingVideos(
    videos: HourlyVideo[],
    concurrency = 4
): Promise<HourlyVideo[]> {
    const existing: HourlyVideo[] = [];
    let index = 0;

    async function worker() {
        while (true) {
            const currentIndex = index++;
            if (currentIndex >= videos.length) return;

            const video = videos[currentIndex];

            if (await videoExists(video.url)) {
                existing.push(video);
            }
        }
    }

    await Promise.all(
        Array.from(
            {length: Math.min(concurrency, videos.length)},
            () => worker()
        )
    );

    return videos.filter((video) => existing.some((existingVideo) => existingVideo.url === video.url));
}

/**
 * Function that parses the URL of the video to extract the day, person and filename from the path.
 * Mainly used for displaying the videos from the same time, date but different person.
 * @param url
 */
function parseVideoURL(url: string) {
    if (!url) {
        console.log("No URL was given. ")
    } else {
        try {
            const parsed = new URL(url);
            // TODO: adjust this to the actual schema of the filename. not all filenames contain "videos"
            // the expected format is like this: http://10.34.64.212:8080/videos/day4/Luca/video/08.mp4
            const match = parsed.pathname.match(/^\/videos\/([^/]+)\/([^/]+)\/video\/([^/]+)$/);
            if (!match) {
                return null;
            }
            return {origin: parsed.origin, day: match[1], person: match[2], filename: match[3]};
        } catch {
            return null;
        }
    }
}

function pickNumber(r: { descriptors?: Record<string, unknown> }, key: string): number | undefined {
    const v = r.descriptors?.[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
        const n = Number(v.trim());
        return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
}

function nsToSecondsMaybe(x: number): number {
    return x / 1_000_000_000;
}

function basenameFromPath(p: string): string {
    const unixy = p.replace(/\\/g, "/");
    const parts = unixy.split("/");
    return parts[parts.length - 1] ?? "";
}

function toServedVideoUrl(schema: string, filePath: string): string {
    const origin = import.meta.env.VITE_MEDIA_ORIGIN || "";
    if (!origin) return "";
    const filename = basenameFromPath(filePath);
    if (!filename) return "";
    return servedVideoUrl(schema, filePath);
}

function pickFloatArray(
    r: { descriptors?: Record<string, unknown> },
    key: string
): number[] | undefined {
    const v = r.descriptors?.[key];

    if (!Array.isArray(v)) return undefined;

    const out: number[] = [];
    for (const x of v) {
        if (typeof x !== "number" || !Number.isFinite(x)) return undefined;
        out.push(x);
    }
    return out;
}

function videoNameFromUrl(url: string): string {
    try {
        const u = new URL(url);
        const base = u.pathname.split("/").pop() ?? "";
        return base.replace(/\.[^.]+$/, "");
    } catch {
        const base = (url ?? "").split("?")[0].split("#")[0].split("/").pop() ?? "";
        return base.replace(/\.[^.]+$/, "");
    }
}


function mapNeighbors(schema: string, resp: RetrievablesResponse): MediaItem[] {
    const list = resp.retrievables ?? [];
    const out: MediaItem[] = [];

    for (const r of list) {
        const id = r.id?.trim();
        const clipVector = pickFloatArray(r, "clip.vector");
        if (!id) continue;

        const kind: MediaKind = r.type === "SEGMENT" ? "video" : "custom";
        if (kind !== "video") continue;

        const filePath =
            (r.descriptors?.["file.path"] as string | undefined) ||
            (r.relationship?.partOf?.descriptors?.["file.path"] as string | undefined);

        if (!filePath) continue;

        const startNs = pickNumber(r, "time.start") ?? 0;
        const endNs = pickNumber(r, "time.end") ?? 0;

        const start = nsToSecondsMaybe(startNs);
        const end = nsToSecondsMaybe(endNs);


        const url = toServedVideoUrl(schema, filePath);
        if (!url) continue;

        out.push({
            id,
            kind: "video",
            url,
            name: videoNameFromUrl(url),
            thumbUrl: thumbnailUrl(schema, id),
            start,
            end,
            rawType: r.type,
            clipVector
        });
    }

    return out;
}

export default function VideoPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const {id} = useParams<{ id: string }>();
    const videoRef = useRef<HTMLVideoElement | null>(null);

    const routeState = location.state as | { src?: string; poster?: string; start?: number; end?: number; } | null;

    const {items, schema, setVectorsById, vectorsById, setItems} = useSearch();
    const item = items.find((it) => it.id === id);

    const {session, openLogin} = useAuth();
    const {evaluationId} = useAuth();

    const [submitting, setSubmitting] = useState(false);
    const [kind, setKind] = useState<"text" | "item" | "temporal" | "unknown">("unknown");
    const [textAnswer, setTextAnswer] = useState("");

    const [neighbors, setNeighbors] = useState<MediaItem[]>([]);
    const [neighborsLoading, setNeighborsLoading] = useState(false);
    const [neighborsError, setNeighborsError] = useState<string | null>(null);

    const poster = id ? thumbnailUrl(schema, id) ?? "" : "";
    const src = item?.url ?? routeState?.src ?? "";
    const start = typeof item?.start === "number" ? item.start : typeof routeState?.start === "number" ? routeState.start : 0;
    const dayOfRecording = src.split("/")[4];
    const timeOfRecoding = src.split("/")[7].split(".")[0];
    const nameOfPersonRecording = src.split("/")[5];
    const [sameHourVideos, setSameHourVideos] = useState<HourlyVideo[]>([]);
    const [sameHourLoading, setSameHourLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function loadSameHourVideos() {
            const info = parseVideoURL(src);

            if (!info) {
                setSameHourVideos([]);
                return;
            }

            const candidates: HourlyVideo[] = PEOPLE
                .filter((person) => person !== info.person)
                .map((person) => ({
                    person,
                    url:
                        `${info.origin}/videos/` +
                        `${encodeURIComponent(info.day)}/` +
                        `${encodeURIComponent(person)}/video/` +
                        `${encodeURIComponent(info.filename)}`,
                }));

            setSameHourLoading(true);

            try {
                const existing = await filterExistingVideos(candidates, 4);

                if (!cancelled) {
                    setSameHourVideos(existing);
                }
            } finally {
                if (!cancelled) {
                    setSameHourLoading(false);
                }
            }
        }

        loadSameHourVideos();

        return () => {
            cancelled = true;
        };
    }, [src]);

    const currentVector = useMemo(() => {
        if (!id) return undefined;
        return vectorsById?.[id];
    }, [id, vectorsById]);


    const openNeighbor = (n: MediaItem) => {
        if (n.clipVector && n.clipVector.length > 0) {
            setVectorsById((prev) => ({...prev, [n.id]: n.clipVector!}));
        }

        setItems((prev) => {
            if (prev.some((x) => x.id === n.id)) return prev;
            return [...prev, n];
        });

        navigate(`/video/${encodeURIComponent(n.id)}`);
    };


    useEffect(() => {
        let cancelled = false;

        async function loadKind() {
            if (!session || !evaluationId) {
                setKind("unknown");
                return;
            }
            try {
                const k = await getCurrentSubmissionKind({session, evaluationId});
                if (!cancelled) setKind(k);
            } catch {
                if (!cancelled) setKind("unknown");
            }
        }

        loadKind();
        return () => {
            cancelled = true;
        };
    }, [session, evaluationId]);

    useEffect(() => {
        window.scrollTo({top: 0, left: 0, behavior: "instant" as ScrollBehavior});
    }, [id]);


    useEffect(() => {
        let cancelled = false;

        async function loadNeighbors() {
            if (!id) return;
            if (!currentVector || currentVector.length === 0) {
                setNeighbors([]);
                setNeighborsError("No clip.vector found for this segment (did you store vectorsById during search?).");
                return;
            }

            setNeighborsLoading(true);
            setNeighborsError(null);

            try {
                const body = buildVectorQuery(currentVector, 1000);
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                const resp = await retrieval.postExecuteQuery(schema, body);

                if (cancelled) return;

                const mapped = mapNeighbors(schema, resp as RetrievablesResponse)
                    .filter((m) => m.id !== id);

                setVectorsById((prev) => {
                    const next = {...prev};
                    for (const m of mapped) {
                        if (m.clipVector && m.clipVector.length > 0) {
                            next[m.id] = m.clipVector;
                        }
                    }
                    return next;
                });

                setNeighbors(mapped);
            } catch (e: any) {
                if (!cancelled) setNeighborsError(e?.message ?? String(e));
            } finally {
                if (!cancelled) setNeighborsLoading(false);
            }
        }

        loadNeighbors();
        return () => {
            cancelled = true;
        };
    }, [id, schema, currentVector]);

    const onSubmit = async () => {
        if (!session) {
            openLogin();
            return;
        }
        if (!evaluationId) {
            openLogin();
            return;
        }

        const k = await getCurrentSubmissionKind({session, evaluationId});

        if (k === "text") {
            const text = textAnswer.trim();
            if (!text) {
                alert("Please enter a text answer.");
                return;
            }
            setSubmitting(true);
            try {
                const res = await submitText({session, evaluationId, text});
                console.log("Submitted text", text)
                alert("Submitted! " + JSON.stringify(res.data.submission));
                console.log("DRES submitText response:", res.data.submission);
                setTextAnswer("");
            } catch (err: any) {
                alert(err?.response?.data?.description ?? err?.message ?? "Submit failed.");
            } finally {
                setSubmitting(false);
            }
            return;
        }

        if (k === "item") {
            const video = videoRef.current;
            const tSec = video?.currentTime ?? start;
            const tMs = Number.isFinite(tSec) ? Math.round(tSec * 1000) : undefined;
            const splitLen = src.split("/").length;
            const videoName = src.split("/")[splitLen - 1].split(".")[0];
            setSubmitting(true);
            try {
                const res = await submitVideo({
                    session,
                    mediaItemName: videoName,
                    evaluationId,
                    start: tMs,
                    end: tMs,
                });
                console.log("Submission", videoName, tMs, tMs)
                alert("Submitted! " + JSON.stringify(res.data.submission));
                setTextAnswer("");
            } catch (err: any) {
                alert(err?.response?.data?.description ?? err?.message ?? "Submit failed.");
            } finally {
                setSubmitting(false);
            }
        }

    };

    if (!id) {
        return (
            <div style={{padding: 16}}>
                <button onClick={() => navigate(-1)} aria-label="Back">
                    ← Back
                </button>
                <p>Missing video id.</p>
            </div>
        );
    }

    return (
        <div style={{padding: 16, display: "grid", gap: 16}}>
            <header style={{display: "flex", alignItems: "center", gap: 12}}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        border: "1px solid #ddd",
                        borderRadius: 8,
                        background: "#fff",
                        padding: "6px 10px",
                        cursor: "pointer",
                    }}
                >
                    ← Back
                </button>

                <button
                    onClick={() => navigate("/")}
                    style={{
                        border: "1px solid #ddd",
                        borderRadius: 8,
                        background: "#fff",
                        padding: "6px 10px",
                        cursor: "pointer",
                    }}
                    title="Go to search"
                >
                    🏠 Home
                </button>

                <h2 style={{margin: 0, fontSize: 18, fontWeight: 600}}>Video: {dayOfRecording}/{nameOfPersonRecording}/{timeOfRecoding}</h2>

                <div style={{marginLeft: "auto", display: "flex", gap: 10, alignItems: "center"}}>
                    {kind === "text" && (
                        <input
                            value={textAnswer}
                            onChange={(e) => setTextAnswer(e.target.value)}
                            placeholder="Type answer (DRES)…"
                            style={{
                                width: 260,
                                maxWidth: "50vw",
                                border: "1px solid #ddd",
                                borderRadius: 10,
                                padding: "8px 10px",
                                background: "#fff",
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") onSubmit();
                            }}
                        />
                    )}

                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={submitting}
                        style={{
                            border: "1px solid #ddd",
                            borderRadius: 10,
                            padding: "8px 12px",
                            background: "#FF00FF",
                            cursor: "pointer",
                        }}
                    >
                        {submitting ? "Submitting…" : "Submit"}
                    </button>
                </div>
            </header>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 3fr) minmax(260px, 1fr)",
                    gap: 16,
                    alignItems: "start",
                }}
            >
                {/* Main video */}
                <video
                    key={id}
                    ref={videoRef}
                    src={src}
                    poster={poster}
                    controls
                    preload="metadata"
                    onLoadedMetadata={(e) => {
                        const video = e.currentTarget;

                        // console.log("Video start:", start);
                        // console.log("Video duration:", video.duration);

                        if (Number.isFinite(start) && start > 0) {
                            video.currentTime = Math.min(start, video.duration);
                        }
                    }}
                    style={{
                        width: "100%",
                        borderRadius: 12,
                        background: "#000",
                    }}
                />

                {/* Same hour, different people */}
                <aside
                    style={{
                        display: "grid",
                        gap: 12,
                        maxHeight: "75vh",
                        overflowY: "auto",
                        paddingRight: 4,
                    }}
                >
                    <h3
                        style={{
                            margin: 0,
                            fontSize: 14,
                            fontWeight: 600,
                        }}
                    >
                        Other POVs for {dayOfRecording} at {timeOfRecoding}:00
                    </h3>

                    {sameHourLoading && (
                        <div style={{opacity: 0.7, fontSize: 13}}>
                            Loading hourly videos…
                        </div>
                    )}
                    {!sameHourLoading && sameHourVideos.length === 0 && (
                        <div style={{opacity: 0.7, fontSize: 13}}>
                            No other videos available.
                        </div>
                    )}

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                            gap: 10,
                        }}
                    >
                        {sameHourVideos.map(({person, url}) => (
                            <div
                                key={url}
                                style={{
                                    minWidth: 0,
                                    display: "grid",
                                    gap: 5,
                                }}
                            >
                                <video
                                    src={url}
                                    controls
                                    preload="none"
                                    style={{
                                        display: "block",
                                        width: "100%",
                                        aspectRatio: "16 / 9",
                                        objectFit: "contain",
                                        borderRadius: 8,
                                        background: "#000",
                                    }}
                                />

                                <div
                                    style={{
                                        fontSize: 12,
                                        fontWeight: 500,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                    title={person}
                                >
                                    {person}
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>
            </div>

            <section style={{display: "grid", gap: 10}}>
                <h3 style={{margin: 0, fontSize: 14, fontWeight: 600}}>Nearest neighbors</h3>

                {neighborsLoading && <div style={{opacity: 0.8}}>Loading neighbors…</div>}
                {neighborsError && <div style={{color: "#b00020"}}>{neighborsError}</div>}

                {!neighborsLoading && !neighborsError && neighbors.length === 0 && (
                    <div style={{opacity: 0.7}}>No neighbors found.</div>
                )}

                {neighbors.length > 0 && (
                    <div className="results-grid">
                        {neighbors.map((n) => (
                            <ResultItem
                                key={n.id}
                                id={n.id}
                                kind="video"
                                start={n.start}
                                end={n.end}
                                preload="none"
                                controls={false}
                                mediaClassName="ri-media"
                                getPosterSrc={() => n.thumbUrl ?? ""}
                                getVideoSrc={() => n.url}
                                caption={n.name}
                                onBeforeOpen={() => openNeighbor(n)}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}