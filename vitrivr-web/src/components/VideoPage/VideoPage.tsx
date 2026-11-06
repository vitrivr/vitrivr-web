import {useDresTask} from "../../dres/TaskContext.ts";
import {submissionMediaName} from "../../dres/taskKind.ts";
import {dresErrorMessage} from "../../dres/auth.ts";
import {notifyDres, notifyDresSubmission} from "../../dres/feedback.ts";
"use client";
import {useLocation, useNavigate, useParams} from "react-router-dom";
import {thumbnailURL, videoURL} from "../../lib/vitrivr.ts";
import {useFrontendSettings} from "../../state/FrontendSettingsContext.tsx";
import {useSearch} from "../../state/SearchContext.tsx";
import {useEffect, useRef, useState} from "react";
import {useAuth} from "../../state/AuthContext.tsx";
import {submitVideo, submitText} from "../../dres/generated/api/dresSubmit.ts";
import NearestNeighbor from "./NearestNeighbor.tsx";
import POVs from "./POVs.tsx";
import VideoQA from "./VideoQA.tsx";
import {getHourFromFilename, getVideoAtOffset, getVideoViewPlayback, parseVideoURL} from "./VideoHourUtils.ts";
import HourGallery from "./HourGallery.tsx";
import {useCastleRecordings} from "./useCastleRecordings.ts";
import {findCastleRecording} from "./castleRecordings.ts";
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
    const {settings} = useFrontendSettings();
    const isCastleView = settings.frontendView === "CASTLE";
    const location = useLocation();
    const navigate = useNavigate();
    const {id} = useParams<{ id: string }>();
    const videoRef = useRef<HTMLVideoElement | null>(null);

    // DRES Info
    const {session, openLogin} = useAuth();
    const {evaluationId} = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [searching, setSearching] = useState(false);
    const [nnError, setNnError] = useState<string | null>(null);
    const [nnStage, setNnStage] = useState("");
    const nnRequest = useRef<AbortController | null>(null);
    const [nnVector, setNnVector] = useState<number[] | null>(null);
    const [, setHasNeighbors] = useState(false);

    const routeState = location.state as
        | {
        src?: string;
        fallbackSrc?: string;
        poster?: string;
        start?: number;
        end?: number;
        mediaItemName?: string;
        sourcePath?: string;
        parentId?: string;
    }
        | null;

    const {items, schema} = useSearch();
    const {recordings, loading: recordingsLoading, error: recordingsError} = useCastleRecordings(schema, isCastleView);
    const item = items.find((it) => it.id === id);
    const mediaItemName = item?.mediaItemName ?? routeState?.mediaItemName;
    const src = item?.url ?? routeState?.src ?? "";
    const start =
        typeof item?.start === "number" ? item.start : typeof routeState?.start === "number" ? routeState.start : 0;

    const mp4Location = item?.videoUrl || routeState?.fallbackSrc || videoURL(item?.sourcePath || mediaItemName, settings.frontendView);


    console.log("[VideoPage]", {
        segmentId: id,
        item,
        mediaItemName,
        mp4Location,
        hlsSrc: src,
    });

    const {kind, refresh: refreshTask, reportSubmissionError} = useDresTask();
    const [textAnswer, setTextAnswer] = useState("");

    const poster = item?.thumbUrl || routeState?.poster || (id ? thumbnailURL(id, settings.frontendView) : "");
    const [hourOffset, setHourOffset] = useState(0);
    const directFile = /\.mp4(?:$|[?#])/i.test(src) ? src : "";
    const hourlySrc = !isCastleView && directFile ? directFile : mp4Location || directFile;
    const playback = getVideoViewPlayback(settings.frontendView, src, hourlySrc, hourOffset);
    const activeRecording = isCastleView ? findCastleRecording(recordings, playback.file) : undefined;
    const activeMp4Src = activeRecording?.file || playback.file;
    const activeVideoSrc = activeRecording?.stream || playback.src;
    const activeOffset = playback.offset;
    console.log("Item media name is: "+item?.mediaItemName)

    useEffect(() => {
        setHourOffset(0);
    }, [src, settings.frontendView]);

    const activeInfo = isCastleView ? parseVideoURL(activeMp4Src) : null;
    const originalTitle = mediaItemName ?? item?.name ?? id;
    const activeTitle = activeOffset !== 0 && activeInfo
        ? originalTitle?.replace(/[^/]+$/, activeInfo.filename) ?? activeInfo.filename
        : originalTitle;
    const activeHour = activeInfo ? getHourFromFilename(activeInfo.filename) : null;
    const timeOfRecording = activeHour !== null ? String(activeHour).padStart(2, "0") : "";
    const [playbackTimestamp, setPlaybackTimestamp] = useState(start);

    /*
     * Move the whole 3-video window, when arrow is clicked
     */
    const goPreviousHour = () => {
        setHourOffset(current => {
            const file = getVideoAtOffset(hourlySrc, current - 1);
            return file && (!recordings.length || findCastleRecording(recordings, file)) ? current - 1 : current;
        });
    };

    const goNextHour = () => {
        setHourOffset(current => {
            const file = getVideoAtOffset(hourlySrc, current + 1);
            return file && (!recordings.length || findCastleRecording(recordings, file)) ? current + 1 : current;
        });
    };



    useEffect(() => {
        window.scrollTo({top: 0, left: 0, behavior: "instant" as ScrollBehavior});
    }, [id]);

    useEffect(() => {
        setPlaybackTimestamp(activeOffset === 0 ? start : 0);
        setNnVector(null);
        setNnError(null);
        setSearching(false);
        setNnStage("");
        return () => {
            nnRequest.current?.abort();
            nnRequest.current = null;
        };
    }, [activeVideoSrc, activeOffset, start, settings.frontendView]);

    /**
     * Is called whenever a nearest neighbor search is prompted.
     */
    const onSearch = async (): Promise<void> => {
        const video = videoRef.current;

        setNnError(null);
        if (!video || video.readyState < 2) {
            setNnError("Wait for the video to load before searching for similar frames.");
            return;
        }
        if (!activeMp4Src) {
            setNnError("The original video file is unavailable for frame search.");
            return;
        }
        nnRequest.current?.abort();
        const controller = new AbortController();
        nnRequest.current = controller;
        const timeout = window.setTimeout(() => controller.abort(), 60_000);
        setSearching(true);
        setNnVector(null);
        try {
            video.pause();
            setNnStage("Capturing frame…");
            const thumbnail = await generateVideoThumbnail(activeMp4Src, video.currentTime, controller.signal);
            if (controller.signal.aborted) return;
            if (!thumbnail) throw new Error("Could not capture the video frame. Check that the original video is available and permits frame capture.");
            setNnStage("Finding similar frames…");
            const clipVector = await requestCLIPVector(thumbnail, controller.signal);
            if (!controller.signal.aborted) setNnVector(clipVector);
        } catch (error) {
            if (!controller.signal.aborted) {
                setNnError(error instanceof TypeError
                    ? "Could not reach the image descriptor server. Check its connection and proxy configuration."
                    : error instanceof Error ? error.message : String(error));
            }
        } finally {
            window.clearTimeout(timeout);
            if (nnRequest.current === controller) {
                if (controller.signal.aborted) setNnError("Frame search timed out. Please try again.");
                setSearching(false);
                setNnStage("");
                nnRequest.current = null;
            }
        }
    };


    const onSubmit = async () => {
        if (!session || !evaluationId) {
            openLogin();
            return;
        }
        if (submitting) return;
        const text = textAnswer.trim();
        setSubmitting(true);
        try {
            const currentKind = await refreshTask();
            if (currentKind === "unknown") {
                notifyDres("No active DRES task was found. Start a task before submitting.");
                return;
            }
            if (currentKind === "text") {
                if (kind !== "text" || !text) {
                    notifyDres("This task expects a text answer. Enter your answer in the field below the video.");
                    return;
                }
                const res = await submitText({session, evaluationId, text});
                notifyDresSubmission(res.data);
                if (res.data.status && res.data.submission === "CORRECT") setTextAnswer("");
            } else {
                if (kind === "text") {
                    notifyDres("The active task now expects a video answer. Review the current video before submitting again.");
                    return;
                }
                const tSec = videoRef.current?.currentTime ?? start;
                const tMs = Number.isFinite(tSec) ? Math.round(tSec * 1000) : undefined;
                const videoName = submissionMediaName(isCastleView ? activeMp4Src || mediaItemName || src : mediaItemName || activeMp4Src || src, settings.frontendView);
                const res = await submitVideo({session, evaluationId, mediaItemName: videoName, start: tMs, end: tMs});
                notifyDresSubmission(res.data);
            }
        } catch (error) {
            reportSubmissionError(error);
            notifyDres(dresErrorMessage(error));
        } finally {
            setSubmitting(false);
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
                <section className={`vp-playback${isCastleView ? "" : " vp-playback--vbs"}`} aria-label={isCastleView ? "Video playback and recording navigation" : "Video playback"}>
                    {isCastleView && <div className="vp-hour vp-hour--previous">
                        <HourGallery src={hourlySrc} direction="previous" offset={hourOffset} onPrevious={goPreviousHour} onNext={goNextHour} recordings={recordings}/>
                    </div>}
                    <div className="vp-mainPlayer">
                        <div className="vp-playerHeading">
                            <span className="vp-eyebrow">Now playing</span>
                            {isCastleView && <span className="sc-count">{timeOfRecording ? `${timeOfRecording}:00` : "Current"}</span>}
                        </div>
                        <HlsVideoPlayer key={activeVideoSrc} ref={videoRef} src={activeVideoSrc} fallbackSrc={activeMp4Src}
                            poster={activeOffset === 0 ? poster : undefined}
                            startTime={activeOffset === 0 ? start : 0}
                            onTimeUpdate={setPlaybackTimestamp} preload="metadata"/>
                        {nnError && <div className="vp-message vp-message--error" role="alert">{nnError}</div>}
                        <div className="vp-playerActions">
                            <button type="button" className="btn btn-primary" onClick={onSearch} disabled={searching}>
                                {searching ? nnStage || "Searching NN…" : "Search NN"}
                            </button>
                            <form className="vp-submission" aria-label="Submit answer to DRES"
                                onSubmit={event => { event.preventDefault(); void onSubmit(); }}>
                                {kind === "text" && <input className="vp-answer" aria-label="DRES text answer"
                                    value={textAnswer} onChange={event => setTextAnswer(event.target.value)}
                                    placeholder="Enter your answer…" required disabled={submitting}/>}
                                <button type="submit" className="btn vp-submit" disabled={submitting}>
                                    {submitting ? "Submitting…" : kind === "text" ? "Submit text" : "Submit video"}
                                </button>
                            </form>
                        </div>
                    </div>
                    {isCastleView && <div className="vp-hour vp-hour--next">
                        <HourGallery src={hourlySrc} direction="next" offset={hourOffset} onPrevious={goPreviousHour} onNext={goNextHour} recordings={recordings}/>
                    </div>}
                </section>
                {isCastleView && <VideoQA key={`${schema}:${id}:${activeMp4Src}`} file={activeMp4Src || mediaItemName || ""}/>}
                {isCastleView && <POVs src={activeMp4Src || activeVideoSrc} timestamp={playbackTimestamp}
                    recordings={recordings} catalogueLoading={recordingsLoading} catalogueError={recordingsError}/>}
                <NearestNeighbor id={id} queryVector={nnVector} onResultsChange={setHasNeighbors}/>
            </div>
        </div>
    );
}
