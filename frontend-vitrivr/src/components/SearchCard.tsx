"use client";
import {useMemo, useState} from "react";
import Card from "./Card";
import Dropdown, {type DropdownItem} from "./QueryBuilderComponents/Dropdown.tsx";
import "./QueryBuilderComponents/Dropdown.css";
import Button from "./QueryBuilderComponents/Button.tsx";
import Input from "./QueryBuilderComponents/Input.tsx";
import RadioGroup, {type RadioOption} from "./QueryBuilderComponents/RadioGroup.tsx";
import ResultItem from "./Results/ResultItem.tsx";
import {buildTextQuery} from "../lib/vitrivr.ts";
import {retrieval} from "../api/client";
import "./Results/Results.css"

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

const modalityOptions: RadioOption[] = [
    {value: "clip", label: "CLIP"},
    {value: "emotions", label: "Emotions"},
    {value: "ocr", label: "OCR"},
    {value: "asr", label: "ASR"},
];

const emotionItems: DropdownItem[] = [
    {value: "sad", label: "sad"},
    {value: "happy", label: "happy"},
    {value: "neutral", label: "neutral"},
];

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
    // builder state
    const [modality, setModality] = useState<string>(modalityOptions[0].value);
    const [emotion, setEmotion] = useState<string | undefined>(undefined);
    const [textQuery, setTextQuery] = useState<string>("");

    // results state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<MediaItem[]>([]);
    const [raw, setRaw] = useState<string>("");

    const onSearch = async () => {
        if (!textQuery.trim()) return;

        setLoading(true);
        setError(null);
        setItems([]);
        setRaw("");

        try {
            const body = buildTextQuery(textQuery.trim());
            const resp = await retrieval.postExecuteQuery(SCHEMA, body);
            //setRaw(JSON.stringify(resp, null, 2)); // debugging
            const media = mediaFrom(resp as RetrievablesResponse);
            setItems(media);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };
    const images = useMemo(() => items.filter(i => i.kind === "image").slice(0, 10), [items]);
    const videos = useMemo(() => items.filter(i => i.kind === "video").slice(0, 10), [items]);
    const others = useMemo(() => items.filter(i => i.kind === "custom").slice(0, 10), [items]);

    return (
        <div>
            <Card title="Query Builder" actions={<div>schema: <code>{SCHEMA}</code></div>}>
                <div style={{display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start"}}>
                    <div style={{flex: "1 1 400px", minWidth: 320, minHeight: 0}}>
                        <Card title="Query Building Block">
                            <div style={{padding: 16}}>
                                <RadioGroup
                                    label="Modalities"
                                    options={modalityOptions}
                                    value={modality}
                                    onChange={setModality}
                                    orientation="horizontal"
                                />
                            </div>
                            <div style={{padding: 16}}>
                                <Dropdown
                                    items={emotionItems}
                                    value={emotion}
                                    onChange={(v) => setEmotion(v)}
                                    placeholder="Select an Emotion"
                                    label="Emotion"
                                />
                            </div>
                            <div style={{padding: 16}}>
                                <Input
                                    type="text"
                                    value={textQuery}
                                    onChange={setTextQuery}
                                    placeholder="Type your query…"
                                />
                            </div>
                        </Card>
                    </div>
                </div>
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

                <div className="results-grid">
                    {items.slice(0, 16).map(({id, kind, url, rawType}) => {
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