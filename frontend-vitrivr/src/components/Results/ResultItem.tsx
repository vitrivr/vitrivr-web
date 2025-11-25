import React from "react";
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
    const {
        id,
        caption = id,
        className = "sb__card",
        captionClassName = "sb__caption",
    } = props;

    let media: React.ReactNode;

    if (props.kind === "video") {
        const {
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

        media = (
            <video
                className={mediaClassName}
                src={src}
                poster={poster}
                controls={controls}
                autoPlay={autoPlay}
                loop={loop}
                muted={muted}
                preload={preload}
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
