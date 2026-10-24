import ResultItem from "./ResultItem.tsx";
import type {MediaItem} from "../SearchCard.tsx";

export default function ResultsGrid({items, beforeNavigate}: {items: MediaItem[]; beforeNavigate: () => void}) {
    return (
        <div className="results-grid sc-resultsGrid">
            {items.map(({id, kind, url, name, mediaItemName, thumbUrl, rawType, start, end, searchRank}) => {
                if (kind === "image") {
                    return <ResultItem key={id} id={id} searchRank={searchRank} kind="image" mediaClassName="ri-media" onBeforeOpen={beforeNavigate}/>;
                }
                if (kind === "video") {
                    return <ResultItem key={id} id={id} searchRank={searchRank} kind="video" showDuration start={start} end={end}
                        mediaItemName={mediaItemName ?? name} preload="none" controls={false}
                        mediaClassName="ri-media" getPosterSrc={() => thumbUrl ?? ""}
                        getVideoSrc={() => url} caption={name} onBeforeOpen={beforeNavigate}/>;
                }
                return <ResultItem key={id} id={id} searchRank={searchRank} kind="custom" onBeforeOpen={beforeNavigate}
                    renderMedia={() => <div className="sb__unknown"><div className="sb__caption">Type: {rawType ?? "unknown"}</div></div>}/>;
            })}
        </div>
    );
}
