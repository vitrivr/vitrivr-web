import React, {useRef} from "react";
import {Link} from "react-router-dom";
import {thumbnailUrl} from "../../lib/vitrivr";

type BaseProps = {
    id: string;
    caption?: React.ReactNode;
    className?: string;
    captionClassName?: string;
    onBeforeOpen?: () => void;
};
type ImageProps = {
    kind?: "image";
    getImageSrc?: (id: string) => string;
    alt?: string;
    mediaClassName?: string;
};
type VideoProps = {
    kind: "video";
    start: number;
    end: number;
    getVideoSrc: (id: string) => string;
    getPosterSrc?: (id: string) => string;
    controls?: boolean;
    autoPlay?: boolean;
    loop?: boolean;
    muted?: boolean;
    preload?: "none" | "metadata" | "auto";
    mediaClassName?: string;
};
type CustomProps = { kind: "custom"; renderMedia: (id: string) => React.ReactNode };
type ResultItemProps = BaseProps & (ImageProps | VideoProps | CustomProps);

export default function ResultItem(props: ResultItemProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const {
        id,
        caption = id,
        className = "sb__card",
        captionClassName = "sb__caption",
    } = props;

    let media: React.ReactNode;

    if (props.kind === "video") {
        const {
            start,
            getVideoSrc,
            getPosterSrc,
            controls = true,
            autoPlay = false,
            loop = false,
            muted = false,
            preload = "metadata",
            mediaClassName = "sb__video",
        } = props;

        const src = (getVideoSrc)(id);
        const poster = (getPosterSrc ?? thumbnailUrl)(id);

        const handleLoadedMetadata = () => {
            if (videoRef.current && start != null) {
                videoRef.current.currentTime = start;
            }
        };


        media = (
            <video
                ref={videoRef}
                className={mediaClassName}
                src={src}
                poster={poster}
                controls={controls}
                autoPlay={autoPlay}
                loop={loop}
                muted={muted}
                preload={preload}
                onLoadedMetadata={handleLoadedMetadata}
            />
        );
    } else if (props.kind === "custom") {
        media = props.renderMedia(id);
    } else {
        const {getImageSrc, alt = `Image for ${id}`, mediaClassName = "sb__image"} = props;
        const src = (getImageSrc ?? thumbnailUrl)(id);
        media = <img className={mediaClassName} src={src} alt={alt}/>;
    }

    return (
        <Link
            to={`/video/${encodeURIComponent(id)}`}
            state={
                props.kind === "video"
                    ? {
                        src: (props as any).getVideoSrc?.(id),      // or reuse `src` variable
                        poster: thumbnailUrl(id),
                        start: (props as any).start,
                        end: (props as any).end,
                    }
                    : undefined
            }
            style={{
                textDecoration: "none",
                color: "inherit",
            }}
        >
            <figure className={className}>
                {media}
                <figcaption className={captionClassName}>{caption}</figcaption>
            </figure>
        </Link>
    );

}
