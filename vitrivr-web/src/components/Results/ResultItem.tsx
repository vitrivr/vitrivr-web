import {useDresTask} from "../../dres/TaskContext.ts";
import {submissionMediaName} from "../../dres/taskKind.ts";
import {dresErrorMessage} from "../../dres/auth.ts";
import {notifyDres, notifyDresSubmission} from "../../dres/feedback.ts";
import type {SourceEvidence} from "../../lib/prakFederated.ts";
import React, {useState} from "react";
import {Link} from "react-router-dom";
import HlsVideoPlayer from "../VideoPage/HLSVideoPlayer.tsx";
import {useFrontendSettings} from "../../state/FrontendSettingsContext.tsx";
import {thumbnailURL, videoURL} from "../../lib/vitrivr";
import {submitText, submitVideo} from "../../dres/generated/api/dresSubmit.ts";
import {useAuth} from "../../state/AuthContext.tsx";

type BaseProps = {
    id: string,
    searchRank?: number,
    logFrameRank?: number,
    videoRank?: number,
    displayPosition?: number,
    evidence?: SourceEvidence[],
    mappingError?: string,
    resultScore?: number,
    relevance?: {selected: boolean; onToggle: () => void; disabled: boolean; reason?: string; unavailableLabel?: string},
    caption?: React.ReactNode,
    className?: string,
    captionClassName?: string,
    onBeforeOpen?: () => void,
    getVideoSrc?: () => string | undefined
};
type ImageProps = {
    kind?: "image";
    getImageSrc?: (id: string) => string;
    alt?: string;
    mediaClassName?: string;
};
type VideoProps = {
    kind: "video";
    posterOnly?: boolean;
    showDuration?: boolean;
    start: number;
    end: number;
    getVideoSrc: (id: string) => string;
    getPosterSrc?: (id: string) => string;
    getFallbackVideoSrc?: (id: string) => string | undefined;
    mediaItemName: string;
    controls?: boolean;
    autoPlay?: boolean;
    loop?: boolean;
    muted?: boolean;
    preload?: "none" | "metadata" | "auto";
    mediaClassName?: string;
};
type CustomProps = { kind: "custom"; renderMedia: (id: string) => React.ReactNode };
type ResultItemProps = BaseProps & (ImageProps | VideoProps | CustomProps);

