import {useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import {buildVectorQuery, servedVideoUrl, thumbnailUrl,} from "../../lib/vitrivr";
import {useSearch} from "../../state/SearchContext";
import {retrieval} from "../../vitirvr/api/client";
import ResultItem from "../Results/ResultItem";
import DisclosureSection from "./DisclosureHeader.tsx";

type MediaItem = {
    id: string;
    kind: "video";
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

type NearestNeighborsProps = {
    id: string;
};

function pickNumber(r: { descriptors?: Record<string, unknown> }, key: string): number | undefined {
    const value = r.descriptors?.[key];

    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string") {
        const number = Number(value.trim());
        return Number.isFinite(number) ? number : undefined;
    }

    return undefined;
}

function pickFloatArray(r: { descriptors?: Record<string, unknown> }, key: string): number[] | undefined {
    const value = r.descriptors?.[key];
    if (!Array.isArray(value)) {
        return undefined;
    }
    const output: number[] = [];
    for (const item of value) {
        if (typeof item !== "number" || !Number.isFinite(item)) {
            return undefined;
        }
        output.push(item);
    }
    return output;
}

function nsToSeconds(value: number): number {
    return value / 1_000_000_000;
}

function basenameFromPath(path: string): string {
    const normalized = path.replace(/\\/g, "/");
    const parts = normalized.split("/");
    return parts[parts.length - 1] ?? "";
}

function toServedVideoUrl(schema: string, filePath: string): string {
    const origin = import.meta.env.VITE_MEDIA_ORIGIN || "";
    if (!origin) return "";
    const filename = basenameFromPath(filePath);
    if (!filename) return "";
    return servedVideoUrl(schema, filePath);
}

/**
 * Extracts the video name from the url. E.g. http://10.34.64.212:8080/videos/day3/Florian/video/11.mp4 then 11.mp4 is
 * extracted.
 * @param url
 */
function videoNameFromUrl(url: string): string {
    try {
        const parsed = new URL(url);
        const filename = parsed.pathname.split("/").pop() ?? "";
        return filename.replace(/\.[^.]+$/, "");
    } catch {
        const filename =
            (url ?? "")
                .split("?")[0]
                .split("#")[0]
                .split("/")
                .pop() ?? "";

        return filename.replace(/\.[^.]+$/, "");
    }
}

function mapNeighbors(schema: string, response: RetrievablesResponse): MediaItem[] {
    const retrievables = response.retrievables ?? [];
    const output: MediaItem[] = [];
    for (const retrievable of retrievables) {
        const id = retrievable.id?.trim();

        if (!id || retrievable.type !== "SEGMENT") {
            continue;
        }

        const clipVector = pickFloatArray(
            retrievable,
            "clip.vector"
        );

        const filePath = (retrievable.descriptors?.["file.path"] as string | undefined) ||
            (retrievable.relationship?.partOf?.descriptors?.["file.path"] as string | undefined);

        if (!filePath) continue;

        const start = nsToSeconds(pickNumber(retrievable, "time.start") ?? 0);
        const end = nsToSeconds(pickNumber(retrievable, "time.end") ?? 0);
        const url = toServedVideoUrl(schema, filePath);

        if (!url) continue;

        output.push({
            id,
            kind: "video",
            url,
            name: videoNameFromUrl(url),
            thumbUrl: thumbnailUrl(schema, id),
            start,
            end,
            rawType: retrievable.type,
            clipVector,
        });
    }
    return output;
}

/**
 * Section for the nearest neighbor search results of a video thumbnail. The results get displayed in a grid and each results
 * has a pink submit button for DRES. The results are clickable. If you click on a result the video is openend
 * and can be watched and the nearest neighbor search results of that video are again displayed.
 */
export default function NearestNeighbor({id,}: NearestNeighborsProps) {
    const navigate = useNavigate();
    const {schema, vectorsById, setVectorsById, setItems} = useSearch();
    const [open, setOpen] = useState(false);
    const [neighbors, setNeighbors] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const currentVector = useMemo(() => vectorsById?.[id], [id, vectorsById]);
    const [hovered, setHovered] = useState(false);

    useEffect(() => {
        setOpen(false);
        setNeighbors([]);
        setLoaded(false);
        setLoading(false);
        setError(null);
    }, [id]);

    useEffect(() => {
        if (!open || loaded) {
            return;
        }

        if (!currentVector || currentVector.length === 0) {
            setError("No clip.vector found for this segment.");
            setLoaded(true);
            return;
        }

        let cancelled = false;

        async function loadNeighbors() {
            setLoading(true);
            setError(null);

            try {
                const body = buildVectorQuery(currentVector!, 1000);
                // @ts-expect-error
                const response = await retrieval.postExecuteQuery(schema, body);
                if (cancelled) return;
                const mapped = mapNeighbors(schema, response as RetrievablesResponse).filter((neighbor) => neighbor.id !== id);

                setVectorsById((previous) => {
                    const next = {...previous};

                    for (const neighbor of mapped) {
                        if (neighbor.clipVector?.length) {
                            next[neighbor.id] = neighbor.clipVector;
                        }
                    }

                    return next;
                });

                setNeighbors(mapped);
                setLoaded(true);
            } catch (error: unknown) {
                if (cancelled) return;
                setError(error instanceof Error ? error.message : String(error));
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadNeighbors();

        return () => {
            cancelled = true;
        };
    }, [
        open,
        loaded,
        id,
        schema,
        currentVector,
        setVectorsById,
    ]);

    function openNeighbor(
        neighbor: MediaItem
    ) {
        if (neighbor.clipVector?.length) {
            setVectorsById((previous) => ({
                ...previous,
                [neighbor.id]:
                    neighbor.clipVector!,
            }));
        }

        setItems((previous) => {
            if (previous.some((item) => item.id === neighbor.id)) {
                return previous;
            }

            return [
                ...previous,
                neighbor,
            ];
        });

        navigate(
            `/video/${encodeURIComponent(
                neighbor.id
            )}`
        );
    }

    return (
        <DisclosureSection
            open={open}
            onToggle={() =>
                setOpen((value) => !value)
            }
            title="Nearest neighbors of the thumbnail"
            count={
                open && loaded && !error
                    ? neighbors.length
                    : undefined
            }
            loading={loading}
        >
            {error && (
                <div style={{color: "#b00020"}}>
                    {error}
                </div>
            )}

            {!loading &&
                loaded &&
                !error &&
                neighbors.length === 0 && (
                    <div style={{opacity: 0.6}}>
                        No neighbors found.
                    </div>
                )}

            {neighbors.length > 0 && (
                <div className="results-grid">
                    {neighbors.map((neighbor) => (
                        <ResultItem
                            key={neighbor.id}
                            id={neighbor.id}
                            kind="video"
                            start={neighbor.start}
                            end={neighbor.end}
                            preload="none"
                            controls={false}
                            mediaClassName="ri-media"
                            getPosterSrc={() =>
                                neighbor.thumbUrl ?? ""
                            }
                            getVideoSrc={() =>
                                neighbor.url
                            }
                            caption={neighbor.name}
                            onBeforeOpen={() =>
                                openNeighbor(
                                    neighbor
                                )
                            }
                        />
                    ))}
                </div>
            )}
        </DisclosureSection>
    );
}