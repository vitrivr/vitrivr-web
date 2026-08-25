import {useEffect, useState} from "react";
import DisclosureSection from "./DisclosureHeader.tsx";
import {PovCard} from "./POVCard.tsx";

/**
 * All the people contained in the CASTLE dataset 2024
 * TODO: think of a prettier and less hard coded solution.
 */
const PEOPLE = ["Allie", "Bao", "Bjorn", "Cathal", "Florian", "Klaus", "Luca", "Onanong", "Stevan", "Tien", "Werner"];
const ROOMS = ["Reading", "Living1", "Living2", "Kitchen", "Meeting"];

type PovKind = "person" | "room";

export type HourlyVideo = {
    name: string;
    url: string;
    kind: PovKind;
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
 * POV component that contains the videos of all participants of that corresponding time and day.
 * @param src
 * @constructor
 */
export default function POVs({src,}: OtherPovsProps) {
    const [open, setOpen] = useState(false);
    const [videos, setVideos] = useState<HourlyVideo[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const info = parseVideoURL(src);
    useEffect(() => {
        setOpen(false);
        setVideos([]);
        setVideos([]);
        setLoaded(false);
        setLoading(false);
    }, [src]);

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
                                    <PovCard
                                        key={video.url}
                                        video={video}
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
                                    <PovCard
                                        key={video.url}
                                        video={video}
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