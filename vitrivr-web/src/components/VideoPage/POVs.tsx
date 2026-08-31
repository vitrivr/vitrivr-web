import {useEffect, useRef, useState} from "react";
import DisclosureSection from "./DisclosureHeader.tsx";
import ResultItem from "../Results/ResultItem.tsx";
import {uuid} from "../../utils/uuid.ts";
import {requestCLIPVector} from "../../lib/pythonDescriptorServer.ts";
import {useSearch} from "../../state/SearchContext.tsx";

/**
 * All the people contained in the CASTLE dataset 2024
 * TODO: think of a prettier and less hard coded solution.
 */
const PEOPLE = ["Allie", "Bao", "Bjorn", "Cathal", "Florian", "Klaus", "Luca", "Onanong", "Stevan", "Tien", "Werner"];
const ROOMS = ["Reading", "Living1", "Living2", "Kitchen", "Meeting"];

type PovKind = "person" | "room";

/**
 * This type slightly differs from a ResultItem, but essentially serves the same purpose. The only difference is that
 * with the hourly videos are not vitrivr results, but "bare" videos. Thus the thumbnails and the clip vectors need
 * to be generated.
 */
export type HourlyVideo = {
    id: string;
    name: string;
    url: string;
    kind: PovKind;
    clipVector?: number[];
};

type ParsedVideoUrl = {
    origin: string;
    day: string;
    person: string;
    filename: string;
};

type OtherPovsProps = {
    src: string;
};

type POVAnalysis = {
    thumbnail: string;
    CLIPVector: number[];
}

/**
 * Function that parses the URL of the video to extract the day, person and filename from the path.
 * Mainly used for displaying the videos from the same time, date but different person.
 * @param url
 */
function parseVideoURL(url: string): ParsedVideoUrl | null {
    if (!url) return null;

    try {
        const parsed = new URL(url);
        // TODO: adjust this to the actual schema of the filename. not all filenames contain "videos"
        // the expected format is like this: http://10.34.64.212:8080/videos/day4/Luca/video/08.mp4
        const match = parsed.pathname.match(/^\/videos\/([^/]+)\/([^/]+)\/video\/([^/]+)$/);
        if (!match) return null;
        return {
            origin: parsed.origin,
            day: match[1],
            person: match[2],
            filename: match[3],
        };
    } catch {
        return null;
    }
}

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

async function generateThumbnailAndClip(video: HourlyVideo): Promise<POVAnalysis | undefined> {
    try {
        const thumbnail = await generateVideoThumbnail(video.url);
        if (!thumbnail) {
            console.warn("Could not generate thumbnail for:", video.url);
            return undefined;
        }
        const CLIPVector = await requestCLIPVector(thumbnail);
        console.log(thumbnail, CLIPVector);
        return {thumbnail, CLIPVector,};
    } catch (error) {
        console.error("Failed to generate thumbnail / CLIP vector:", video.url, error);
        return undefined;
    }
}

/**
 * Runs async checks with a concurrency limit s.t. we don't fire too many requests at the video server.
 */
async function filterExistingVideos(videos: HourlyVideo[], concurrency = 4): Promise<HourlyVideo[]> {
    const existing = new Set<string>();
    let index = 0;

    async function worker() {
        while (true) {
            const currentIndex = index++;

            if (currentIndex >= videos.length) {
                return;
            }

            const video = videos[currentIndex];

            if (await videoExists(video.url)) {
                existing.add(video.url);
            }
        }
    }
    await Promise.all(Array.from({length: Math.min(concurrency, videos.length),}, () => worker()));
    return videos.filter((video) =>
        existing.has(video.url)
    );
}

/**
 * Generates a UUID and converts it into a string.
 */
const uuidFromUuidV4 = () => {
    const newUuid = uuid()
    return newUuid.toString();
}

/**
 * Generates the video thumbnails from a given URL and seektime.
 * @param url string
 * @param seekTime
 */
