"use client";
import {useState} from "react";
import Card from "./Card";
import {type DropdownItem} from "./QueryBuilderComponents/Dropdown.tsx";
import "./QueryBuilderComponents/Dropdown.css";
import Button from "./QueryBuilderComponents/Button.tsx";
import {type RadioOption} from "./QueryBuilderComponents/RadioGroup.tsx";
import ResultItem from "./Results/ResultItem.tsx";
import {buildTextQuery, buildTemporalQuery} from "../lib/vitrivr.ts";
import {retrieval} from "../api/client";
import "./Results/Results.css"
import Flash from "./QueryBuilderComponents/Flash.tsx";
import MediaTypeFilter, {type MediaFilter} from "./Results/MediaTypeFilter";
import QueryBlock from "./QueryBuilderComponents/QueryBlock";

const SCHEMA = import.meta.env.VITE_VITRIVR_SCHEMA || "sandbox";

type MediaKind = "image" | "video" | "custom";
type MediaItem = { id: string; kind: MediaKind; rawType?: string; url?: string };
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
    modality: string;
    emotion?: string;
    queryType: "text" | "image";
    textQuery: string;
    file: File | null;
};

const modalityOptions: RadioOption[] = [
    {value: "clip", label: "CLIP"},
    {value: "emotions", label: "Emotions"},
    {value: "ocr", label: "OCR"},
    {value: "asr", label: "ASR"},
];

const queryTypeItems: DropdownItem[] = [
    {value: "text", label: "Textual Query"},
    {value: "image", label: "Image Query"},
];

const emotionItems: DropdownItem[] = [
    {value: "sad", label: "sad"},
    {value: "happy", label: "happy"},
    {value: "neutral", label: "neutral"},
];

const makeBlockState = (): BlockState => ({
    id: crypto.randomUUID(),
    modality: modalityOptions[0].value,
    emotion: undefined, queryType: "text", textQuery: "", file: null,
});

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
    return list
        .map((r) => {
            const id = r.id?.trim();
            if (!id) return null;
            const filePath = (r as any).descriptors?.["file.path"];
            let url: string | undefined;
            if (filePath && typeof filePath === "string") {
                const relative = filePath.split("/sandbox/")[1];
                if (relative) url = `/sandbox/${relative}`;
            }

            return {id, kind: mapTypeToKind(r.type), rawType: r.type, url};
        })
        .filter((v): v is MediaItem => !!v);
}


export default function SearchCard() {
    const [flash, setFlash] = useState<{ show: boolean; message: string }>({show: false, message: ""});
    const [blocks, setBlocks] = useState<BlockState[]>([makeBlockState()]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<MediaItem[]>([]);
    const [raw, setRaw] = useState<string>("");
    const [filterOpen, setFilterOpen] = useState(false);
    const [mediaFilter, setMediaFilter] = useState<MediaFilter>({image: true, video: true, custom: true});
    const counts = {
        image: items.filter(i => i.kind === "image").length,
        video: items.filter(i => i.kind === "video").length,
        custom: items.filter(i => i.kind === "custom").length,
    };

    const filteredItems = items.filter(i => mediaFilter[i.kind]);
    const addBlock = () => setBlocks((prev) => [makeBlockState(), ...prev]);
    const removeBlock = (id: string) => setBlocks((prev) => prev.filter((b) => b.id !== id));
    const patchBlock = (id: string, patch: Partial<BlockState>) =>
        setBlocks((prev) => prev.map((b) => (b.id === id ? {...b, ...patch} : b)));

    const onSearch = async () => {
        for (const b of blocks) {
            const isText = b.queryType === "text" || b.modality === "emotions";
            if (isText && !b.textQuery.trim()) {
                setFlash({show: true, message: "Please fill all text queries before searching."});
                return;
            }
            if (!isText && !b.file) {
                setFlash({show: true, message: "Please attach images for image query blocks."});
                return;
            }
        }

        setLoading(true);
        setError(null);
        setItems([]);
        setRaw("");
        setFlash({show: false, message: ""});

        try {
            if (blocks.length == 1) {
                const body = buildTextQuery(blocks[0].textQuery.trim());
                const resp = await retrieval.postExecuteQuery(SCHEMA, body);
                const media = mediaFrom(resp as RetrievablesResponse);
                setItems(media);
                return;
            }
            // Build ONE request body out of many blocks
            const body = buildTemporalQuery(blocks);

            // If you need mixed text+image, split into multiple backend calls here and merge results.
            const resp = await retrieval.postExecuteQuery(SCHEMA, body);
            const media = mediaFrom(resp as RetrievablesResponse);
            setItems(media);
            //const pretty = JSON.stringify(resp, null, 2);
            //setRaw(pretty.length > 100_000 ? pretty.slice(0, 100_000) + "\n…truncated…" : pretty);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <Card title="Query Builder" actions={<div>schema: <code>{SCHEMA}</code></div>}>
                <div style={{display: "grid", gridTemplateColumns: "56px 1fr", gap: 16, alignItems: "start"}}>
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
                        gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
                        gap: 16
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
            </Card>

            <Card title="Results">
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
                    <div style={{position: "relative"}}>
                        <button
                            type="button"
                            onClick={() => setFilterOpen(v => !v)}
                            aria-haspopup="dialog"
                            aria-expanded={filterOpen}
                            style={{
                                height: 36,
                                borderRadius: 12,
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
                </div>


                <div className="results-grid">
                    {filteredItems.slice(0, 16).map(({id, kind, url, rawType}) => {
                        if (kind === "image") {
                            return (
                                <ResultItem
                                    key={id}
                                    id={id}
                                    kind="image"
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
                                    kind="video"
                                    mediaClassName="ri-media"
                                />
                            );
                        }
                        return (
                            <ResultItem
                                key={id}
                                id={id}
                                kind="custom"
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
                    <pre style={{padding: 16, background: "#fafafa", borderTop: "1px solid #eee", overflow: "auto"}}>
            {raw}
          </pre>
                )}
            </Card>
        </div>
    );
}