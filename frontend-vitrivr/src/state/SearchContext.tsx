"use client";
import React, {createContext, useContext, useState} from "react";
import type {BlockState} from "../components/SearchCard";

type MediaKind = "image" | "video" | "custom";
export type MediaItem = { id: string; kind: MediaKind; rawType?: string; url?: string };

type MediaFilter = { image: boolean; video: boolean; custom: boolean };

type SearchState = {
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
};

const SearchCtx = createContext<SearchState | null>(null);

export function SearchProvider({children, initial}: {
    children: React.ReactNode;
    initial: Pick<SearchState, "blocks">
}) {
    const [blocks, setBlocks] = useState(initial.blocks);
    const [items, setItems] = useState<SearchState["items"]>([]);
    const [mediaFilter, setMediaFilter] = useState<MediaFilter>({image: true, video: true, custom: true});
    const [raw, setRaw] = useState("");
    const [scrollY, _setScrollY] = useState(0);

    const setScrollY = (y: number) => _setScrollY(y);

    return (
        <SearchCtx.Provider
            value={{blocks, setBlocks, items, setItems, mediaFilter, setMediaFilter, raw, setRaw, scrollY, setScrollY}}
        >
            {children}
        </SearchCtx.Provider>
    );
}

export function useSearch() {
    const ctx = useContext(SearchCtx);
    if (!ctx) throw new Error("useSearch must be used within SearchProvider");
    return ctx;
}