function generateVideoThumbnail(url: string, seekTime = 1): Promise<string | undefined> {
    return new Promise((resolve) => {
        const video = document.createElement("video");
        const canvas = document.createElement("canvas");
        let finished = false;

        const timeout = window.setTimeout(() => {
            console.warn("Thumbnail generation timed out:", url);
            finish(undefined);
        }, 10_000);

        function cleanup() {
            window.clearTimeout(timeout);
            video.onloadedmetadata = null;
            video.onloadeddata = null;
            video.onseeked = null;
            video.onerror = null;
            video.removeAttribute("src");
            video.load();
        }

        function finish(thumbnail: string | undefined) {
            if (finished) return;
            finished = true;
            cleanup();
            resolve(thumbnail);
        }

        function captureFrame() {
            try {
                if (!video.videoWidth || !video.videoHeight) {
                    console.warn("Video has no dimensions:", url, video.videoWidth, video.videoHeight);
                    finish(undefined);
                    return;
                }

                const maxWidth = 480;
                const scale = Math.min(1, maxWidth / video.videoWidth);
                canvas.width = Math.round(video.videoWidth * scale);
                canvas.height = Math.round(video.videoHeight * scale);
                const context = canvas.getContext("2d");

                if (!context) {
                    console.error("Could not create canvas context");
                    finish(undefined);
                    return;
                }

                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const thumbnail = canvas.toDataURL("image/jpeg", 0.8);
                console.log("Thumbnail generated:", url);
                finish(thumbnail);
            } catch (error) {
                console.error("Thumbnail capture failed:", url, error);
                finish(undefined);
            }
        }

        video.preload = "auto";
        video.muted = true;
        video.playsInline = true;

        try {
            if (new URL(url).origin !== window.location.origin) {
                video.crossOrigin = "anonymous";
            }
        } catch (error) {
            console.error("Invalid video URL:", url, error);
        }

        video.onerror = () => {
            console.error("Thumbnail video failed:", url, video.error);
            finish(undefined);
        };

        video.onloadedmetadata = () => {
            console.log("Metadata loaded:", url, "duration:", video.duration, "size:", video.videoWidth, "x", video.videoHeight);

            if (
                Number.isFinite(video.duration) &&
                video.duration > 0
            ) {
                const targetTime = Math.min(seekTime, Math.max(0, video.duration - 0.1));
                console.log("Seeking thumbnail to:", targetTime);
                if (targetTime <= 0.01) {
                    video.onloadeddata = captureFrame;
                } else {
                    video.currentTime = targetTime;
                }
            } else {
                video.onloadeddata = captureFrame;
            }
        };

        video.onseeked = () => {
            console.log("Thumbnail seek completed:", url, video.currentTime);
            captureFrame();
        };

        video.src = url;
        video.load();
    });
}

/**
 * This generates CLIP vector and the thumbnail for the POV data. This is necessary because it is not a vitrivr result.
 * It does this by requesting the CLIP vectors at the vitrivr descriptor server and the thumbnails are cut from the
 * video itself.
 * @param videos
 * @param concurrency
 */
async function generatePOVData(videos: HourlyVideo[], concurrency = 2): Promise<Record<string, POVAnalysis>> {
    const results: Record<string, POVAnalysis> = {};
    let index = 0;
    async function worker() {
        while (true) {
            const currentIndex = index++;

            if (currentIndex >= videos.length) {
                return;
            }
            const video = videos[currentIndex];
            const result = await generateThumbnailAndClip(video);
            if (result) {
                results[video.id] = result; // this works
            }
        }
    }

    await Promise.all(
        Array.from(
            {
                length: Math.min(
                    concurrency,
                    videos.length
                ),
            },
            () => worker()
        )
    );

    return results;
}

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
    const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
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
                    clipVector: video.clipVector,
                },
            ];
        });

        if (video.clipVector?.length) {
            setVectorsById((previous) => ({
                ...previous,
                [video.id]: video.clipVector!,
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
                !video.clipVector &&
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

            // Save thumbnails
            setThumbnails((previous) => {
                const next = {...previous};

                for (
                    const [id, result]
                    of Object.entries(generated)
                    ) {
                    next[id] = result.thumbnail;
                }

                return next;
            });

            // Save CLIP vectors in the POV video objects
            setVideos((previous) =>
                previous.map((video) => {
                    const result = generated[video.id];

                    if (!result) {
                        return video;
                    }

                    return {
                        ...video,
                        clipVector: result.CLIPVector,
                    };
                })
            );

            // set the vectors to the correct results
            setVectorsById((previous) => {
                const next = {...previous};

                for (const [id, result] of Object.entries(generated)) {
                    next[id] = result.CLIPVector;
                }

                return next;
            });

            for (const video of missing) {
                processingClipIds.current.delete(video.id);
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
                                        getPosterSrc={() => thumbnails[video.id] ?? ""}
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
                                        getPosterSrc={() => thumbnails[video.id] ?? ""}
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