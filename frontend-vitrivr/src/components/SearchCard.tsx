"use client";
import {useEffect, useState} from "react";
import {type DropdownItem} from "./QueryBuilderComponents/Dropdown.tsx";
import "./QueryBuilderComponents/Dropdown.css";
import {type RadioOption} from "./QueryBuilderComponents/RadioGroup.tsx";
import ResultItem from "./Results/ResultItem.tsx";
import {
    buildTextQuery,
    buildTemporalQuery,
    fileToBase64,
    buildSegmentMediaUrls,
    type VitrivrRetrievable
} from "../lib/vitrivr.ts";
import {retrieval} from "../vitirvr/api/client";
import "./Results/Results.css"
import Flash from "./QueryBuilderComponents/Flash.tsx";
import MediaTypeFilter from "./Results/MediaTypeFilter";
import QueryBlock from "./QueryBuilderComponents/QueryBlock";
import {useSearch} from "../state/SearchContext.tsx";
import SchemaSelector from "./SchemaSelector.tsx";
import "./SearchCard.css"
import "../styles/styles.css"
import {uuid} from "../utils/uuid";


const DEFAULT_SCHEMA = import.meta.env.VITE_VITRIVR_SCHEMA;
const PAGE_SIZE = 100;
const DEBUG = (import.meta.env.VITE_DEBUG ?? "").toString() === "1";
const RAW_TRUNCATE = 100_000;

type QueryType = Extract<BlockState['queryType'], string>;
type Modality = "clip" | "emotions" | "ocr" | "asr";

const queryTypeItems =
    [
        {label: "Text", value: "text"},
        // {label: "Image", value: "image"}, TODO: add back in, as soon implemented!
    ] as const satisfies RadioOption<QueryType>[];

type MediaKind = "image" | "video" | "custom";


type MediaItem = {
    id: string;
    kind: MediaKind;
    rawType?: string;
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
    emotion?: string;
    emotionTarget?: "face" | "sound" | "ocr";
    queryType: "text" | "image";
    textQuery: string;
    file: File | null;
};

const modalityOptions =
    [
        {value: "clip", label: "CLIP"},
        {value: "emotions", label: "Emotions"},
        {value: "ocr", label: "OCR"},
        {value: "asr", label: "ASR"},
    ] as const satisfies RadioOption<Modality>[];

const emotionItems: DropdownItem[] = [
    {value: "anger", label: "anger"},
    {value: "disgust", label: "disgust"},
    {value: "fear", label: "fear"},
    {value: "happy", label: "happy"},
    {value: "neutral", label: "neutral"},
    {value: "sad", label: "sad"},
    {value: "surprise", label: "surprise"},
];

const makeBlockState = (): BlockState => ({
    id: uuid(),
    modality: modalityOptions[0].value,
    emotion: undefined,
    emotionTarget: "face",
    queryType: "text",
    textQuery: "",
    file: null,
});

