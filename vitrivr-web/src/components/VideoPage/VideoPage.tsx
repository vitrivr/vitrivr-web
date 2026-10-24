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
import {getHourFromFilename, getVideoAtOffset, getPlaybackSource, parseVideoURL} from "./VideoHourUtils.ts";
import HourGallery from "./HourGallery.tsx";
import {generateVideoThumbnail} from "./ThumbnailUtils.ts";
import {requestCLIPVector} from "../../lib/pythonDescriptorServer.ts";
import HlsVideoPlayer from "./HLSVideoPlayer.tsx";
import "./VideoPage.css";

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
    const hourlySrc = mp4Location || (/\.mp4(?:$|[?#])/i.test(src) ? src : "");
    const activeMp4Src = getVideoAtOffset(hourlySrc, hourOffset) ?? (hourOffset === 0 ? hourlySrc : "");
    const activeVideoSrc = getPlaybackSource(src, hourlySrc, hourOffset) ?? src;
    console.log("Item media name is: "+item?.mediaItemName)

    useEffect(() => {
        setHourOffset(0);
    }, [src]);

    const activeInfo = parseVideoURL(activeMp4Src);
    const originalTitle = mediaItemName ?? item?.name ?? id;
    const activeTitle = hourOffset !== 0 && activeInfo
        ? originalTitle?.replace(/[^/]+$/, activeInfo.filename) ?? activeInfo.filename
        : originalTitle;
    const activeHour = activeInfo ? getHourFromFilename(activeInfo.filename) : null;
    const timeOfRecording = activeHour !== null ? String(activeHour).padStart(2, "0") : "";
    const [playbackTimestamp, setPlaybackTimestamp] = useState(start);

    /*
     * Move the whole 3-video window, when arrow is clicked
     */
    const goPreviousHour = () => {
        setHourOffset((current) =>
            getVideoAtOffset(hourlySrc, current - 1) ? current - 1 : current
        );
    };

    const goNextHour = () => {
        setHourOffset((current) =>
            getVideoAtOffset(hourlySrc, current + 1) ? current + 1 : current
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

    useEffect(() => {
        setPlaybackTimestamp(hourOffset === 0 ? start : 0);
        setNnVector(null);
    }, [activeVideoSrc, hourOffset, start]);

    /**
     * Is called whenever a nearest neighbor search is prompted.
     */
    const onSearch = async (): Promise<void> => {
        const video = videoRef.current;

        if (!video) {
            console.error("Video element is not available.");
            return;
        }

        if (!activeMp4Src) {
            console.error("Cannot perform NN search: original MP4 URL is missing.", {item, mediaItemName});
            return;
        }

        setSearching(true);

        try {
            video.pause();
            const currentTimestamp = video.currentTime;
            const thumbnail = await generateVideoThumbnail(activeMp4Src, currentTimestamp);
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
            const videoName = activeInfo?.filename.replace(/\.[^.]+$/, "") ?? src.split("/")[splitLen - 1].split(".")[0];
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
        return <div className="vp-page"><button className="btn" onClick={() => navigate(-1)}>← Back</button><p>Missing video id.</p></div>;
    }

    return (
        <div className="vp-page">
            <header className="vp-heading">
                <nav className="vp-navigation" aria-label="Video navigation">
                    <button className="btn" onClick={() => navigate(-1)}>← Back</button>
                    <button className="btn" onClick={() => navigate("/")} title="Go to search">Search results</button>
                </nav>
                <div className="vp-title">
                    <span className="vp-eyebrow">Video detail</span>
                    <h1 title={activeTitle}>{activeTitle}</h1>
                </div>
            </header>

            <div className="vp-content">
                <section className="vp-playback" aria-label="Video playback and hour navigation">
                    <div className="vp-hour vp-hour--previous">
                        <HourGallery src={hourlySrc} direction="previous" offset={hourOffset} onPrevious={goPreviousHour} onNext={goNextHour}/>
                    </div>
                    <div className="vp-mainPlayer">
                        <div className="vp-playerHeading">
                            <span className="vp-eyebrow">Now playing</span>
                            <span className="sc-count">{timeOfRecording ? `${timeOfRecording}:00` : "Current"}</span>
                        </div>
                        <HlsVideoPlayer key={activeVideoSrc} ref={videoRef} src={activeVideoSrc}
                            poster={hourOffset === 0 ? poster : undefined}
                            startTime={hourOffset === 0 ? start : 0}
                            onTimeUpdate={setPlaybackTimestamp} preload="metadata"/>
                        <div className="vp-playerActions">
                            <button type="button" className="btn btn-primary" onClick={onSearch} disabled={searching}>
                                {searching ? "Searching NN…" : "Search NN"}
                            </button>
                            <div className="vp-submission">
                                {kind === "text" && <input className="vp-answer" aria-label="DRES text answer"
                                    value={textAnswer} onChange={(e) => setTextAnswer(e.target.value)}
                                    placeholder="Type answer (DRES)…"
                                    onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}/>}
                                <button type="button" className="btn vp-submit" onClick={onSubmit} disabled={submitting}>
                                    {submitting ? "Submitting…" : "Submit"}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="vp-hour vp-hour--next">
                        <HourGallery src={hourlySrc} direction="next" offset={hourOffset} onPrevious={goPreviousHour} onNext={goNextHour}/>
                    </div>
                </section>
                <POVs src={activeMp4Src || activeVideoSrc} timestamp={playbackTimestamp}/>
                <NearestNeighbor id={id} queryVector={nnVector} onResultsChange={setHasNeighbors}/>
            </div>
        </div>
    );
}
