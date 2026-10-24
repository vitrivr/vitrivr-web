import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {applyQueryFilters} from "../../lib/queryFilters.ts";
import {buildVectorQuery, thumbnailURL,} from "../../lib/vitrivr";
import {buildHlsUrl, useSearch} from "../../state/SearchContext";
import {retrieval} from "../../vitirvr/api/client";
import ResultItem from "../Results/ResultItem";
import {mapNeighborResults} from "./neighborResults.ts";
import DisclosureSection from "./DisclosureHeader.tsx";
import type {MediaItem} from "../SearchCard.tsx";


type NearestNeighborsProps = {
    id: string;
    queryVector: number[] | null;
    onResultsChange: (hasResults: boolean) => void;
};

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

/**
 * Section for the nearest neighbor search results of a video thumbnail. The results get displayed in a grid and each results
 * has a pink submit button for DRES. The results are clickable. If you click on a result the video is openend
 * and can be watched and the nearest neighbor search results of that video are again displayed.
 */
export default function NearestNeighbor({id, queryVector, onResultsChange}: NearestNeighborsProps) {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [neighbors, setNeighbors] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const {schema, queryFilters, setVectorsById, setItems} = useSearch();

    useEffect(() => {
        setOpen(false);
        setNeighbors([]);
        setLoaded(false);
        setLoading(false);
        setError(null);
    }, [id]);

    useEffect(() => {
        if (!queryVector?.length) {
            setNeighbors([]);
            setLoaded(false);
            setLoading(false);
            setError(null);
            onResultsChange(false);
            return;
        }

        let cancelled = false;

        async function loadNeighbors() {
            setLoading(true);
            setLoaded(false);
            setError(null);
            setOpen(true);

            setNeighbors([]); // set the neighbors to none, such that during the search no results appear.
            onResultsChange?.(false);

            try {
                const body = buildVectorQuery(queryVector!, 1000);

                // @ts-expect-error Generated operator input types omit named references.
                const response = await retrieval.postExecuteQuery(schema, applyQueryFilters(body, queryFilters));
                if (cancelled) return;

                const mapped = mapNeighborResults(response, {video: buildHlsUrl, thumbnail: thumbnailURL}).filter(
                    (neighbor) => neighbor.id !== id
                );
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
                const hasResults = mapped.length > 0;
                onResultsChange?.(hasResults);
                if (hasResults) {
                    setOpen(true);
                }
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
        queryVector,
        id,
        schema,
        queryFilters,
        setVectorsById,
        onResultsChange,
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

    if (loading) {
        return <div className="vp-message" role="status">Loading nearest neighbors…</div>;
    }

    if (error) {
        return <div className="vp-message vp-message--error" role="alert">{error}</div>;
    }

    if (loaded && neighbors.length === 0) {
        return <div className="vp-message" role="status">No nearest neighbors found.</div>;
    }

    if (neighbors.length === 0) {
        return null;
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
                <div className="vp-message vp-message--error">
                    {error}
                </div>
            )}

            <div className="results-grid">
                {neighbors.map((neighbor) => (
                    <ResultItem
                        key={neighbor.id}
                        id={neighbor.id}
                        kind="video"
                        mediaItemName={neighbor.mediaItemName ?? videoNameFromUrl(neighbor.url)}
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
        </DisclosureSection>
    );
}