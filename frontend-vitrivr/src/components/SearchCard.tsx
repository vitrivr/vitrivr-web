"use client";
import {useEffect, useState} from "react";
import CardHeader from "./CardHeader";
import Card from "./Card";
import {type DropdownItem} from "./QueryBuilderComponents/Dropdown.tsx";
import "./QueryBuilderComponents/Dropdown.css";
import Button from "./QueryBuilderComponents/Button.tsx";
import {type RadioOption} from "./QueryBuilderComponents/RadioGroup.tsx";
import ResultItem from "./Results/ResultItem.tsx";
import {buildTextQuery, buildTemporalQuery, thumbnailUrl} from "../lib/vitrivr.ts";
import {retrieval} from "../api/client";
import "./Results/Results.css"
import Flash from "./QueryBuilderComponents/Flash.tsx";
import MediaTypeFilter from "./Results/MediaTypeFilter";
import QueryBlock from "./QueryBuilderComponents/QueryBlock";
import {useSearch} from "../state/SearchContext.tsx";
import SchemaSelector from "./SchemaSelector.tsx";

const DEFAULT_SCHEMA = import.meta.env.VITE_VITRIVR_SCHEMA || "vbs";

type QueryType = Extract<BlockState['queryType'], string>;
type Modality = "clip" | "emotions" | "ocr" | "asr";

const queryTypeItems =
    [
        {label: "Text", value: "text"},
        {label: "Image", value: "image"},
    ] as const satisfies RadioOption<QueryType>[];

type MediaKind = "image" | "video" | "custom";

type MediaItem = {
    id: string;
    kind: MediaKind;
    rawType?: string;
    url: string;
    start: number;
    end: number;
};

type RetrievablesResponse = {
    retrievables?: Array<{
        id?: string;
        type?: string;
        score?: number;
        parts?: unknown[];
        properties?: Record<string, unknown>;
        descriptors?: Record<string, unknown>;
    }>;
};

export type BlockState = {
    id: string;
    modality: Modality;
    emotion?: string;
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
    {value: "sad", label: "sad"},
    {value: "happy", label: "happy"},
    {value: "disgust", label: "disgust"},
    {value: "fear", label: "fear"},
    {value: "surprise", label: "surprise"},
    {value: "neutral", label: "neutral"},
];

const makeBlockState = (): BlockState => ({
    id: crypto.randomUUID(),
    modality: modalityOptions[0].value,
    emotion: undefined,
    queryType: "text",
    textQuery: "",
    file: null,
});

type PartOfRel = {
    descriptors?: Record<string, unknown>;
};
type Relationship = {
    partOf?: PartOfRel;
};

function pickStartTime(r: {
    descriptors?: Record<string, unknown>;
}): string | undefined {
    const start = r.descriptors?.["time.start"];
    console.log("start time: " + start);
    if (typeof start === "string" && start.trim()) return start;
    return undefined;
}

function pickEndTime(r: {
    descriptors?: Record<string, unknown>;
}): string | undefined {
    const end = r.descriptors?.["time.end"];
    console.log("start time: " + end);
    if (typeof end === "string" && end.trim()) return end;
    return undefined;
}

function pickFilePath(r: {
    descriptors?: Record<string, unknown>;
    relationship?: Relationship;
}): string | undefined {
    const local = r.descriptors?.["file.path"];
    console.log("id:", (r as any).id);// this is undefined
    console.log("local", local); // this is also undefined
    if (typeof local === "string" && local.trim()) return local;

    const parent = r.relationship?.partOf?.descriptors?.["file.path"];
    if (typeof parent === "string" && parent.trim()) return parent;

    return undefined;
}

// TODO: change this to schema relative
function toVbsRelative(path: string): string | undefined {
    const unixy = path.replace(/\\/g, "/");
    try {
        const normalized = new URL(unixy, "http://local").pathname;
        const i = normalized.indexOf("/vbs/");
        if (i === -1) return undefined;
        return normalized.slice(i + 1);
    } catch {
        return undefined;
    }
}

