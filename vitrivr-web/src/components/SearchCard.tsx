/**
 * SearchCard
 *
 * The main search interface for building queries, executing retrieval,
 * and displaying search results.
 *
 * Features:
 * - Supports single-block and multi-block query building
 * - Supports multiple modalities such as CLIP, emotions, OCR, and ASR
 * - Supports schema selection and schema-based restrictions
 * - Displays retrieved media results with filtering and pagination
 * - Stores raw API responses for debugging
 * - Supports keyboard shortcut submission with Ctrl/Cmd + Enter
 * - Saves vectors for later nearest-neighbor browsing
 *
 * Behavior:
 * - Validates query blocks before search
 * - Builds either a text, image, emotion, or temporal query
 * - Sends the query to the retrieval backend
 * - Maps backend retrievables into UI media items
 * - Stores clip vectors for later reuse
 * - Supports deduplicating video results when enabled
 * - Resets UI state and results through the reset action
 *
 * State and context:
 * - Uses `useSearch` for shared query, schema, result, and vector state
 * - Uses local state for loading, errors, flash messages, filters, and pagination
 *
 * Main helpers:
 * @param makeBlockState - Creates a default query block
 * @param dedupeVideos - Removes duplicate video results by file name
 * @param mediaFrom - Maps retrieval response items into displayable media items
 * @param truncateJson - Truncates raw JSON for debug display
 * @param resetAll - Clears query blocks, results, filters, and scroll state
 *
 * Example:
 * <SearchCard />
 *
 * Notes:
 * - Multi-block queries are executed as temporal queries
 * - Single-block queries may be text, image, or emotion queries
 * - Some schemas disable unsupported modalities such as ASR or emotions
 * - Raw responses are shown in a collapsible debug section
 */

"use client";
import {applyQueryFilters, emptyQueryFilters} from "../lib/queryFilters.ts";
import QueryScopeFilters from "./QueryBuilderComponents/QueryScopeFilters.tsx";
import {buildPersonQuery, selectedPersonNames} from "../lib/personQuery.ts";
import {useEffect, useRef, useState} from "react";
import {type DropdownItem} from "./QueryBuilderComponents/Dropdown.tsx";
import "./QueryBuilderComponents/Dropdown.css";
import {type RadioOption} from "./QueryBuilderComponents/RadioGroup.tsx";
import ResultsGrid from "./Results/ResultsGrid.tsx";
import {groupResultsByVideo} from "./Results/groupResults.ts";
import {buildTextQuery, buildTemporalQuery, buildSegmentMediaUrls, type VitrivrRetrievable} from "../lib/vitrivr.ts";
import {fileToBase64} from "../lib/helpers.ts";
import {retrieval} from "../vitirvr/api/client";
import "./Results/Results.css"
import Flash from "./QueryBuilderComponents/Flash.tsx";
import MediaTypeFilter from "./Results/MediaTypeFilter";
import QueryBlock from "./QueryBuilderComponents/QueryBlock";
import {buildHlsUrl, useSearch} from "../state/SearchContext.tsx";
import "./SearchCard.css"
import "../styles/styles.css"
import {makeBlockState} from "../state/makeBlockState.ts";
import {enabledQueryModalities, type Modality} from "../config/queryModalities.ts";


const PAGE_SIZE = 100;
const GROUP_PAGE_SIZE = 10;
const DEBUG = (import.meta.env.VITE_DEBUG ?? "").toString() === "1";
const RAW_TRUNCATE = 100_000;

type QueryType = Extract<BlockState['queryType'], string>;

const queryTypeItems =
    [
        {label: "Text", value: "text"},
        // {label: "Image", value: "image"}, TODO: add back in, as soon implemented!
    ] as const satisfies RadioOption<QueryType>[];

type MediaKind = "image" | "video" | "custom";

export type MediaItem = {
    searchRank?: number;
    id: string;
    kind: MediaKind;
    rawType?: string;
    parentId?: string;
    mediaItemName?: string;
    name: string;
    url: string;
    thumbUrl?: string;
    start: number;
    end: number;
    clipVector?: number[];
};


type RetrievablesResponse = {
    retrievables?: Array<{
        id?: string;
        type?: string;
        score?: number;
        relationship?: {
            partOf?: {
                id?: string;
                type?: string;
                descriptors?: Record<string, unknown>;
            };
        };
        descriptors?: Record<string, unknown>;
    }>;
};

export type EmotionTarget = "face" | "sound" | "ocr";

