import {useEffect, useMemo, useRef, useState} from "react";
import {loadPovPreviews} from "./loadPovPreviews.ts";
import DisclosureSection from "./DisclosureHeader.tsx";
import ResultItem from "../Results/ResultItem.tsx";
import {useSearch} from "../../state/SearchContext.tsx";
import {videoExists, generateVideoThumbnail, type HourlyVideo, parseVideoURL, uuidFromUuidV4} from "./ThumbnailUtils.ts";

/**
 * All the people contained in the CASTLE dataset 2024
 * TODO: think of a prettier and less hard coded solution.
 */
const PEOPLE = ["Allie", "Bao", "Björn", "Cathal", "Florian", "Klaus", "Luca", "Onanong", "Stevan", "Tien", "Werner"];
const ROOMS = ["Reading", "Living1", "Living2", "Kitchen", "Meeting"];

/**
 * This type slightly differs from a ResultItem, but essentially serves the same purpose. The only difference is that
 * with the hourly videos are not vitrivr results, but "bare" videos. Thus, the thumbnails and the clip vectors need
 * to be generated.
 */

type OtherPovsProps = {
    src: string;
    timestamp: number;
};


/**
 * POV component that contains the videos of all participants of that corresponding time and day.
 * @constructor
 */
export default function POVs(props: OtherPovsProps) {
    return <PovGallery key={props.src} {...props}/>;
}

function PovGallery({src, timestamp}: OtherPovsProps) {
    const [open, setOpen] = useState(false);
    const [videos, setVideos] = useState<HourlyVideo[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const {setItems} = useSearch();
    const info = useMemo(() => parseVideoURL(src), [src]);
    const timestampRef = useRef(timestamp);
    timestampRef.current = timestamp;
    const previewTime = useRef<number | null>(null);

    function savePovBeforeOpen(video: HourlyVideo) {
        setItems((previous) => {
            if (
                previous.some(
                    (item) => item.id === video.id
                )
            ) {
                return previous;
            }

            return [
                ...previous,
                {
                    id: video.id,
                    kind: "video",
                    url: video.url,
                    name: video.name,
                    start: timestamp,
                    end: 0,
                    clipVector: video.CLIPVector,
                },
            ];
        });

    }

    useEffect(() => {
        if (!open || loaded || !info) return;
        const controller = new AbortController();
        // Hold one frame time for this gallery; playback updates must not restart requests.
        const seekTime = previewTime.current ?? timestampRef.current;
        previewTime.current = seekTime;
        const candidates: HourlyVideo[] = [
            ...PEOPLE.filter(person => person !== info.person).map(name => ({name, kind: "person" as const})),
            ...ROOMS.filter(room => room !== info.person).map(name => ({name, kind: "room" as const})),
        ].map(({name, kind}) => ({
            id: uuidFromUuidV4(), name, kind, seekTime,
            url: `${info.origin}/videos/${encodeURIComponent(info.day)}/${encodeURIComponent(name)}/video/${encodeURIComponent(info.filename)}`,
        }));
        const order = new Map(candidates.map((video, index) => [video.url, index]));
        setLoading(true);
        void loadPovPreviews(candidates, controller.signal, (video) => {
            setVideos(previous => {
                const existing = previous.find(candidate => candidate.url === video.url);
                const updated = existing ? {...existing, ...video, id: existing.id} : video;
                return [...previous.filter(candidate => candidate.url !== video.url), updated]
                    .sort((a, b) => order.get(a.url)! - order.get(b.url)!);
            });
        }, {exists: videoExists, thumbnail: generateVideoThumbnail}).finally(() => {
            if (!controller.signal.aborted) {
                setLoaded(true);
                setLoading(false);
            }
        });
        return () => controller.abort();
    }, [open, loaded, info]);

    if (!info) {
        return null;
    }

    const peopleVideos = videos.filter(
        (video) => video.kind === "person"
    );

    const roomVideos = videos.filter(
        (video) => video.kind === "room"
    );

    return (
        <DisclosureSection
            open={open}
            onToggle={() => setOpen((value) => !value)}
            title={`Other POVs · ${info.day} at ${info.filename.replace(/\.[^.]+$/, "")}:00`}
            count={open && loaded ? videos.length : undefined}
            loading={open && loading}
        >
            {!loading && loaded && videos.length === 0 && (
                <div
                    style={{
                        opacity: 0.6,
                        fontSize: 13,
                    }}
                >
                    No other POVs available.
                </div>
            )}
            {videos.length > 0 && (
                <div className="vp-povGroups"
                >
                    {peopleVideos.length > 0 && (
                        <div>
                            <h4
                                style={{
                                    margin: "0 0 8px",
                                    fontSize: 14,
                                    fontWeight: 600,
                                }}
                            >
                                People
                            </h4>

                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                        "repeat(auto-fill, minmax(min(180px, 100%), 1fr))",
                                    gap: 10,

                                }}
                            >
                                {peopleVideos.map((video) => (
                                    <ResultItem
                                        key={video.id}
                                        id={video.id}
                                        kind="video"
                                        start={timestamp}
                                        end={0}
                                        preload="none"
                                        controls={false}
                                        mediaClassName="ri-media"
                                        mediaItemName={""}
                                        getPosterSrc={() => video.thumbnail ?? ""}
                                        getVideoSrc={() => video.url}
                                        onBeforeOpen={() => savePovBeforeOpen(video)}
                                        caption={video.name}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {roomVideos.length > 0 && (
                        <div>
                            <h4
                                style={{
                                    margin: "0 0 8px",
                                    fontSize: 14,
                                    fontWeight: 600,
                                }}
                            >
                                Rooms
                            </h4>

                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                        "repeat(auto-fill, minmax(min(180px, 100%), 1fr))",
                                    gap: 10,
                                }}
                            >
                                {roomVideos.map((video) => (
                                    <ResultItem
                                        key={video.id}
                                        id={video.id}
                                        kind="video"
                                        start={timestamp}
                                        end={0}
                                        preload="none"
                                        controls={false}
                                        mediaClassName="ri-media"
                                        mediaItemName={""}
                                        getPosterSrc={() => video.thumbnail ?? ""}
                                        getVideoSrc={() => video.url}
                                        onBeforeOpen={() => savePovBeforeOpen(video)}
                                        caption={video.name}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </DisclosureSection>
    );
}