function encodePathSegments(p: string): string {
    return p.split("/").map(encodeURIComponent).join("/");
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

function mediaFrom(resp: RetrievablesResponse): MediaItem[] {
    const list = resp.retrievables ?? [];
    const mediaOrigin = import.meta.env.VITE_MEDIA_ORIGIN || "";

    return list
        .map((r) => {
            const id = r.id?.trim();
            if (!id) return null;

            const filePath = pickFilePath(r as any);
            const startString = pickStartTime(r);
            const start = Number.parseFloat(startString ?? "0") / 1_000_000_000;
            const endString = pickEndTime(r);
            const end = Number.parseFloat(endString ?? "0") / 1_000_000_000;

            let url = "";

            if (filePath) {
                const rel = toVbsRelative(filePath);
                if (rel) {
                    url = `${mediaOrigin}/${encodePathSegments(rel)}`;
                }
            }

            return {id, kind: mapTypeToKind(r.type), rawType: r.type, url, start, end};
        })
        .filter((v): v is MediaItem => v !== null && !!v.url);
}


export function SearchCard() {
    const {
        blocks, setBlocks,
        items, setItems,
        mediaFilter, setMediaFilter,
        raw, setRaw,
        setScrollY, scrollY,
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
    const [schema, setSchema] = useState<string>(DEFAULT_SCHEMA);
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

    const filteredItems = items.filter(i => mediaFilter[i.kind]);
    const addBlock = () =>
        updateBlocks(prev => [...prev, makeBlockState()]);
    const removeBlock = (id: string) =>
        updateBlocks(prev => prev.filter(b => b.id !== id));
    const patchBlock = (id: string, patch: Partial<BlockState>) =>
        updateBlocks(prev => prev.map(b => (b.id === id ? {...b, ...patch} : b)));

    const onSearch = async () => {
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

        try {
            let resp;

            if (blocks.length == 1) {
                const body = buildTextQuery(blocks[0].textQuery.trim());
                resp = await retrieval.postExecuteQuery(schema, body);
            } else {
                const body = buildTemporalQuery(blocks);
                resp = await retrieval.postExecuteQuery(schema, body);
                const pretty = JSON.stringify(resp, null, 2);
                setRaw(pretty.length > 100_000 ? pretty.slice(0, 100_000) + "\n…truncated…" : pretty);
            }
            const media = mediaFrom(resp as RetrievablesResponse);
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
        <div>
            <CardHeader
                actions={
                    <SchemaSelector
                        value={schema}
                        onChange={setSchema}
                    />
                }
            >
                <div style={{display: "grid", gridTemplateColumns: "56px 3fr", gap: 2, alignItems: "start"}}>
                    <div style={{position: "sticky", top: 8}}>
                        <button
                            type="button"
                            onClick={addBlock}
                            title="Add query block"
                            aria-label="Add query block"
                            style={{
                                width: 48, height: 48, borderRadius: 12, border: "1px solid #ddd",
                                fontSize: 24, cursor: "pointer", background: "#fff"
                            }}
                        >
                            +
                        </button>
                    </div>

                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                        gap: 1
                    }}>
                        {blocks.map((b) => (
                            <QueryBlock
                                key={b.id}
                                block={b}
                                onChange={(patch) => patchBlock(b.id, patch)}
                                onRemove={blocks.length > 1 ? () => removeBlock(b.id) : undefined}
                                modalityOptions={modalityOptions}
                                queryTypeItems={queryTypeItems}
                                emotionItems={emotionItems}
                            />
                        ))}

                    </div>
                </div>

                <Flash
                    show={flash.show}
                    kind="error"
                    onClose={() => setFlash({show: false, message: ""})}
                >
                    {flash.message}
                </Flash>

                <div style={{padding: 16}}>
                    <Button label={loading ? "Searching…" : "Search"} disabled={loading} onClick={onSearch}/>
                </div>
            </CardHeader>

            <CardHeader title="Results">
                {error && <div style={{color: "crimson", padding: 16}}>{error}</div>}
                {!error && loading && <div style={{padding: 16}}>Searching…</div>}
                {!error && !loading && items.length === 0 && (
                    <div style={{padding: 16, color: "#666"}}>No results yet—run a search.</div>
                )}

                <div
                    style={{
                        position: "sticky",
                        top: 8,
                        zIndex: 5,
                        padding: "0 16px 8px",
                        display: "flex",
                        justifyContent: "flex-end",
                    }}
                >
                    {items.length > 0 && (
                        <div style={{position: "relative"}}>
                            <button
                                type="button"
                                onClick={() => setFilterOpen(v => !v)}
                                aria-haspopup="dialog"
                                aria-expanded={filterOpen}
                                style={{
                                    height: 36,
                                    borderRadius: 2,
                                    border: "1px solid #ddd",
                                    background: "#fff",
                                    padding: "0 12px",
                                    cursor: "pointer",
                                }}
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
                    )}
                </div>

                <div className="results-grid">
                    {filteredItems.slice(0, 16).map(({id, kind, url, rawType}) => {
                        if (kind === "image") {
                            return (
                                <ResultItem
                                    key={id}
                                    id={id}
                                    mediaClassName="ri-media"
                                    getImageSrc={() => url ?? ""}
                                />
                            );
                        }

                        if (kind === "video") {
                            return (
                                <ResultItem
                                    key={id}
                                    id={id}
                                    mediaClassName="ri-media"
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

                {raw && (
                    <pre style={{padding: 2, background: "#fafafa", borderTop: "1px solid #eee", overflow: "auto"}}>
            {raw}
        </pre>
                )}
            </CardHeader>

        </div>
    );
}