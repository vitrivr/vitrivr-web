import {useMemo} from "react";
import {getHourFromFilename, getVideoAtOffset, parseVideoURL,} from "./VideoHourUtils.ts";

type HourGalleryProps = {
    src: string;
    direction: "previous" | "next";
    offset: number;
    onPrevious: () => void;
    onNext: () => void;
};

export default function HourGallery({src, direction, offset, onPrevious, onNext,}: HourGalleryProps) {
    const info = useMemo(() => parseVideoURL(src), [src]);
    if (!info) {
        return null;
    }
    const originalHour = getHourFromFilename(info.filename);
    if (originalHour === null) {
        return null;
    }
    const videoOffset = direction === "previous" ? offset - 1 : offset + 1;
    const displayedHour = originalHour + videoOffset;
    const videoUrl = getVideoAtOffset(src, videoOffset);
    const handleClick = direction === "previous" ? onPrevious : onNext;
    if (!videoUrl) {
        return (
            <div
                style={{
                    minWidth: 0,
                    display: "grid",
                    gap: 8,
                    alignContent: "center",
                }}
            >
                <div
                    style={{
                        height: 20,
                    }}
                />

                <div
                    style={{
                        aspectRatio: "16 / 9",
                        display: "grid",
                        placeItems: "center",
                        borderRadius: 8,
                        background: "#eee",
                        color: "#777",
                        fontSize: 13,
                        position: "relative",
                    }}
                >
                    No video

                    <button
                        type="button"
                        onClick={handleClick}
                        aria-label={
                            direction === "previous"
                                ? "Move all videos one hour earlier"
                                : "Move all videos one hour later"
                        }
                        style={{
                            position: "absolute",
                            top: "50%",
                            transform: "translateY(-50%)",

                            ...(direction === "previous"
                                ? {left: -40}
                                : {right: -40}),

                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            border: "1px solid #ccc",
                            background: "#fff",
                            cursor: "pointer",
                            display: "grid",
                            placeItems: "center",
                            fontSize: 20,
                        }}
                    >
                        {direction === "previous" ? "‹" : "›"}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            style={{
                minWidth: 0,
                display: "grid",
                gap: 8,
                alignContent: "center",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <strong
                    style={{fontSize: 13,}}
                >
                    {direction === "previous" ? "Earlier" : "Later"}
                </strong>

                <span
                    style={{
                        fontSize: 12,
                        opacity: 0.6,
                    }}
                >
                    {String(displayedHour).padStart(2, "0")}
                    :00
                </span>
            </div>

            <div
                style={{
                    position: "relative",
                    minWidth: 0,
                }}
            >
                <video
                    key={videoUrl}
                    src={videoUrl}
                    controls
                    preload="metadata"
                    style={{
                        display: "block",
                        width: "100%",
                        aspectRatio: "16 / 9",
                        objectFit: "contain",
                        borderRadius: 8,
                        background: "#000",
                    }}
                />

                <button
                    type="button"
                    onClick={handleClick}
                    aria-label={
                        direction === "previous"
                            ? "Move all videos one hour earlier"
                            : "Move all videos one hour later"
                    }
                    style={{
                        position: "absolute",
                        top: "50%",
                        transform: "translateY(-50%)",

                        ...(direction === "previous"
                            ? {left: -40}
                            : {right: -40}),
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        border: "1px solid rgba(255,255,255,.7)",
                        background: "rgba(0,0,0,.55)",
                        color: "#fff",
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 20,
                    }}
                >
                    {direction === "previous"
                        ? "‹"
                        : "›"}
                </button>
            </div>
        </div>
    );
}