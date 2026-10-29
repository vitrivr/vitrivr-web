import {fusionEvidence} from "../../lib/prakFederated.ts";
import ResultItem from "./ResultItem.tsx";
import type {MediaItem} from "../SearchCard.tsx";

type FeedbackControls = {mode: "local" | "federated"; eligibleIds: string[]; selectedIds: string[]; onToggle: (id: string) => void; disabled: boolean};
export default function ResultsGrid({items, beforeNavigate, feedback}: {items: MediaItem[]; beforeNavigate: () => void; feedback?: FeedbackControls}) {
    return (
        <div className="results-grid sc-resultsGrid">
            {items.map(({id, kind, url, name, mediaItemName, thumbUrl, rawType, start, end, searchRank, score, properties}) => {
                const eligible = properties?.["fusion.feedbackEligible"] === "true" && feedback?.eligibleIds.includes(id);
                const evidence = fusionEvidence(properties).filter(source => source.weight !== 0);
                const relevance = feedback ? {selected: feedback.selectedIds.includes(id), onToggle: () => feedback.onToggle(id),
                    disabled: feedback.disabled || !eligible,
                    unavailableLabel: feedback.mode === "local" ? "Unmapped" : "Local only",
                    reason: !eligible ? feedback.mode === "local" ? properties?.["prak.mappingError"] ?? "No PraK frame could be mapped to this local result." : "Local-only results cannot influence PraK feedback yet." : undefined} : undefined;
                if (kind === "image") {
                    return <ResultItem mappingError={properties?.["prak.mappingError"]} evidence={evidence} resultScore={score} relevance={relevance} key={id} id={id} searchRank={searchRank} kind="image" mediaClassName="ri-media" onBeforeOpen={beforeNavigate}/>;
                }
                if (kind === "video") {
                    return <ResultItem mappingError={properties?.["prak.mappingError"]} evidence={evidence} resultScore={score} relevance={relevance} key={id} id={id} searchRank={searchRank} kind="video" showDuration start={start} end={end}
                        mediaItemName={mediaItemName ?? name} preload="none" controls={false}
                        mediaClassName="ri-media" getPosterSrc={() => thumbUrl ?? ""}
                        getVideoSrc={() => url} caption={name} onBeforeOpen={beforeNavigate}/>;
                }
                return <ResultItem mappingError={properties?.["prak.mappingError"]} evidence={evidence} resultScore={score} relevance={relevance} key={id} id={id} searchRank={searchRank} kind="custom" onBeforeOpen={beforeNavigate}
                    renderMedia={() => <div className="sb__unknown"><div className="sb__caption">Type: {rawType ?? "unknown"}</div></div>}/>;
            })}
        </div>
    );
}