export type BlockState = {
    id: string;
    modality: Modality;
    personNames?: string[];
    emotion?: string;
    emotionTarget?: "face" | "sound" | "ocr";
    queryType: "text" | "image";
    textQuery: string;
    file: File | null;
};

const emotionItems: DropdownItem[] = [
    {value: "anger", label: "anger"},
    {value: "disgust", label: "disgust"},
    {value: "fear", label: "fear"},
    {value: "happy", label: "happy"},
    {value: "neutral", label: "neutral"},
    {value: "sad", label: "sad"},
    {value: "surprise", label: "surprise"},
];

function videoDedupeKey(item: MediaItem): string {
    if (item.kind !== "video") {
        return item.id;
    }
    return item.parentId ?? item.id;
}

function dedupeVideos(list: MediaItem[]): MediaItem[] {
    const seen = new Set<string>();
    const out: MediaItem[] = [];

    for (const it of list) {
        if (it.kind !== "video") {
            out.push(it);
            continue;
        }

        const key = videoDedupeKey(it);
        if (seen.has(key)) continue;

        seen.add(key);
        out.push(it);
    }

    return out;
}


function pickFloatArray(
    r: { descriptors?: Record<string, unknown> },
    key: string
): number[] | undefined {
    const v = r.descriptors?.[key];

    if (!Array.isArray(v)) return undefined;
    const out: number[] = [];
    for (const x of v) {
        if (typeof x !== "number" || !Number.isFinite(x)) return undefined;
        out.push(x);
    }
    return out;
}


function pickDescriptorScalar(r: { descriptors?: Record<string, unknown> }, key: string): number | undefined {
    const v = r.descriptors?.[key];

    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "bigint") return Number(v);
    if (typeof v === "string") {
        const s = v.trim();
        if (!s) return undefined;
        const n = Number(s);
        return Number.isFinite(n) ? n : undefined;
    }

    return undefined;
}

function nsToSecondsMaybe(x: number): number {
    return x / 1_000_000_000;
}

function debugLog(...args: any[]) {
    if (DEBUG) console.log("[SearchCard]", ...args);
}

function printVitrivrRequest(body: unknown) {
    try {
        const json = JSON.stringify(body, null, 2);
        console.log(
            "%c[Vitrivr Request]",
            "color: #4CAF50; font-weight: bold;"
        );
        console.log(json);
    } catch (e) {
        console.warn("[Vitrivr Request] failed to stringify", e, body);
    }
}


function truncateJson(x: unknown, limit = RAW_TRUNCATE): string {
    try {
        const s = JSON.stringify(x, null, 2);
        return s.length > limit ? s.slice(0, limit) + "\n…truncated…" : s;
    } catch (e) {
        return `<<failed to stringify: ${String(e)}>>`;
    }
}


function mapTypeToKind(t?: string): MediaKind {
    switch (t) {
        case "SOURCE:IMAGE":
            return "image";
        case "SEGMENT":
            return "video";
        default:
            return "custom";
    }
}

function mediaNameFromPath(path: unknown): string | undefined {
    if (typeof path !== "string" || !path.trim()) {
        return undefined;
    }
    const splitArray = path.split("/")
    const len = splitArray.length
    const filepath = splitArray[len-4] + "/" + splitArray[len-3] + "/" + splitArray[len-2] + "/" + splitArray[len-1];
    return filepath.toString();
}


