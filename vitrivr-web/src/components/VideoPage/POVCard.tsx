import type {HourlyVideo} from "./POVs.tsx";

export function PovCard({video}: { video: HourlyVideo }) {
    return (
        <div
            style={{
                display: "grid",
                gap: 6,
                minWidth: 0,
                border: "1px solid #e5e5e5",
                borderRadius: 10,
                padding: 8,
                background: "#DDDCE6",
            }}
        >
            <video
                src={video.url}
                controls
                preload="none"
                style={{
                    display: "block",
                    width: "100%",
                    aspectRatio: "16 / 9",
                    objectFit: "contain",
                    borderRadius: 7,
                    background: "#000",
                }}
            />

            <div
                style={{
                    fontSize: 13,
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
                title={video.name}
            >
                {video.name}
            </div>
        </div>
    );
}