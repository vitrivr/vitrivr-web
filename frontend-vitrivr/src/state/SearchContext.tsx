"use client";
import React, {createContext, useContext, useState} from "react";
import type {BlockState} from "../components/SearchCard";

type MediaKind = "image" | "video" | "custom";
export type MediaItem = {
    start: number;
    end: number;
    id: string; kind: MediaKind; thumbUrl?: string; rawType?: string; url: string
};

type MediaFilter = { image: boolean; video: boolean; custom: boolean; uniqueVideos: boolean };

type SearchState = {
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
    const [blocks, setBlocks] = useState(initial.blocks);
    const [items, setItems] = useState<SearchState["items"]>([]);
    const [mediaFilter, setMediaFilter] = useState<MediaFilter>({
        image: true,
        video: true,
        custom: true,
        uniqueVideos: true,
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
