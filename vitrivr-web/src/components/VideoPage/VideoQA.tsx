import {useEffect, useRef, useState, type FormEvent} from "react";
import DisclosureSection from "./DisclosureHeader.tsx";
import {retrieval} from "../../vitirvr/api/client.ts";
import {buildVideoQaQuery, executeVideoQa, videoQaErrorMessage, videoQaIdFromPath, VIDEO_QA_SCHEMA} from "../../lib/videoQa.ts";

const list = (value: string) => value.split(/[,\n]/).map(item => item.trim()).filter(Boolean);
type DayFilter = {id: number; days: string; start: string; end: string};

/** The parent keys this panel by the active recording, cancelling stale questions on navigation. */
export default function VideoQA({file}: {file: string}) {
    const currentId = videoQaIdFromPath(file);
    const [open, setOpen] = useState(true);
    const [question, setQuestion] = useState("");
    const [scope, setScope] = useState<"current" | "custom">(currentId ? "current" : "custom");
    const [videoIds, setVideoIds] = useState("");
    const [cameras, setCameras] = useState("");
    const [timeStart, setTimeStart] = useState("");
    const [timeEnd, setTimeEnd] = useState("");
    const [filters, setFilters] = useState<DayFilter[]>([]);
    const nextFilterId = useRef(0);
    const [frames, setFrames] = useState("8");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [answer, setAnswer] = useState<{question: string; text: string} | null>(null);
    const activeRequest = useRef<AbortController | null>(null);

    useEffect(() => () => {
        activeRequest.current?.abort();
        activeRequest.current = null;
    }, []);

    async function ask(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (activeRequest.current) return;
        let query: ReturnType<typeof buildVideoQaQuery>;
        try {
            query = buildVideoQaQuery(question, scope === "current" ? {videoIds: currentId ? [currentId] : []} : {
                videoIds: list(videoIds), cameras: list(cameras), timeStart, timeEnd,
                additionalFilters: filters.map(filter => ({days: list(filter.days), time_start: filter.start, time_end: filter.end})),
            }, Number(frames));
        } catch (err) { setError(videoQaErrorMessage(err)); return; }
        const controller = new AbortController();
        activeRequest.current = controller;
        setLoading(true);
        setError(null);
        setAnswer(null);
        try {
            const text = await executeVideoQa(
                // @ts-expect-error Generated operator types omit named input references.
                body => retrieval.postExecuteQuery(VIDEO_QA_SCHEMA, body), query, controller.signal);
            if (activeRequest.current === controller && !controller.signal.aborted) setAnswer({question: query.inputs.question.data, text});
        } catch (err) {
            if (activeRequest.current === controller && !controller.signal.aborted) setError(videoQaErrorMessage(err));
        } finally {
            if (activeRequest.current === controller) {
                activeRequest.current = null;
                setLoading(false);
            }
        }
    }

    const recordingLabel = currentId ? currentId.split("_").map((part, index) => index === 2 ? `${part}:00` : part).join(" · ") : "Custom selection";

    return <div className="vp-qaPanel"><DisclosureSection open={open} onToggle={() => setOpen(value => !value)} title="Video QA" loading={loading && !open}>
        <form className="vp-qaForm" onSubmit={event => void ask(event)} aria-busy={loading}>
            <div className="vp-qaContext">
                <p>{scope === "current" ? recordingLabel : "Custom selection"}</p>
            </div>
            <div className="vp-qaWorkspace">
            <div className="vp-qaComposer">
            <div className="vp-qaQuestionRow">
                <label className="vp-qaField vp-qaQuestion">Question
                    <textarea rows={2} value={question} onChange={event => setQuestion(event.target.value)} required disabled={loading}
                        placeholder="Ask about this recording…"/>
                </label>
                <div className="vp-qaActions">
                    <button className="btn btn-primary" type="submit" data-log-action="qa.submit" disabled={loading}>{loading ? "Answering…" : "Ask Video QA"}</button>
                    {loading && <button className="btn" type="button" data-log-action="qa.cancel" onClick={() => activeRequest.current?.abort()}>Cancel</button>}
                </div>
            </div>
            <fieldset className="vp-qaFields" disabled={loading}>
                <details className="vp-qaOptions">
                <summary>Options</summary>
                <div className="vp-qaSelection">
                <label className="vp-qaField">Ask about
                    <select value={scope} onChange={event => setScope(event.target.value as "current" | "custom")}>
                        <option value="current" disabled={!currentId}>Current recording{currentId ? ` · ${currentId}` : " (unavailable)"}</option>
                        <option value="custom">Choose recordings, cameras or a time range</option>
                    </select>
                </label>
                {scope === "current" && <p className="sc-personHint">Uses the whole hourly recording currently shown.</p>}
                {scope === "custom" && <div className="vp-qaSelection">
                    <label className="vp-qaField">Video IDs
                        <textarea rows={2} value={videoIds} onChange={event => setVideoIds(event.target.value)} placeholder="day2_Bjorn_11, day2_Klaus_11"/>
                    </label>
                    <label className="vp-qaField">Cameras
                        <input value={cameras} onChange={event => setCameras(event.target.value)} placeholder="Bjorn, Kitchen"/>
                    </label>
                    <p className="sc-personHint">Separate IDs or cameras with commas. Video IDs take priority over cameras.</p>
                    <div className="vp-qaRange">
                        <label className="vp-qaField">From (day:hour)
                            <input value={timeStart} onChange={event => setTimeStart(event.target.value)} placeholder="day1:10"/>
                        </label>
                        <label className="vp-qaField">Until (day:hour)
                            <input value={timeEnd} onChange={event => setTimeEnd(event.target.value)} placeholder="day1:14"/>
                        </label>
                    </div>
                    <p className="sc-personHint">Time ranges include the start and exclude the end.</p>
                    <details className="vp-qaOptions">
                        <summary>Day filters</summary>
                        {filters.map(filter => <div className="vp-qaDayFilter" key={filter.id}>
                            <label className="vp-qaField">Days
                                <input required value={filter.days} placeholder="day1, day2" onChange={event => setFilters(previous => previous.map(row => row.id === filter.id ? {...row, days: event.target.value} : row))}/>
                            </label>
                            <div className="vp-qaRange">
                                <label className="vp-qaField">From
                                    <input type="time" value={filter.start} onChange={event => setFilters(previous => previous.map(row => row.id === filter.id ? {...row, start: event.target.value} : row))}/>
                                </label>
                                <label className="vp-qaField">Until
                                    <input type="time" value={filter.end} onChange={event => setFilters(previous => previous.map(row => row.id === filter.id ? {...row, end: event.target.value} : row))}/>
                                </label>
                            </div>
                            <button className="sc-personClear" type="button" onClick={() => setFilters(previous => previous.filter(row => row.id !== filter.id))}>Remove day filter</button>
                        </div>)}
                        <button className="btn" type="button" onClick={() => setFilters(previous => [...previous, {id: nextFilterId.current++, days: "", start: "", end: ""}])}>Add day filter</button>
                    </details>
                </div>}
                    <label className="vp-qaField">Maximum frames per video
                        <input type="number" min="1" max="128" step="1" required value={frames} onChange={event => setFrames(event.target.value)}/>
                    </label>
                </div>
                </details>
            </fieldset>
            </div>
            {(loading || error || answer) && <section className="vp-qaAnswer" aria-label="Video QA answer" aria-live="polite">
                {loading ? <div className="vp-qaPending" role="status">
                    <span className="vp-qaSpinner" aria-hidden="true"/>
                    <span>Answering your question. This may take up to three minutes.</span>
                </div> : error ? <div className="vp-message vp-message--error" role="alert">{error}</div> : answer ? <>
                    <h3>Answer</h3>
                    <p className="vp-qaAsked">{answer.question}</p>
                    <p className="vp-qaAnswerText">{answer.text}</p>
                </> : null}
            </section>}
            </div>
        </form>
    </DisclosureSection></div>;
}