function videoDedupeKey(item: MediaItem): string {
    try {
        const u = new URL(item.url);
        const parts = u.pathname.split("/");
        return parts[parts.length - 1] ?? item.id;
    } catch {
        const parts = (item.url ?? "").split("/");
        return parts[parts.length - 1] ?? item.id;
    }
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


function pickDescriptorScalar(
    r: { descriptors?: Record<string, unknown> },
    key: string
): number | undefined {
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


function mediaFrom(schema: string, resp: RetrievablesResponse): MediaItem[] {
    const list = (resp.retrievables ?? []) as VitrivrRetrievable[];
    console.log("Length of Results is", list.length);

    const out = list.map((r, idx) => {
        const id = r.id?.trim();
        if (!id) return null;

        const kind = mapTypeToKind(r.type);

        const startRaw = pickDescriptorScalar(r as any, "time.start") ?? 0;
        const endRaw = pickDescriptorScalar(r as any, "time.end") ?? 0;
        const start = nsToSecondsMaybe(startRaw);
        const end = nsToSecondsMaybe(endRaw);

        if (kind === "video") {
            const {url, thumbUrl} = buildSegmentMediaUrls(schema, r);

            if (!url) {
                debugLog("drop: video without file.path", {idx, id, type: r.type, r});
                return null;
            }

            return {
                id,
                kind,
                rawType: r.type,
                url,
                thumbUrl,
                start,
                end,
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
            clipVector: pickFloatArray(r as any, "clip.vector"),
        };
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    return out.filter((v): v is MediaItem => v !== null && (v.kind !== "video" || !!v.url));
}


export function SearchCard() {
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const {
        blocks, setBlocks,
        items, setItems,
        mediaFilter, setMediaFilter,
        raw, setRaw,
        setScrollY, scrollY, setVectorsById,
    } = useSearch();

    useEffect(() => {
        if (scrollY > 0) {
            requestAnimationFrame(() => window.scrollTo(0, scrollY));
        }
    }, [scrollY]);

    function updateBlocks(recipe: (prev: BlockState[]) => BlockState[]) {
        setBlocks(prev => {
            const next = recipe(prev);
            return next.length === 0 ? [makeBlockState()] : next;
        });
    }

    const [flash, setFlash] = useState<{ show: boolean; message: string }>({show: false, message: ""});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filterOpen, setFilterOpen] = useState(false);
    const [schema, setSchema] = useState<string>(() => {
        try {
            return window.localStorage.getItem("vitrivr_schema")
                ?? DEFAULT_SCHEMA
                ?? "";
        } catch {
            return DEFAULT_SCHEMA ?? "";
        }
    });
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

    let filteredItems = items.filter(i => mediaFilter[i.kind]);

    if (mediaFilter.uniqueVideos) {
        filteredItems = dedupeVideos(filteredItems);
    }
    const addBlock = () =>
        updateBlocks(prev => [...prev, makeBlockState()]);
    const removeBlock = (id: string) =>
        updateBlocks(prev => prev.filter(b => b.id !== id));
    const patchBlock = (id: string, patch: Partial<BlockState>) =>
        updateBlocks(prev => prev.map(b => (b.id === id ? {...b, ...patch} : b)));

    const onSearch = async () => {
        setVisibleCount(PAGE_SIZE);
        for (const b of blocks) {
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

                if (b.modality === "emotions") {
                    const chosen = (b.emotion ?? "").trim();
                    if (!chosen) {
                        setFlash({show: true, message: "Please select an emotion."});
                        return;
                    }
                    const body = buildTextQuery("emotions", "", chosen, b.emotionTarget);
                    console.log("Building emotions query")
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-expect-error
                    resp = await retrieval.postExecuteQuery(schema, body);

                } else if (b.queryType === "image") {
                    const base64image = await fileToBase64(b.file);
                    const body = buildTextQuery(b.modality, base64image);
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-expect-error
                    resp = await retrieval.postExecuteQuery(schema, body);

                } else {
                    const body = buildTextQuery(b.modality.trim(), b.textQuery.trim());
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-expect-error
                    resp = await retrieval.postExecuteQuery(schema, body);
                }

            } else {
                const body = buildTemporalQuery(blocks);
                console.log("creating temporal query");
                printVitrivrRequest(body);
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                resp = await retrieval.postExecuteQuery(schema, body);
            }

            const pretty = truncateJson(resp);
            setRaw(pretty);

            debugLog("query response (truncated)", pretty);

            const media = mediaFrom(schema, resp as RetrievablesResponse);
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
        <div className="layout">
            <div className="sc-page">
                <div className="stack">
                    {/* Title card */}
                    <section className="panel">
                        <div className="panel__head row-between">
                            <div className="stack-xs">
                                <h2 className="panel__title">Search</h2>
                                <p className="panel__subtitle">
                                    Build a query and retrieve items from the selected schema.
                                </p>
                            </div>

                            <div className="row">
                                <span className="muted" style={{fontSize: 12}}>Schema</span>
                                <SchemaSelector value={schema} onChange={setSchema}/>
                            </div>
                        </div>
                    </section>

                    {/* Query card */}
                    <section className="panel sc-queryPanel">
                        <div className="panel__head row-between">
                            <div className="stack-xs">
                                <h3 className="panel__title">Query Builder</h3>
                                <p className="panel__subtitle">
                                    {blocks.length} block{blocks.length === 1 ? "" : "s"}
                                </p>
                            </div>

                            <button
                                className="btn icon-btn btn-tooltip"
                                type="button"
                                onClick={addBlock}
                                aria-label="Add query block"
                                title="Add a new query block"
                                data-tooltip="Add a new query block"
                            >
                                +
                            </button>

                        </div>

                        <div className="panel__body stack">
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

                            <div className="row-between">
                                <button className="btn btn-primary" disabled={loading} onClick={onSearch}>
                                    {loading ? "Searching…" : "Search"}
                                </button>

                                <span className="muted" style={{fontSize: 12}}>
            </span>
                            </div>
                        </div>
                    </section>

                    {/* Results card (ONLY when there are results) */}
                    {filteredItems.length > 0 && (
                        <section className="panel">
                            <div className="panel__head row-between">
                                <div className="stack-xs">
                                    <h3 className="panel__title">Results</h3>
                                </div>

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
                                        onChange={setMediaFilter}
                                        onClose={() => setFilterOpen(false)}
                                    />
                                </div>
                            </div>

                            <div className="panel__body stack">
                                {error && <div className="alert alert--error">{error}</div>}

                                <div className="results-grid sc-resultsGrid">
                                    {filteredItems.slice(0, visibleCount).map(({
                                                                                   id,
                                                                                   kind,
                                                                                   url,
                                                                                   thumbUrl,
                                                                                   rawType,
                                                                                   start,
                                                                                   end
                                                                               }) => {
                                        if (kind === "image") {
                                            return (
                                                <ResultItem
                                                    key={id}
                                                    id={id}
                                                    kind="image"
                                                    mediaClassName="ri-media"
                                                    // getImageSrc={() => url}
                                                    onBeforeOpen={beforeNavigate}
                                                />
                                            );
                                        }

                                        if (kind === "video") {
                                            return (
                                                <ResultItem
                                                    key={id}
                                                    id={id}
                                                    kind="video"
                                                    start={start}
                                                    end={end}
                                                    preload="none"
                                                    controls={false}
                                                    mediaClassName="ri-media"
                                                    getPosterSrc={() => thumbUrl ?? ""}
                                                    getVideoSrc={() => url}
                                                    onBeforeOpen={beforeNavigate}
                                                />
                                            );
                                        }

                                        return (
                                            <ResultItem
                                                key={id}
                                                id={id}
                                                kind="custom"
                                                onBeforeOpen={beforeNavigate}
                                                renderMedia={() => (
                                                    <div className="sb__unknown">
                                                        <div className="sb__caption">Type: {rawType ?? "unknown"}</div>
                                                    </div>
                                                )}
                                            />
                                        );
                                    })}
                                </div>

                                {filteredItems.length > visibleCount && (
                                    <div className="row" style={{justifyContent: "center"}}>
                                        <button className="btn" onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}>
                                            Show more
                                        </button>
                                    </div>
                                )}

                                {filteredItems.length > PAGE_SIZE && (
                                    <div className="row" style={{justifyContent: "center"}}>
                                        {filteredItems.length > visibleCount && (
                                            <button className="btn btn-ghost"
                                                    onClick={() => setVisibleCount(filteredItems.length)}>
                                                Show all
                                            </button>
                                        )}
                                        {visibleCount > PAGE_SIZE && (
                                            <button className="btn btn-ghost"
                                                    onClick={() => setVisibleCount(PAGE_SIZE)}>
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
                    )}
                </div>
            </div>
        </div>
    );
}
