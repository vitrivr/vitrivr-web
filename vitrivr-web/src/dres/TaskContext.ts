import {createContext, useContext} from "react";
import type {SubmissionKind} from "./taskKind.ts";
export type DresTaskState = {kind: SubmissionKind; refresh: () => Promise<SubmissionKind>; reportSubmissionError: (error: unknown) => void};
export const DresTaskContext = createContext<DresTaskState | null>(null);
export function useDresTask() {
    const context = useContext(DresTaskContext);
    if (!context) throw new Error("DresTaskProvider is required.");
    return context;
}
