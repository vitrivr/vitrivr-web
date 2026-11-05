"use client";

import React, {createContext, useContext, useEffect, useMemo, useState} from "react";
import type {ApiUser, LoginRequest} from "../dres/generated/api";
import {UserApiFactory} from "../dres/generated/api";
import {dresAxios} from "../dres/generated/api/dresAxios";
import {authenticateDres, type DresLoginOptions} from "../dres/auth.ts";

type AuthState = {
    status: "loading" | "loggedOut" | "loggedIn";
    user: ApiUser | null;
    session: string | null;
    login: (req: LoginRequest, options?: DresLoginOptions) => Promise<void>;
    logout: () => Promise<void>;
    loginOpen: boolean;
    openLogin: () => void;
    closeLogin: () => void;
    evaluationId: string | null;
    setEvaluationId: (id: string | null) => void;
};

const AuthContext = createContext<AuthState | null>(null);
const LS_SESSION = "dres_session";
const LS_USER = "dres_user";
const LS_EVAL = "dres_evaluation_id";

export function AuthProvider({children}: { children: React.ReactNode }) {
    const basePath = useMemo(() => (import.meta.env.VITE_DRES_BASE_URL ?? "").toString(), []);
    const userApi = useMemo(() => UserApiFactory(undefined, basePath, dresAxios), [basePath]);
    const [status, setStatus] = useState<AuthState["status"]>("loading");
    const [session, setSession] = useState<string | null>(null);
    const [user, setUser] = useState<ApiUser | null>(null);
    const [loginOpen, setLoginOpen] = useState(false);
    const openLogin = () => setLoginOpen(true);
    const closeLogin = () => setLoginOpen(false);
    const [evaluationId, _setEvaluationId] = useState<string | null>(null);

    useEffect(() => {
        try {
            const evalId = window.localStorage.getItem(LS_EVAL);
            if (evalId) _setEvaluationId(evalId);
        } catch {
            //
        }
    }, []);

    const setEvaluationId = (id: string | null) => {
        _setEvaluationId(id);
        try {
            if (id) window.localStorage.setItem(LS_EVAL, id);
            else window.localStorage.removeItem(LS_EVAL);
        } catch {
            //
        }
    };

    // restore from localStorage
    useEffect(() => {
        try {
            const s = window.localStorage.getItem(LS_SESSION);
            const u = window.localStorage.getItem(LS_USER);
            if (s) setSession(s);
            if (u) setUser(JSON.parse(u));
            setStatus(s ? "loggedIn" : "loggedOut");
        } catch {
            setStatus("loggedOut");
        }
    }, []);

    const login = async (req: LoginRequest, options?: DresLoginOptions) => {
        const {user: loggedInUser, session: sessionId} = await authenticateDres(userApi, req, options);
        if (options?.signal?.aborted) throw new DOMException("Sign-in cancelled.", "AbortError");

        setUser(loggedInUser);
        setSession(sessionId);
        setStatus("loggedIn");

        setEvaluationId(null);
        setLoginOpen(false);

        try {
            window.localStorage.setItem(LS_SESSION, sessionId);
            window.localStorage.setItem(LS_USER, JSON.stringify(loggedInUser));
        } catch {
            // ignore
        }
    };

    const logout = async () => {
        // Clear local state immediately even when the remote server is unreachable.
        const previousSession = session;
        setUser(null);
        setSession(null);
        setStatus("loggedOut");
        setEvaluationId(null);
        try {
            window.localStorage.removeItem(LS_SESSION);
            window.localStorage.removeItem(LS_USER);
        } catch { /* Browser storage is optional. */ }
        try {
            // optional server-side logout
            // note: endpoint accepts session query param, but cookie should also work
            if (previousSession) await userApi.getApiV2Logout(previousSession);
        } catch {
            // ignore
        }

    };

    const value: AuthState = {
        status,
        user,
        session,
        login,
        logout,
        loginOpen,
        openLogin,
        closeLogin,
        evaluationId,
        setEvaluationId
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
    return ctx;
}
