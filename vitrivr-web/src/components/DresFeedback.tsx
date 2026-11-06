import {useEffect, useState} from "react";
import "./DresFeedback.css";

import {noticeEvent, type Notice} from "../dres/feedback.ts";

export default function DresFeedback() {
    const [notice, setNotice] = useState<Notice | null>(null);
    useEffect(() => {
        const receive = (event: Event) => setNotice((event as CustomEvent<Notice>).detail);
        window.addEventListener(noticeEvent, receive);
        return () => window.removeEventListener(noticeEvent, receive);
    }, []);
    if (!notice) return null;
    return <section className={`dres-feedback dres-feedback--${notice.kind}`} aria-label="DRES submission feedback">
        <div role={notice.kind === "error" ? "alert" : "status"}>
            <strong>{notice.title ?? "DRES submission"}</strong>
            <p>{notice.message}</p>
            {notice.kind === "error" && /no running task/i.test(notice.message) &&
                <p>Start a task for your team in DRES, or choose another evaluation using the Evaluation button.</p>}
        </div>
        <button type="button" aria-label="Dismiss DRES message" onClick={() => setNotice(null)}>×</button>
    </section>;
}
