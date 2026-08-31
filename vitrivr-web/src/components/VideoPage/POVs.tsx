import {useEffect, useRef, useState} from "react";
import DisclosureSection from "./DisclosureHeader.tsx";
import ResultItem from "../Results/ResultItem.tsx";
import {useSearch} from "../../state/SearchContext.tsx";
import {filterExistingVideos, generatePOVData, type HourlyVideo, parseVideoURL, uuidFromUuidV4} from "./utils.ts";

/**
 * All the people contained in the CASTLE dataset 2024
 * TODO: think of a prettier and less hard coded solution.
 */
const PEOPLE = ["Allie", "Bao", "Bjorn", "Cathal", "Florian", "Klaus", "Luca", "Onanong", "Stevan", "Tien", "Werner"];
const ROOMS = ["Reading", "Living1", "Living2", "Kitchen", "Meeting"];

/**
 * This type slightly differs from a ResultItem, but essentially serves the same purpose. The only difference is that
 * with the hourly videos are not vitrivr results, but "bare" videos. Thus, the thumbnails and the clip vectors need
 * to be generated.
 */

type OtherPovsProps = {
    src: string;
};


/**
 * POV component that contains the videos of all participants of that corresponding time and day.
 * @param src
 * @constructor
 */
export default function POVs({src,}: OtherPovsProps) {
    const [open, setOpen] = useState(false);
    const [videos, setVideos] = useState<HourlyVideo[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const processingClipIds = useRef<Set<string>>(new Set());
    const {setVectorsById, setItems,} = useSearch();

    const info = parseVideoURL(src);
    useEffect(() => {
        setOpen(false);
        setVideos([]);
        setVideos([]);
        setLoaded(false);
        setLoading(false);
    }, [src]);

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
                    start: 0,
                    end: 0,
                    clipVector: video.CLIPVector,
                },
            ];
        });

        if (video.CLIPVector?.length) {
            setVectorsById((previous) => ({
                ...previous,
                [video.id]: video.CLIPVector!,
            }));
        }
    }

    useEffect(() => {
        if (!open || loaded || !info) {
            return;
        }

        let cancelled = false;

        async function loadVideos() {
            if (!info) return;

            const peopleCandidates: HourlyVideo[] = PEOPLE
                .filter((person) => person !== info.person)
                .map((person) => ({
                    id: uuidFromUuidV4(),
                    name: person,
                    kind: "person",
                    url:
                        `${info.origin}/videos/` +
                        `${encodeURIComponent(info.day)}/` +
                        `${encodeURIComponent(person)}/video/` +
                        `${encodeURIComponent(info.filename)}`,
                }));

            const roomCandidates: HourlyVideo[] = ROOMS
                .filter((room) => room !== info.person)
                .map((room) => ({
                    id: uuidFromUuidV4(),
                    name: room,
                    kind: "room",
                    url:
                        `${info.origin}/videos/` +
                        `${encodeURIComponent(info.day)}/` +
                        `${encodeURIComponent(room)}/video/` +
                        `${encodeURIComponent(info.filename)}`,
                }));

            const candidates = [
                ...peopleCandidates,
                ...roomCandidates,
            ];

            setLoading(true);

            try {
                const existing =
                    await filterExistingVideos(
                        candidates,
                        4
                    );

                if (!cancelled) {
                    setVideos(existing);
                    setLoaded(true);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadVideos();

        return () => {
            cancelled = true;
        };
    }, [open, loaded, info?.origin, info?.day, info?.person, info?.filename]);

    useEffect(() => {
        if (!open || videos.length === 0) {
            return;
        }

        const missing = videos.filter(
            (video) =>
                !video.CLIPVector &&
                !processingClipIds.current.has(video.id)
        );

        if (missing.length === 0) {
            return;
        }

        let cancelled = false;

        for (const video of missing) {
            processingClipIds.current.add(video.id);
        }

        async function loadPovData() {
            const generated = await generatePOVData(
                missing,
                2
            );

            if (cancelled) {
                return;
            }

            const generatedById = new Map(generated.map((video) => [video.id, video,]));

            setVideos((previous) =>
                previous.map((video) =>
                    generatedById.get(video.id) ??
                    video
                )
            );

            setVectorsById((previous) => {
                const next = {...previous};

                for (const video of generated) {
                    if (video.CLIPVector?.length) {
                        next[video.id] =
                            video.CLIPVector;
                    }
                }

                return next;
            });

            for (const video of missing) {
                processingClipIds.current.delete(
                    video.id
                );
            }
        }

        loadPovData();

        return () => {
            cancelled = true;
        };
    }, [
        open,
        videos,
    ]);

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
            loading={loading}
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
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 20,
                        alignItems: "start",
                    }}
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
                                        "repeat(auto-fill, minmax(180px, 1fr))",
                                    gap: 10,

                                }}
                            >
                                {peopleVideos.map((video) => (
                                    <ResultItem
                                        key={video.id}
                                        id={video.id}
                                        kind="video"
                                        start={0} // TODO: change this when HLS works
                                        end={0} // TODO: change this when HLS works
                                        preload="none"
                                        controls={false}
                                        mediaClassName="ri-media"
                                        getPosterSrc={() => video.thumbnail ?? ""}
                                        getVideoSrc={() => video.url}
                                        onBeforeOpen={() => savePovBeforeOpen}
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
                                        "repeat(auto-fill, minmax(180px, 1fr))",
                                    gap: 10,
                                }}
                            >
                                {roomVideos.map((video) => (
                                    <ResultItem
                                        key={video.id}
                                        id={video.id}
                                        kind="video"
                                        start={0} // TODO: change this when HLS works
                                        end={0} // TODO: change this when HLS works
                                        preload="none"
                                        controls={false}
                                        mediaClassName="ri-media"
                                        getPosterSrc={() => video.thumbnail ?? ""}
                                        getVideoSrc={() => video.url}
                                        onBeforeOpen={() => savePovBeforeOpen}
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