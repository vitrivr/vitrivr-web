"use client";
import {useNavigate, useParams, useLocation} from "react-router-dom";
import {thumbnailUrl} from "../lib/vitrivr";
import {useSearch} from "../state/SearchContext.tsx";
import React, {useRef, useCallback} from "react";

type VideoState = { src?: string; poster?: string; start?: number, end?: number } | null;

export default function VideoPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const state = (location.state as VideoState) ?? null;
    const {id} = useParams<{ id: string }>();
    const {items} = useSearch(); // items: MediaItem[]
    const videoRef = useRef<HTMLVideoElement | null>(null);

    if (!id) {
        return (
            <div style={{padding: 16}}>
                <button onClick={() => navigate(-1)} aria-label="Back">← Back</button>
                <p>Missing video id.</p>
            </div>
        );
    }

    const item = items.find(it => it.id === id);
    const src = state?.src ?? item?.url;
    const poster = state?.poster ?? thumbnailUrl(id);
    const start = state?.start ?? 0;
    const end = state?.end ?? 0;

    const handleLoadedMetadata = useCallback(() => {
        if (videoRef.current == null) return;
        if (start != null && !Number.isNaN(start)) {
            videoRef.current.currentTime = start;
        }
    }, [start]);


    return (
        <div style={{padding: 16, display: "grid", gap: 16}}>
            <header style={{display: "flex", alignItems: "center", gap: 12}}>
                <button
                    onClick={() => navigate(-1)}
                    aria-label="Back to results"
                    style={{
                        border: "1px solid #ddd",
                        borderRadius: 8,
                        background: "#fff",
                        padding: "6px 10px",
                        cursor: "pointer",
                    }}
                >
                    ← Back
                </button>
                <h2 style={{margin: 0, fontSize: 18, fontWeight: 600}}>Video: {id}</h2>
            </header>

            <video
                ref={videoRef}
                src={src}
                poster={poster}
                controls
                preload="metadata"
                onLoadedMetadata={handleLoadedMetadata}
                style={{
                    width: "100%",
                    maxWidth: 960,
                    height: "auto",
                    borderRadius: 12,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    background: "#000",
                    justifySelf: "start"
                }}
            />

            <section
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: 12,
                    maxWidth: 960,
                }}
            >
                <div
                    style={{
                        border: "1px solid #eee",
                        borderRadius: 12,
                        padding: 12,
                        background: "#fff",
                    }}
                >
                    <h3 style={{marginTop: 0}}>Metadata</h3>
                    <div style={{color: "#666"}}>Still trying to understand the API lol.</div>
                </div>
                <div
                    style={{
                        border: "1px solid #eee",
                        borderRadius: 12,
                        padding: 12,
                        background: "#fff",
                    }}
                >
                    <h3 style={{marginTop: 0}}>Nearest neighbors</h3>
                    <div style={{color: "#666"}}> {start}, {end}, {id}</div>
                </div>
            </section>
        </div>
    );
}