export default function ResultItem(props: ResultItemProps) {
    const {settings} = useFrontendSettings();
    const {
        id,
        caption = id,
        className = "sb__card",
        captionClassName = "sb__caption",
    } = props;
    const [submitting, setSubmitting] = useState(false);
    const {session, openLogin} = useAuth();
    const {evaluationId} = useAuth();
    const {kind, refresh: refreshTask, reportSubmissionError} = useDresTask();
    const [textAnswer, setTextAnswer] = useState("");
    const [focused, setFocused] = useState(false);
    const [hovered, setHovered] = useState(false);
    let media: React.ReactNode;
    let displayCaption: React.ReactNode = caption;


    if (props.kind === "video") {
        const {
            start,
            getVideoSrc,
            getPosterSrc,
            controls = true,
            autoPlay = false,
            loop = false,
            muted = false,
            preload = "metadata",
            mediaClassName = "sb__video",
        } = props;

        const src = getVideoSrc(id);
        const poster = getPosterSrc?.(id) || thumbnailURL(id, settings.frontendView);
        const fallbackSrc = props.getFallbackVideoSrc?.(id) || videoURL(props.mediaItemName, settings.frontendView);
        displayCaption = caption;
        media = props.posterOnly ? <img className={mediaClassName} src={poster} alt={typeof caption === "string" ? caption : "Video preview"} decoding="async"/> : <HlsVideoPlayer className={mediaClassName} src={src} fallbackSrc={fallbackSrc} poster={poster}
            controls={controls} autoPlay={autoPlay} loop={loop} muted={muted} preload={preload} startTime={start}
            style={{objectFit: "cover"}}/>;
    } else if (props.kind === "custom") {
        media = props.renderMedia(id);
    } else {
        const {getImageSrc, alt = `Image for ${id}`, mediaClassName = "sb__image"} = props;
        const src = getImageSrc?.(id) || thumbnailURL(id, settings.frontendView);
        media = <img className={mediaClassName} src={src} alt={alt}/>;
    }



    const onSubmit = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!session || !evaluationId) { openLogin(); return; }
        if (props.kind !== "video" || submitting) return;
        setSubmitting(true);
        try {
            const currentKind = await refreshTask();
            if (currentKind === "unknown") {
                notifyDres("No active DRES task was found. Start a task before submitting.");
                return;
            }
            if (currentKind === "text") {
                const text = textAnswer.trim();
                if (kind !== "text" || !text) {
                    notifyDres("This task expects a text answer. Enter your answer in the result card.");
                    return;
                }
                const res = await submitText({session, evaluationId, text});
                notifyDresSubmission(res.data);
                if (res.data.status && res.data.submission === "CORRECT") setTextAnswer("");
            } else {
                if (kind === "text") {
                    notifyDres("The active task now expects a video answer. Review this result before submitting again.");
                    return;
                }
                if (!Number.isFinite(props.start) || !Number.isFinite(props.end) || props.end < props.start) {
                    throw new Error("This result has no valid segment boundaries for a midpoint submission.");
                }
                const midpoint = Math.max(0, Math.round((props.start + (props.end - props.start) / 2) * 1000));
                const mediaItemName = submissionMediaName(props.mediaItemName, settings.frontendView, settings.dresNaming[settings.frontendView]);
                if (!mediaItemName) throw new Error("This result has no DRES media item name.");
                const res = await submitVideo({session, evaluationId, mediaItemName, start: midpoint, end: midpoint});
                notifyDresSubmission(res.data);
            }
        } catch (error) {
            reportSubmissionError(error);
            notifyDres(dresErrorMessage(error));
        } finally {
            setSubmitting(false);
        }
    };

    const linkState =
        props.kind === "video"
            ? {
                src: props.getVideoSrc(id),
                fallbackSrc: props.getFallbackVideoSrc?.(id) || videoURL(props.mediaItemName, settings.frontendView),
                poster: props.getPosterSrc?.(id) || thumbnailURL(id, settings.frontendView),
                mediaItemName: props.mediaItemName,
                start: props.start,
                end: props.end,
            }
            : undefined;

    return (
        <div
            className="ri-wrap"
            data-log-result-id={id}
            data-log-frame-rank={props.logFrameRank ?? props.searchRank}
            data-log-video-rank={props.videoRank}
            data-log-position={props.displayPosition}
            data-log-media-name={props.kind === "video" ? props.mediaItemName : undefined}
            data-log-start={props.kind === "video" ? props.start : undefined}
            data-log-end={props.kind === "video" ? props.end : undefined}
            onFocus={() => setFocused(true)}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <figure className={`${className}${props.relevance?.selected ? " sc-relevantResult" : ""}`} style={{position: "relative"}}>
                <div className="ri-preview" style={{position: "relative"}}>
                <Link
                    to={`/video/${encodeURIComponent(id)}`}
                    state={linkState}
                    onClick={() => props.onBeforeOpen?.()}
                    style={{textDecoration: "none", color: "inherit", display: "block"}}
                >
                        {media}
                        {props.searchRank != null && <span className="sc-rank" aria-label={`Original result position ${props.searchRank}`}>#{props.searchRank}</span>}
                        {props.kind === "video" && props.showDuration && Number.isFinite(props.start) && (
                            <span className="sc-duration" aria-label="Segment start time">{Math.floor(Math.max(0, props.start) / 60).toString().padStart(2, "0")}:{Math.floor(Math.max(0, props.start) % 60).toString().padStart(2, "0")}</span>
                        )}
                </Link>
                {props.relevance && (hovered || focused || props.relevance.selected) && <label title={props.relevance.reason} className={`sc-relevanceToggle${props.relevance.selected ? " is-selected" : ""}`}>
                    <input type="checkbox" checked={props.relevance.selected} disabled={props.relevance.disabled}
                        onChange={props.relevance.onToggle} aria-label={`Mark result ${props.searchRank ?? id} as relevant`}/>
                    {props.relevance.reason ? props.relevance.unavailableLabel ?? "Unavailable" : "Relevant"}
                </label>}
                </div>
                <Link
                    to={`/video/${encodeURIComponent(id)}`}
                    state={linkState}
                    onClick={() => props.onBeforeOpen?.()}
                    style={{textDecoration: "none", color: "inherit", display: "block"}}
                >
                    <figcaption title={typeof displayCaption === "string" ? displayCaption : undefined} className={`${captionClassName}${props.evidence?.length ? " sc-fusionCaption" : ""}`}>
                        {displayCaption}
                        {!!props.evidence?.length && <span className="sc-fusionSources" aria-label="Contributing sources">
                            {props.evidence.map(item => <span className="sc-sourceBadge" key={item.source}
                                title={`${(item.source === "visual" || item.source === "prak") ? "PraK" : (/^person\d*$/.test(item.source) ? "Person" : item.source.toUpperCase())}: rank ${item.rank ?? "unknown"}; original score ${item.score ?? "unscored"}; weight ${item.weight ?? 1}; contribution ${item.contribution ?? "unknown"}`}>
                                {(item.source === "visual" || item.source === "prak") ? "PraK" : (/^person\d*$/.test(item.source) ? "Person" : item.source.toUpperCase())}
                            </span>)}
                            {props.resultScore !== undefined && Number.isFinite(props.resultScore) && <span className="sc-fusionScore" title="Engine result score">{props.resultScore.toFixed(4)}</span>}
                        </span>}
                        {props.mappingError && <span className="sc-mappingError" aria-label="Feedback mapping error">{props.mappingError}</span>}
                    </figcaption>
                </Link>

                {props.kind === "video" && kind === "text" && <form className="ri-textSubmission" aria-label="DRES text submission"
                    onSubmit={onSubmit} onClick={event => event.stopPropagation()}>
                    <input aria-label="DRES text answer" className="ri-textInput" placeholder="Enter your answer…"
                        value={textAnswer} onChange={event => setTextAnswer(event.target.value)} required disabled={submitting}/>
                    <button className="btn btn-primary" type="submit" disabled={submitting}>
                        {submitting ? "Submitting…" : "Submit text"}
                    </button>
                </form>}

                {props.kind === "video" && kind !== "text" && (hovered || focused) && (
                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={submitting}
                        className="ri-submitBtn"
                    >
                        {submitting ? "Submitting…" : "Submit"}
                    </button>
                )}
            </figure>
        </div>
    );
}
