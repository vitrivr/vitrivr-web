"use client";
import React, {createContext, useContext, useState} from "react";
import {SearchRequestGate} from "../lib/prakSearch.ts";
import type {LocalFeedbackSession} from "../lib/prakLocalFeedback.ts";
import type {FederatedSession} from "../lib/prakFederated.ts";
import type {BlockState} from "../components/SearchCard";
import {useFrontendSettings} from "./FrontendSettingsContext.tsx";
import {emptyQueryFilters, type QueryFilters} from "../lib/queryFilters.ts";
import {makeBlockState} from "./makeBlockState";
import type {MediaItem} from "../components/SearchCard";

type MediaFilter = { image: boolean; video: boolean; custom: boolean; uniqueVideos: boolean };

const HLS_BASE_URL = (import.meta.env.VITE_MEDIA_SEGMENT ?? "").replace(/\/+$/, "");

// TODO Fixme
export function buildHlsUrl(parentId: string): string {
    return `${HLS_BASE_URL}/${encodeURIComponent(parentId)}/master.m3u8`;
}

type SearchState = {
    localFeedbackSession: LocalFeedbackSession | null;
    setLocalFeedbackSession: React.Dispatch<React.SetStateAction<LocalFeedbackSession | null>>;
    prakSession: FederatedSession | null;
    setPrakSession: React.Dispatch<React.SetStateAction<FederatedSession | null>>;
    searchRequests: SearchRequestGate;
    visualDeduplicationEnabled: boolean;
    setVisualDeduplicationEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    queryFilters: QueryFilters;
    setQueryFilters: React.Dispatch<React.SetStateAction<QueryFilters>>;
    resultView: "ranked" | "video";
    setResultView: React.Dispatch<React.SetStateAction<"ranked" | "video">>;
    schema: string;
    setSchema: (s: string) => void;

    blocks: BlockState[];
    setBlocks: React.Dispatch<React.SetStateAction<BlockState[]>>;

    items: MediaItem[];
    setItems: React.Dispatch<React.SetStateAction<MediaItem[]>>;

    mediaFilter: MediaFilter;
    setMediaFilter: React.Dispatch<React.SetStateAction<MediaFilter>>;

    raw: string;
    setRaw: React.Dispatch<React.SetStateAction<string>>;

    scrollY: number;
    setScrollY: (y: number) => void;

    vectorsById: Record<string, number[]>;
    setVectorsById: React.Dispatch<React.SetStateAction<Record<string, number[]>>>;
};

const SearchCtx = createContext<SearchState | null>(null);

export function SearchProvider({children, initial}: {
    children: React.ReactNode;
    initial: Pick<SearchState, "blocks">
}) {

    const {settings, saveSettings} = useFrontendSettings();
    const visualDeduplicationEnabled = settings.visualDeduplication.enabled;
    const setVisualDeduplicationEnabled: React.Dispatch<React.SetStateAction<boolean>> = value => {
        const enabled = typeof value === "function" ? value(settings.visualDeduplication.enabled) : value;
        if (enabled !== settings.visualDeduplication.enabled) {
            saveSettings({...settings, visualDeduplication: {...settings.visualDeduplication, enabled}});
        }
    };
    const ensureAtLeastOne = (bs: BlockState[]) =>
        bs.length === 0 ? [makeBlockState("", settings.enabledQueryTypes, settings.frontendView)] : bs;

    const [blocks, _setBlocks] = useState<BlockState[]>(
        ensureAtLeastOne(initial.blocks ?? [])
    );

    const setBlocks: React.Dispatch<React.SetStateAction<BlockState[]>> = (next) => {
        _setBlocks((prev) => {
            const resolved = typeof next === "function" ? (next as any)(prev) : next;
            return ensureAtLeastOne(resolved);
        });
    };

    const [localFeedbackSession, setLocalFeedbackSession] = useState<LocalFeedbackSession | null>(null);
    const [prakSession, setPrakSession] = useState<FederatedSession | null>(null);
    const [searchRequests] = useState(() => new SearchRequestGate());
    const [queryFilters, setQueryFilters] = useState<QueryFilters>(emptyQueryFilters);
    const [resultView, setResultView] = useState<"ranked" | "video">("ranked");
    const [items, setItems] = useState<SearchState["items"]>([]);
    const [mediaFilter, setMediaFilter] = useState<MediaFilter>({
        image: true,
        video: true,
        custom: true,
        uniqueVideos: false,
    });
    const [raw, setRaw] = useState("");
    const [scrollY, _setScrollY] = useState(0);
    const [schema, setSchema] = useState<string>(() => {
        try {
            return localStorage.getItem("vitrivr_schema")
                ?? import.meta.env.VITE_VITRIVR_SCHEMA
                ?? "";
        } catch {
            return import.meta.env.VITE_VITRIVR_SCHEMA ?? "";
        }
    });


    const setScrollY = (y: number) => _setScrollY(y);
    const [vectorsById, setVectorsById] = useState<Record<string, number[]>>({});


    return (
        <SearchCtx.Provider
            value={{
                localFeedbackSession, setLocalFeedbackSession,
                prakSession, setPrakSession, searchRequests,
                visualDeduplicationEnabled,
                setVisualDeduplicationEnabled,
                queryFilters,
                setQueryFilters,
                resultView,
                setResultView,
                schema,
                setSchema,
                blocks,
                setBlocks,
                items,
                setItems,
                mediaFilter,
                setMediaFilter,
                raw,
                setRaw,
                scrollY,
                setScrollY,
                vectorsById,
                setVectorsById,
            }}
        >
            {children}
        </SearchCtx.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSearch() {
    const ctx = useContext(SearchCtx);
    if (!ctx) throw new Error("useSearch must be used within SearchProvider");
    return ctx;
}