function mediaFrom(resp: RetrievablesResponse): MediaItem[] {
    const list = (resp.retrievables ?? []) as VitrivrRetrievable[];
    const out = list.map((r, idx) => {
        const id = r.id?.trim();
        if (!id) return null;

        const kind = mapTypeToKind(r.type);
        const startRaw = pickDescriptorScalar(r as any, "time.start") ?? 0;
        const endRaw = pickDescriptorScalar(r as any, "time.end") ?? 0;
        const start = nsToSecondsMaybe(startRaw);
        const end = nsToSecondsMaybe(endRaw);

        if (kind === "video") {
            const parent = r.relationship?.partOf;
            const parentId = parent?.id?.trim();

            if (!parentId) {
                debugLog("drop: video segment without parent SOURCE:VIDEO id", {
                    idx,
                    id,
                    type: r.type,
                    r,
                });
                return null;
            }

            const filePath = parent?.descriptors?.["file.path"];
            const mediaItemName = mediaNameFromPath(filePath);
            const url = buildHlsUrl(parentId);
            const {thumbUrl} = buildSegmentMediaUrls(r);

            return {
                id,
                parentId,
                kind,
                rawType: r.type,
                url,
                thumbUrl,
                start,
                end,
                name: mediaItemName ?? parentId,
                mediaItemName,
                clipVector: pickFloatArray(r as any, "clip.vector"),
            };
        }

        return {
            id,
            kind,
            rawType: r.type,
            url: "",
            start,
            end,
            name: "",
            clipVector: pickFloatArray(r as any, "clip.vector"),
        };
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    return out.filter((v): v is MediaItem => v !== null && (v.kind !== "video" || !!v.url));
}


export function SearchCard() {
    const {
        blocks, setBlocks,
        queryFilters, setQueryFilters,
        resultView, setResultView,
        items, setItems,
        mediaFilter, setMediaFilter,
        raw, setRaw,
        setScrollY, scrollY, setVectorsById,
    } = useSearch();
    const [visibleCount, setVisibleCount] = useState(resultView === "video" ? GROUP_PAGE_SIZE : PAGE_SIZE);

    useEffect(() => {
        if (scrollY > 0) {
            requestAnimationFrame(() => window.scrollTo(0, scrollY));
        }
    }, [scrollY]);

    function updateBlocks(recipe: (prev: BlockState[]) => BlockState[]) {
        setBlocks(prev => {
            const next = recipe(prev);
            return next.length === 0 ? [makeBlockState(schema)] : next;
        });
    }

    const [flash, setFlash] = useState<{ show: boolean; message: string }>({show: false, message: ""});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filterOpen, setFilterOpen] = useState(false);
    const {
        schema,
        setSchema,
    } = useSearch();

    const modalityOptions = enabledQueryModalities(schema);

    const counts = {
        image: items.filter(i => i.kind === "image").length,
        video: items.filter(i => i.kind === "video").length,
        custom: items.filter(i => i.kind === "custom").length,
    };

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem("vitrivr_schema");
            if (stored) {
                setSchema(stored);
            }
        } catch {
            // ignore
        }
    }, []);

    // Assign ranks before filtering/grouping so badges always refer to the original result order.
    let filteredItems: MediaItem[] = items.map((item, index) => ({...item, searchRank: item.searchRank ?? index + 1}))
        .filter(i => mediaFilter[i.kind]);

    if (mediaFilter.uniqueVideos && resultView === "ranked") {
        filteredItems = dedupeVideos(filteredItems);
    }
    const resultGroups = resultView === "video" ? groupResultsByVideo(filteredItems) : [];
    const navigationCount = resultView === "video" ? resultGroups.length : filteredItems.length;
    const pageSize = resultView === "video" ? GROUP_PAGE_SIZE : PAGE_SIZE;
    const addBlock = () =>
        updateBlocks(prev => [...prev, makeBlockState(schema)]);
    const removeBlock = (id: string) =>
        updateBlocks(prev => prev.filter(b => b.id !== id));
    const patchBlock = (id: string, patch: Partial<BlockState>) =>
        updateBlocks(prev => prev.map(b => (b.id === id ? {...b, ...patch} : b)));

    const resetAll = () => {
        setVisibleCount(pageSize);
        setLoading(false);
        setError(null);
        setFlash({show: false, message: ""});
        setFilterOpen(false);
        setItems([]);
        setRaw("");
        setVectorsById({}); // not sure if keep this

        setBlocks([makeBlockState(schema)]);
        setQueryFilters(emptyQueryFilters());

        setScrollY(0);
        window.scrollTo(0, 0);
    };


    const onSearchRef = useRef<() => void>(() => {});
    onSearchRef.current = () => {void onSearch();};

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            // Ctrl+Enter on Windows/Linux, Cmd+Enter on macOS
            const isSubmitCombo = (e.ctrlKey || e.metaKey) && e.key === "Enter";
            if (!isSubmitCombo) return;

            // optional guardrails
            if (loading) return;
            if (filterOpen) return;
            if (e.altKey || e.shiftKey) return;

            e.preventDefault();
            onSearchRef.current();
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [loading, filterOpen]);

    const onSearch = async () => {
        if (blocks.some(block => !modalityOptions.some(option => option.value === block.modality))) {
            setFlash({show: true, message: "Select a query type enabled in the frontend settings and supported by this schema."});
            return;
        }
        setVisibleCount(pageSize);
        for (const b of blocks) {
            if (b.modality === "person") {
                if (selectedPersonNames(b).length === 0) {
                    setFlash({show: true, message: "Please select at least one person in each Person block."});
                    return;
                }
                continue;
            }
            const isTextQuery = b.queryType === "text";
            const isEmotion = b.modality === "emotions";
            const needsText = isTextQuery || isEmotion;

            if (needsText) {
                const txt = (b.textQuery ?? "").trim();
                if (txt.length === 0) {
                    setFlash({
                        show: true,
                        message: "Please fill in all text queries before searching."
                    });
                    return;
                }
            }

            if (!needsText && !b.file) {
                setFlash({
                    show: true,
                    message: "Please attach images for image query blocks."
                });
                return;
            }
        }

        setLoading(true);
        setError(null);
        setItems([]);
        setRaw("");
        setFlash({show: false, message: ""});


        const upperSchema = (schema ?? "").toUpperCase();
        const restrict = upperSchema === "LHE" || upperSchema === "MVK";

        if (restrict) {
            for (const b of blocks) {
                if (b.modality === "emotions" || b.modality === "asr") {
                    setFlash({show: true, message: `Schema ${upperSchema} does not support Emotions or ASR queries.`});
                    return;
                }
            }
        }


        try {
            let resp;

            if (blocks.length == 1) {
                const b = blocks[0];

                if (b.modality === "person") {
                    const body = buildPersonQuery(selectedPersonNames(b));
                    // @ts-expect-error Generated operator inputs omit named references.
                    resp = await retrieval.postExecuteQuery(schema, applyQueryFilters(body, queryFilters));
                } else if (b.modality === "emotions") {
                    const chosen = (b.emotion ?? "").trim();
                    if (!chosen) {
                        setFlash({show: true, message: "Please select an emotion."});
                        return;
                    }
                    const body = buildTextQuery("emotions", "", chosen, b.emotionTarget);
                    console.log("Building emotions query")
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-expect-error
                    resp = await retrieval.postExecuteQuery(schema, applyQueryFilters(body, queryFilters));

                } else if (b.queryType === "image") {
                    const base64image = await fileToBase64(b.file);
                    const body = buildTextQuery(b.modality, base64image);
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-expect-error
                    resp = await retrieval.postExecuteQuery(schema, applyQueryFilters(body, queryFilters));

                } else {
                    const body = buildTextQuery(b.modality.trim(), b.textQuery.trim());
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-expect-error
                    resp = await retrieval.postExecuteQuery(schema, applyQueryFilters(body, queryFilters));
                }

            } else {
                const body = buildTemporalQuery(blocks);
                console.log("creating temporal query");
                printVitrivrRequest(body);
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                resp = await retrieval.postExecuteQuery(schema, applyQueryFilters(body, queryFilters));
            }

            const pretty = truncateJson(resp);
            setRaw(pretty);

            debugLog("query response (truncated)", pretty);

            const media = mediaFrom(resp as RetrievablesResponse);
            const rawCount =
                (resp as RetrievablesResponse)?.retrievables?.length ?? 0;

            if (rawCount === 0) {
                setFlash({
                    show: true,
                    message: "No results found for this query.",
                });
            } else if (media.length === 0) {
                setFlash({
                    show: true,
                    message: "Results were found, but none could be displayed.",
                });
            }

            console.log(`[Search] got ${media.length} results`);

            setVectorsById((prev) => {
                const next = {...prev};
                for (const m of media) {
                    if (m.clipVector && m.clipVector.length > 0) {
                        next[m.id] = m.clipVector;
                    }
                }
                return next;
            });

            setItems(media);
            console.log(media.at(-1)?.id) // this is the wrong id, we need the parent id
            setLoading(false);
        } catch (err) {
            console.log(String(err))
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };
    const beforeNavigate = () => setScrollY(window.scrollY);

    return (
        <div className="sc-search">
            <div className="sc-page">
                <div className="sc-workspace">
                    <section className="panel sc-queryPanel" aria-label="Query Builder">
                        <div className="panel__head row-between">
                            <h2 className="panel__title">Query Builder</h2>
                            <span className="sc-count">{blocks.length} block{blocks.length === 1 ? "" : "s"}</span>
                        </div>
                        <div className="panel__body stack">
                            <QueryScopeFilters value={queryFilters} onChange={setQueryFilters}/>
                            <div className="sc-blockGrid">
                                {blocks.map((b) => (
                                    <QueryBlock
                                        key={b.id}
                                        block={b}
                                        onChange={(patch) => patchBlock(b.id, patch)}
                                        onRemove={blocks.length > 1 ? () => removeBlock(b.id) : undefined}
                                        modalityOptions={modalityOptions}
                                        queryTypeItems={queryTypeItems}
                                        emotionItems={emotionItems}
                                        schema={schema}
                                    />
                                ))}
                            </div>

                            <Flash
                                show={flash.show}
                                kind="error"
                                onClose={() => setFlash({show: false, message: ""})}
                            >
                                {flash.message}
                            </Flash>

                            <div className="stack sc-queryActions">
                                <button className="btn sc-addBlock" type="button" disabled={modalityOptions.length === 0} onClick={addBlock}>+ Add query block</button>
                                <button className="btn btn-primary" disabled={loading || modalityOptions.length === 0} onClick={onSearch}>
                                    <span>{loading ? "Searching…" : "Search"}</span>
                                    <span className="sc-shortcut">Ctrl / ⌘ ↵</span>
                                </button>
                                <button className="btn sc-reset" type="button" onClick={resetAll}
                                    disabled={loading && items.length === 0 && raw === ""}>Reset</button>
                            </div>
                        </div>
                    </section>

                    <section className="panel sc-resultsPanel" aria-label="Results" aria-busy={loading}>
                            <div className="panel__head row-between">
                                <div className="stack-xs">
                                    <h2 className="panel__title">Results <span className="sc-resultCount" role="status">{filteredItems.length} results</span></h2>
                                </div>

                                <div className="sc-resultsControls">
                                    <label className="sc-viewSelect">
                                        View
                                        <select value={resultView} onChange={(event) => {
                                            const view = event.target.value === "video" ? "video" : "ranked";
                                            setResultView(view);
                                            setVisibleCount(view === "video" ? GROUP_PAGE_SIZE : PAGE_SIZE);
                                        }}>
                                            <option value="ranked">Ranked grid</option>
                                            <option value="video">By video</option>
                                        </select>
                                    </label>
                                <div style={{position: "relative"}}>
                                    <button
                                        type="button"
                                        onClick={() => setFilterOpen((v) => !v)}
                                        aria-haspopup="dialog"
                                        aria-expanded={filterOpen}
                                        className="btn"
                                    >
                                        Filter{(mediaFilter.image && mediaFilter.video && mediaFilter.custom) ? "" : " •"}
                                    </button>

                                    <MediaTypeFilter
                                        open={filterOpen}
                                        value={mediaFilter}
                                        counts={counts}
                                        grouped={resultView === "video"}
                                        onChange={setMediaFilter}
                                        onClose={() => setFilterOpen(false)}
                                    />
                                </div>
                                </div>
                            </div>

                            <div className="panel__body stack">
                                {error && <div className="alert alert--error">{error}</div>}

                                {filteredItems.length === 0 && (
                                    <div className="sc-empty" role="status">
                                        <span className="sc-emptyIcon" aria-hidden="true">⌕</span>
                                        <h3>{loading ? "Searching your collection…" : items.length ? "No matching media" : raw ? "No results found" : "Explore your collection"}</h3>
                                        <p>{loading ? "Results will appear here when your search is ready." : items.length ? "Adjust the media filters to see more results." : "Choose a schema and modality, then enter a query to find matching media."}</p>
                                    </div>
                                )}
                                {resultView === "video" ? (
                                    <div className="sc-videoGroups">
                                        {resultGroups.slice(0, visibleCount).map(group => (
                                            <section className="sc-videoGroup" key={group.key} aria-label={group.label}>
                                                <div className="sc-videoGroupHeading">
                                                    <h3 title={group.label}>{group.label}</h3>
                                                    <span>{group.items.length} match{group.items.length === 1 ? "" : "es"}</span>
                                                </div>
                                                <ResultsGrid items={group.items} beforeNavigate={beforeNavigate}/>
                                            </section>
                                        ))}
                                    </div>
                                ) : <ResultsGrid items={filteredItems.slice(0, visibleCount)} beforeNavigate={beforeNavigate}/>}

                                {navigationCount > visibleCount && (
                                    <div className="row" style={{justifyContent: "center"}}>
                                        <button className="btn" onClick={() => setVisibleCount((v) => v + pageSize)}>
                                            Show more
                                        </button>
                                    </div>
                                )}

                                {navigationCount > pageSize && (
                                    <div className="row" style={{justifyContent: "center"}}>
                                        {navigationCount > visibleCount && (
                                            <button className="btn btn-ghost"
                                                    onClick={() => setVisibleCount(navigationCount)}>
                                                Show all
                                            </button>
                                        )}
                                        {visibleCount > pageSize && (
                                            <button className="btn btn-ghost"
                                                    onClick={() => setVisibleCount(pageSize)}>
                                                Show less
                                            </button>
                                        )}
                                    </div>
                                )}

                                {raw && (
                                    <details className="sc-raw">
                                        <summary>Raw response</summary>
                                        <pre>{raw}</pre>
                                    </details>
                                )}
                            </div>
                        </section>
                </div>
            </div>
        </div>
    );
}
