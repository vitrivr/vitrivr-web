"use client";
import {useLocation, useNavigate, useParams} from "react-router-dom";
import {thumbnailURL, videoURL} from "../../lib/vitrivr.ts";
import {useSearch} from "../../state/SearchContext.tsx";
import {useEffect, useRef, useState} from "react";
import {useAuth} from "../../state/AuthContext.tsx";
import {submitVideo, submitText} from "../../dres/generated/api/dresSubmit.ts";
import {getCurrentSubmissionKind} from "../../dres/generated/api/taskTypeHelper.ts";
import NearestNeighbor from "./NearestNeighbor.tsx";
import POVs from "./POVs.tsx";
import {getHourFromFilename, parseVideoURL} from "./VideoHourUtils.ts";
import HourGallery from "./HourGallery.tsx";
import {generateVideoThumbnail} from "./ThumbnailUtils.ts";
import {requestCLIPVector} from "../../lib/pythonDescriptorServer.ts";
import HlsVideoPlayer from "./HLSVideoPlayer.tsx";

/**
 * VideoPage component that appear as soon a result is clicked. This component allows for watching the video, looking
 * at similar results (Nearest Neighbor Search) and watching the videos which were captured during the same time
 * and day.
 * @constructor
 */
export default function VideoPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const {id} = useParams<{ id: string }>();
    const videoRef = useRef<HTMLVideoElement | null>(null);

    // DRES Info
    const {session, openLogin} = useAuth();
    const {evaluationId} = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [searching, setSearching] = useState(false);
    const [nnVector, setNnVector] = useState<number[] | null>(null);
    const [, setHasNeighbors] = useState(false);

    const routeState = location.state as
        | {
        src?: string;
        poster?: string;
        start?: number;
        end?: number;
        mediaItemName?: string;
        sourcePath?: string;
        parentId?: string;
    }
        | null;

    const {items} = useSearch();
    const item = items.find((it) => it.id === id);
    const mediaItemName = item?.mediaItemName ?? routeState?.mediaItemName;
    const src = item?.url ?? routeState?.src ?? "";
    const start =
        typeof item?.start === "number" ? item.start : typeof routeState?.start === "number" ? routeState.start : 0;

    const mp4Location = mediaItemName ? videoURL(mediaItemName): "";

    /*
     * HLS URLs cannot be manipulated by getVideoAtOffset().
     */
    const activeVideoSrc = src;

    console.log("[VideoPage]", {
        segmentId: id,
        item,
        mediaItemName,
        mp4Location,
        hlsSrc: src,
    });

    const [kind, setKind] = useState<"text" | "item" | "temporal" | "unknown">("unknown");
    const [textAnswer, setTextAnswer] = useState("");
    const poster = id ? thumbnailURL(id) ?? "" : "";
    const [hourOffset, setHourOffset] = useState(0);
    console.log("Item media name is: "+item?.mediaItemName)

    useEffect(() => {
        setHourOffset(0);
    }, [src]);

    const activeInfo = parseVideoURL(activeVideoSrc);
    const activeHour = activeInfo ? getHourFromFilename(activeInfo.filename) : null;
    const timeOfRecording = activeHour !== null ? String(activeHour).padStart(2, "0") : "";
    const [playbackTimestamp, setPlaybackTimestamp] = useState(start);

    /*
     * Move the whole 3-video window, when arrow is clicked
     */
    const goPreviousHour = () => {
        setHourOffset((current) =>
            current - 1
        );
    };

    const goNextHour = () => {
        setHourOffset((current) =>
            current + 1
        );
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

    /**
     * Is called whenever a nearest neighbor search is prompted.
     */
    const onSearch = async (): Promise<void> => {
        const video = videoRef.current;

        if (!video) {
            console.error("Video element is not available.");
            return;
        }

        if (!mp4Location) {
            console.error("Cannot perform NN search: original MP4 URL is missing.", {item, mediaItemName});
            return;
        }

        setSearching(true);

        try {
            video.pause();
            const currentTimestamp = video.currentTime;
            const thumbnail = await generateVideoThumbnail(mp4Location, currentTimestamp);
            if (!thumbnail) {
                throw new Error("Could not generate thumbnail.");
            }
            const clipVector = await requestCLIPVector(thumbnail);

            if (!clipVector?.length) {
                throw new Error("Could not generate CLIP vector.");
            }
            setNnVector(clipVector);
        } catch (error) {
            console.error("Nearest-neighbor search failed:", error);
        } finally {
            setSearching(false);
        }
    };


    /**
     * For submitting a video to DRES.
     */
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

                <h2 style={{margin: 0, fontSize: 18, fontWeight: 600}}>Video: {item?.mediaItemName}</h2>
            </header>

            <main
                style={{
                    display: "grid",
                    gap: 16,
                    alignItems: "start",
                }}
            >
                {/* Hour navigation */}
                <div
                    style={{
                        width: "100%",
                        maxWidth: 1400,
                        margin: "0 auto",
                        display: "grid",
                        gridTemplateColumns: "minmax(180px, 1fr) minmax(0, 3fr) minmax(180px, 1fr)",
                        gap: 16,
                        alignItems: "center",
                    }}
                >
                    {/* Previous hour */}
                    <HourGallery
                        src={mp4Location}
                        direction="previous"
                        offset={hourOffset}
                        onPrevious={goPreviousHour}
                        onNext={goNextHour}
                    />

                    {/* center video */}
                    <div
                        style={{
                            minWidth: 0,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "center",
                                marginBottom: 8,
                            }}
                        >
                            <strong style={{fontSize: 13,}}>
                                {timeOfRecording ? `${timeOfRecording}:00` : "Current"}
                            </strong>
                        </div>
                        <HlsVideoPlayer
                            key={activeVideoSrc}
                            ref={videoRef}
                            src={activeVideoSrc}
                            poster={hourOffset === 0 ? poster : undefined}
                            startTime={hourOffset === 0 ? start : 0}
                            onTimeUpdate={setPlaybackTimestamp}
                            preload="metadata"
                        />

                        <button
                            type="button"
                            onClick={onSearch}
                            disabled={searching}
                            style={{
                                border: "1px solid #ddd",
                                borderRadius: 10,
                                padding: "8px 16px",
                                background: "#A5A8F0",
                                cursor: searching ? "not-allowed" : "pointer",
                                fontWeight: 600,
                            }}
                        >
                            {searching ? "Searching NN…" : "Search NN"}
                        </button>

                        {/* Submission controls */}
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                alignItems: "center",
                                gap: 10,
                                marginTop: 10,
                            }}
                        >
                            {kind === "text" && (
                                <input
                                    value={textAnswer}
                                    onChange={(e) => setTextAnswer(e.target.value)}
                                    placeholder="Type answer (DRES)…"
                                    style={{
                                        width: 260,
                                        maxWidth: "60%",
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
                                    padding: "8px 16px",
                                    background: "#FF00FF",
                                    cursor: submitting ? "not-allowed" : "pointer",
                                    fontWeight: 600,
                                }}
                            >
                                {submitting ? "Submitting…" : "Submit"}
                            </button>
                        </div>
                    </div>

                    {/* Next hour */}
                    <HourGallery
                        src={mp4Location}
                        direction="next"
                        offset={hourOffset}
                        onPrevious={goPreviousHour}
                        onNext={goNextHour}
                    />
                </div>
                <POVs src={activeVideoSrc} timestamp={playbackTimestamp} />
                <NearestNeighbor id={id} queryVector={nnVector} onResultsChange={setHasNeighbors}/>
            </main>
        </div>
    );
}