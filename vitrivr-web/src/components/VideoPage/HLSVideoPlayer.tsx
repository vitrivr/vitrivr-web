import {forwardRef, type CSSProperties, type ForwardedRef, type MutableRefObject, useEffect, useRef, useState} from "react";
import Hls from "hls.js";
import {attachVideoPlayback} from "../../lib/videoPlayback.ts";

interface HlsVideoPlayerProps {
    src: string;
    fallbackSrc?: string;
    poster?: string;
    startTime?: number;
    onTimeUpdate?: (currentTime: number) => void;
    preload?: "none" | "metadata" | "auto";
    controls?: boolean;
    autoPlay?: boolean;
    loop?: boolean;
    muted?: boolean;
    className?: string;
    style?: CSSProperties;
}

function setForwardedRef(ref: ForwardedRef<HTMLVideoElement>, value: HTMLVideoElement | null) {
    if (typeof ref === "function") ref(value);
    else if (ref) (ref as MutableRefObject<HTMLVideoElement | null>).current = value;
}

const HlsVideoPlayer = forwardRef<HTMLVideoElement, HlsVideoPlayerProps>(
    function HlsVideoPlayer({src, fallbackSrc, poster, startTime = 0, onTimeUpdate, preload = "metadata", controls = true, autoPlay = false, loop = false, muted = false, className, style}, forwardedRef) {
        const videoRef = useRef<HTMLVideoElement | null>(null);
        const [error, setError] = useState<string | null>(null);
        const attachVideoRef = (video: HTMLVideoElement | null) => {
            videoRef.current = video;
            setForwardedRef(forwardedRef, video);
        };
        useEffect(() => {
            const video = videoRef.current;
            if (!video) return;
            setError(null);
            return attachVideoPlayback(video, {
                src, fallbackSrc, startTime, preload, autoPlay, preferFile: !controls && !autoPlay && preload === "none", onFailure: setError,
                // Grid posters must not create hundreds of HLS clients or load manifests.
                createHls: () => {
                    if ((!controls && !autoPlay && preload === "none") || !Hls.isSupported()) return null;
                    const hls = new Hls();
                    return {
                        loadSource: value => hls.loadSource(value),
                        attachMedia: element => hls.attachMedia(element),
                        onFatalError: listener => { hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) listener(); }); },
                        destroy: () => hls.destroy(),
                    };
                },
            });
        }, [src, fallbackSrc, startTime, preload, autoPlay, controls]);
        return <>
            <video ref={attachVideoRef} poster={poster} controls={controls} autoPlay={autoPlay} loop={loop} muted={muted}
                playsInline preload={preload} className={className}
                onTimeUpdate={event => onTimeUpdate?.(event.currentTarget.currentTime)}
                style={{display: "block", width: "100%", aspectRatio: "16 / 9", objectFit: "contain", borderRadius: 8, background: "#000", ...style}}/>
            {error && controls && <div className="vp-message vp-message--error" role="alert">{error}</div>}
        </>;
    },
);
export default HlsVideoPlayer;
