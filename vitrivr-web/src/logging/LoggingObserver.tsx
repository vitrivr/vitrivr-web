import {useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore} from "react";
import {useLocation, useNavigationType} from "react-router-dom";
import {useSearch} from "../state/SearchContext.tsx";
import {useAuth} from "../state/AuthContext.tsx";
import {useFrontendSettings} from "../state/FrontendSettingsContext.tsx";
import {EvaluationClientApiFactory} from "../dres/generated/api/api.ts";
import {dresAxios} from "../dres/generated/api/dresAxios.ts";
import {interactionLogger as logger} from "./index.ts";
import {safeUrl} from "./sanitize.ts";

function useLogSnapshot(action: string, value: unknown, enabled: boolean) {
    useEffect(() => { logger.snapshot(action, value); }, [action, value, enabled]);
}

/** One observer of application state; business components do not depend on the logger. */
export default function LoggingObserver() {
    const search = useSearch();
    const auth = useAuth();
    const {settings} = useFrontendSettings();
    const location = useLocation();
    const navigationType = useNavigationType();
    const evaluation = useRef(auth.evaluationId);
    const enabled = useSyncExternalStore(logger.subscribe, () => logger.getSnapshot().enabled);

    useLayoutEffect(() => {
        const activeEvaluation = auth.status === "loggedIn" ? auth.evaluationId : null;
        if (evaluation.current !== activeEvaluation) {
            logger.setContext({taskId: null, taskName: null});
            evaluation.current = activeEvaluation;
        }
        logger.setContext({schema: search.schema, frontendView: settings.frontendView,
            operatorId: auth.user?.username || `anonymous-${logger.getSnapshot().sessionId}`,
            evaluationId: activeEvaluation, route: `${location.pathname}${location.search}${location.hash}`});
        logger.snapshot("navigation.route", {url: safeUrl(`${location.pathname}${location.search}${location.hash}`), navigationType, state: location.state});
        logger.snapshot("auth.state", {status: auth.status, username: auth.user?.username, evaluationId: auth.evaluationId});
    }, [search.schema, settings.frontendView, location, navigationType,
        auth.user?.username, auth.status, auth.evaluationId, enabled]);

    const feedback = useMemo(() => ({
            local: search.localFeedbackSession?.selectedIds ?? [], federated: search.prakSession?.selectedIds ?? [],
            localRanking: search.localFeedbackSession?.ranking, federatedRanking: search.prakSession?.ranking,
    }), [search.localFeedbackSession, search.prakSession]);
    // Avoid serializing a large result set again on every text edit or playback update.
    const projected = useMemo(() => search.items.map((item, index) => {
            const {clipVector, ...media} = item;
            return {...media, searchRank: item.searchRank ?? index + 1, vectorDimensions: clipVector?.length ?? 0};
    }), [search.items]);
    useLogSnapshot("settings.snapshot", settings, enabled);
    useLogSnapshot("settings.schema", search.schema, enabled);
    useLogSnapshot("query.filters", search.queryFilters, enabled);
    useLogSnapshot("results.filters", search.mediaFilter, enabled);
    useLogSnapshot("results.view", search.resultView, enabled);
    useLogSnapshot("qa.reranking_enabled", search.vlmReranking.enabled, enabled);
    useLogSnapshot("feedback.selection", feedback, enabled);
    useLogSnapshot("results.projected", projected, enabled);

    useEffect(() => {
        if (!auth.session || !auth.evaluationId) return;
        const api = EvaluationClientApiFactory(undefined, import.meta.env.VITE_DRES_BASE_URL ?? "", dresAxios);
        const controller = new AbortController();
        let busy = false;
        const refresh = async () => {
            if (busy || controller.signal.aborted || !logger.getSnapshot().enabled) return;
            busy = true;
            try { await api.getApiV2ClientEvaluationCurrentTaskByEvaluationId(auth.evaluationId!, auth.session!, {signal: controller.signal}); }
            catch { /* Network adapter retains the error; logging must not interrupt the app. */ }
            finally { busy = false; }
        };
        void refresh();
        const timer = setInterval(() => void refresh(), 15_000);
        window.addEventListener("focus", refresh);
        return () => { clearInterval(timer); controller.abort(); window.removeEventListener("focus", refresh); };
    }, [auth.session, auth.evaluationId]);
    return null;
}
