"use client";
import {useNavigate, useParams} from "react-router-dom";
import {thumbnailUrl} from "../lib/vitrivr";
import {useSearch} from "../state/SearchContext.tsx";
import {useEffect, useRef} from "react";

export default function VideoPage() {
    const navigate = useNavigate();
    const {id} = useParams<{ id: string }>();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const {items, schema} = useSearch();
    const item = items.find(it => it.id === id);
    let poster = "";
    if (id != null) {
        poster = thumbnailUrl(schema, id) ?? "";
    }

    if (!id) {
        return (
            <div style={{padding: 16}}>
                <button onClick={() => navigate(-1)} aria-label="Back">← Back</button>
                <p>Missing video id.</p>
            </div>
        );
    }

    const src = item?.url ?? "";
    const start = item?.start ?? 0;
    const end = item?.end ?? 0;

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleLoadedMetadata = () => {
            if (start > 0) {
                const safeStart =
                    video.duration && video.duration > 0
                        ? Math.min(Math.max(0, start), video.duration)
                        : Math.max(0, start);

                video.currentTime = safeStart;
            }
        };

        video.addEventListener("loadedmetadata", handleLoadedMetadata);
        return () => {
            video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        };
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
                style={{
                    width: "100%",
                    maxWidth: 960,
                    height: "auto",
                    borderRadius: 12,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    background: "#000",
                    justifySelf: "start",
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
                    <div style={{color: "#666"}}>
                        Start: {start.toFixed(2)}s <br/>
                        End: {end.toFixed(2)}s <br/>
                        Video Name: {src.split("/")[6]} <br/>
                    </div>
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
                    <div style={{color: "#666"}}>Not yet implemented :)</div>
                </div>
            </section>
        </div>
    );
}