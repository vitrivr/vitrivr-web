import {useEffect, useMemo, useRef, useState} from "react";
import {loadPovPreviews} from "./loadPovPreviews.ts";
import DisclosureSection from "./DisclosureHeader.tsx";
import ResultItem from "../Results/ResultItem.tsx";
import {useSearch} from "../../state/SearchContext.tsx";
import {useFrontendSettings} from "../../state/FrontendSettingsContext.tsx";
import {generateVideoThumbnail} from "./ThumbnailUtils.ts";
import {getHourFromFilename, parseVideoURL} from "./VideoHourUtils.ts";
import {mediaNameFromPath} from "../../lib/vitrivr.ts";
import type {CastleRecording} from "./castleRecordings.ts";
import {otherPovRecordings, type PovRecording} from "./povRecordings.ts";
import {useInteractionSnapshot} from "../../logging/react.ts";

type OtherPovsProps = {
    src: string;
    timestamp: number;
    recordings: CastleRecording[];
    catalogueLoading: boolean;
    catalogueError: string | null;
};

// Keep every recording clickable while its preview loads or if capture fails.
const pendingPoster = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="480" height="270" fill="#102f40"/><text x="240" y="140" text-anchor="middle" fill="#dce8ec" font-family="sans-serif" font-size="16">Open POV</text></svg>')}`;

export default function POVs(props: OtherPovsProps) {
    return <PovGallery key={props.src} {...props}/>;
}

function PovGallery({src, timestamp, recordings, catalogueLoading, catalogueError}: OtherPovsProps) {
    const [open, setOpen] = useState(false);
    const [previews, setPreviews] = useState<Record<string, string>>({});
    const [previewLoading, setPreviewLoading] = useState(false);
    const {setItems} = useSearch();
    const {settings} = useFrontendSettings();
    const info = useMemo(() => parseVideoURL(src), [src]);
    const videos = useMemo(() => otherPovRecordings(recordings, src, settings.sourceLocations), [recordings, src, settings.sourceLocations]);
    const timestampRef = useRef(timestamp);
    timestampRef.current = timestamp;
    const previewTime = useRef<number | null>(null);
    useInteractionSnapshot("video.povs", useMemo(() => ({source: src, open, catalogueLoading, catalogueError, previewLoading,
        recordings: videos.map(video => ({id: video.id, source: video.source, kind: video.kind, file: video.file})),
    }), [src, open, catalogueLoading, catalogueError, previewLoading, videos]));

    useEffect(() => {
        if (!open || !videos.length) return;
        const controller = new AbortController();
        const seekTime = previewTime.current ?? timestampRef.current;
        previewTime.current = seekTime;
        const byFile = new Map(videos.map(video => [video.file, video]));
        setPreviewLoading(true);
        // Catalogue entries are already known to exist. No HEAD/metadata probes.
        void loadPovPreviews(videos.map(video => ({id: video.id, name: video.source,
            kind: video.kind, url: video.file, seekTime})), controller.signal, video => {
            if (video.thumbnail) setPreviews(previous => ({...previous, [video.id]: video.thumbnail!}));
        }, {thumbnail: (file, time, signal) => generateVideoThumbnail(file, time, signal, byFile.get(file)?.stream)}, 3)
            .finally(() => { if (!controller.signal.aborted) setPreviewLoading(false); });
        return () => controller.abort();
    }, [open, videos]);

    function savePovBeforeOpen(video: PovRecording) {
        const mediaItemName = mediaNameFromPath(video.file, "CASTLE");
        setItems(previous => {
            const item = {id: video.id, parentId: video.id, kind: "video" as const,
                url: video.stream || video.file, videoUrl: video.file, sourcePath: video.file,
                mediaItemName, name: mediaItemName ?? video.source, thumbUrl: previews[video.id], start: timestamp, end: 0};
            return [...previous.filter(existing => existing.id !== video.id), item];
        });
    }

    if (!info) return null;
    const hour = getHourFromFilename(info.filename);
    return <DisclosureSection open={open} onToggle={() => setOpen(value => !value)}
        title={`Other POVs · ${info.day} at ${String(hour ?? "").padStart(2, "0")}:00`}
        count={catalogueLoading || catalogueError ? undefined : videos.length} loading={open && catalogueLoading}>
        {catalogueError && <div className="vp-message vp-message--error" role="alert">{catalogueError}</div>}
        {!catalogueLoading && !catalogueError && !videos.length && <div className="vp-message">No other recordings are indexed for this hour.</div>}
        {previewLoading && <p className="sc-personHint" role="status">Loading previews… You can open any POV now.</p>}
        {videos.length > 0 && <div className="vp-povGroups">
            {(["person", "room"] as const).map(kind => {
                const group = videos.filter(video => video.kind === kind);
                return group.length > 0 && <div key={kind}>
                    <h4 className="vp-povHeading">{kind === "person" ? "People" : "Rooms"}</h4>
                    <div className="vp-povGrid">
                        {group.map(video => <ResultItem key={video.id} id={video.id} kind="video" posterOnly start={timestamp} end={timestamp}
                            preload="none" controls={false} mediaClassName="ri-media" mediaItemName={mediaNameFromPath(video.file, "CASTLE") ?? ""}
                            getPosterSrc={() => previews[video.id] || pendingPoster} getVideoSrc={() => video.stream || video.file}
                            getFallbackVideoSrc={() => video.file} onBeforeOpen={() => savePovBeforeOpen(video)} caption={video.source}/>) }
                    </div>
                </div>;
            })}
        </div>}
    </DisclosureSection>;
}
