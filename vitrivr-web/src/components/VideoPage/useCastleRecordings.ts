import {useEffect, useState} from "react";
import {retrieval} from "../../vitirvr/api/client.ts";
import {mediaConfiguration} from "../../lib/mediaSources.ts";
import {mapCastleRecordings, recordingCatalogueQuery, type CastleRecording} from "./castleRecordings.ts";

const catalogueCache = new Map<string, {expires: number; request: Promise<CastleRecording[]>}>();

/** Share one small source catalogue across the main player and hourly navigation. */
export function useCastleRecordings(schema: string, enabled: boolean) {
    const [state, setState] = useState<{schema: string; recordings: CastleRecording[]; error: string | null}>({schema: "", recordings: [], error: null});
    useEffect(() => {
        if (!enabled || !schema) return;
        let cancelled = false;
        let entry = catalogueCache.get(schema);
        if (!entry || entry.expires < Date.now()) {
            // @ts-expect-error Generated API types omit early filter expressions and named operator inputs.
            const request = Promise.resolve(retrieval.postExecuteQuery(schema, recordingCatalogueQuery()))
                .then(response => mapCastleRecordings(response.retrievables ?? [], mediaConfiguration()));
            entry = {expires: Date.now() + 300_000, request};
            catalogueCache.set(schema, entry);
            const cachedEntry = entry;
            void request.catch(() => { if (catalogueCache.get(schema) === cachedEntry) catalogueCache.delete(schema); });
        }
        void entry.request.then(recordings => {
            if (!cancelled) setState({schema, recordings, error: null});
        }).catch(() => {
            // Direct-file navigation remains available if the catalogue API is unavailable.
            if (!cancelled) setState({schema, recordings: [], error: "The recording catalogue could not be loaded. Please reload to try again."});
        });
        return () => { cancelled = true; };
    }, [schema, enabled]);
    return {
        recordings: enabled && state.schema === schema ? state.recordings : [],
        loading: enabled && Boolean(schema) && state.schema !== schema,
        error: enabled && state.schema === schema ? state.error : null,
    };
}
