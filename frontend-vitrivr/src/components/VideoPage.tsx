"use client";
import {useNavigate, useParams} from "react-router-dom";
import {thumbnailUrl} from "../lib/vitrivr";
import {useSearch} from "../state/SearchContext.tsx";
import {useEffect, useRef, useState} from "react";
import {useAuth} from "../state/AuthContext.tsx";
import {submitVideoAnswer} from "../dres/generated/api/dresSubmit.ts";


type VideoState = { src?: string; poster?: string; start?: number; end?: number } | null;

export default function VideoPage() {
    const navigate = useNavigate();
    const {id} = useParams<{ id: string }>();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const {items, schema} = useSearch();
    const item = items.find(it => it.id === id);
    const {session, openLogin} = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const {evaluationId} = useAuth()
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

        const onLoaded = () => {
            video.currentTime = Math.min(start, video.duration || start);
        };

        video.addEventListener("loadedmetadata", onLoaded);
        return () => video.removeEventListener("loadedmetadata", onLoaded);
    }, [start]);

    const onSubmit = async () => {
        if (!session) {
            openLogin();
            return;
        }

        if (!evaluationId) {
            openLogin();
            return;
        }

        const splitLen = src.split("/").length
        const videoName = src.split("/")[splitLen - 1].split(".")[0]
        setSubmitting(true);
        try {
            await submitVideoAnswer({
                session,
                mediaItemName: videoName,
                evaluationId,
                startMs: start > 0 ? Math.round(start * 1000) : undefined,
                endMs: end > 0 ? Math.round(end * 1000) : undefined,
            });
            alert("Submitted!");
        } catch (err: any) {
            alert(err?.response?.data?.description ?? err?.message ?? "Submit failed.");
        } finally {
            setSubmitting(false);
        }
    };


    return (
        <div style={{padding: 16, display: "grid", gap: 16}}>
            <header style={{display: "flex", alignItems: "center", gap: 12}}>
                <button onClick={() => navigate(-1)} style={{
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    background: "#fff",
                    padding: "6px 10px",
                    cursor: "pointer"
                }}>
                    ← Back
                </button>

                <h2 style={{margin: 0, fontSize: 18, fontWeight: 600}}>Video: {id}</h2>

                <div style={{marginLeft: "auto"}}>
                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={submitting}
                        style={{
                            border: "1px solid #ddd",
                            borderRadius: 10,
                            padding: "8px 12px",
                            background: "#FF00FF",
                            cursor: "pointer",
                        }}
                    >
                        {submitting ? "Submitting…" : "Submit"}
                    </button>
                </div>
            </header>

            <video
                src={src}
                poster={poster}
                controls
                preload="metadata"
                style={{width: "100%", maxWidth: 960, borderRadius: 12, background: "#000"}}
            />
        </div>
    );
}