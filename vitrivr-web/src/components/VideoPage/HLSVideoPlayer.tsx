import {forwardRef, type CSSProperties, type ForwardedRef, type MutableRefObject, useEffect, useRef,} from "react";
import Hls from "hls.js";

interface HlsVideoPlayerProps {
    src: string;
    poster?: string;
    startTime?: number;
    onTimeUpdate?: (currentTime: number) => void;
    preload?: "none" | "metadata" | "auto";
    className?: string;
    style?: CSSProperties;
}

function setForwardedRef(ref: ForwardedRef<HTMLVideoElement>, value: HTMLVideoElement | null,) {
    if (typeof ref === "function") {
        ref(value);
        return;
    }

    if (ref) {
        (ref as MutableRefObject<HTMLVideoElement | null>).current = value;
    }
}

const HlsVideoPlayer = forwardRef<HTMLVideoElement, HlsVideoPlayerProps>(
    function HlsVideoPlayer({src, poster, startTime = 0, onTimeUpdate, preload = "metadata", className, style,},
        forwardedRef,) {
        const videoRef = useRef<HTMLVideoElement | null>(null);
        const attachVideoRef = (video: HTMLVideoElement | null) => {
            videoRef.current = video;
            setForwardedRef(forwardedRef, video);
        };
        console.log(src);

        useEffect(() => {
            const video = videoRef.current;
            if (!video || !src) {
                return;
            }

            const isHlsSource = /\.m3u8(?:$|[?#])/i.test(src);

            // Keep ordinary video URLs working as well
            if (!isHlsSource) {
                video.src = src;
                return () => {
                    video.removeAttribute("src");
                    video.load();
                };
            }

            // Safari and some Apple browsers support HLS natively.
            if (video.canPlayType("application/vnd.apple.mpegurl")) {
                video.src = src;
                return () => {
                    video.removeAttribute("src");
                    video.load();
                };
            }

            if (Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(src);
                hls.attachMedia(video);

                return () => {
                    hls.destroy();
                    video.removeAttribute("src");
                    video.load();
                };
            }

            console.error("HLS is not supported by this browser.");
        }, [src]);

        return (
            <video
                ref={attachVideoRef}
                poster={poster}
                controls
                playsInline
                preload={preload}
                className={className}
                onLoadedMetadata={(event) => {
                    const video = event.currentTarget;

                    if (Number.isFinite(startTime) && startTime > 0) {
                        const seekTo = Number.isFinite(video.duration)
                            ? Math.min(startTime, video.duration)
                            : startTime;
                        video.currentTime = seekTo;
                    }
                }}
                onTimeUpdate={(event) => {
                    onTimeUpdate?.(event.currentTarget.currentTime);
                }}
                style={{
                    display: "block",
                    width: "100%",
                    aspectRatio: "16 / 9",
                    objectFit: "contain",
                    borderRadius: 8,
                    background: "#000",
                    ...style,
                }}
            />
        );
    },
);

export default HlsVideoPlayer;