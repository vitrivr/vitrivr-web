"use client";

import React, {createContext, useContext, useEffect, useMemo, useState} from "react";
import type {ApiUser, LoginRequest} from "../dres/generated/api";
import {UserApiFactory} from "../dres/generated/api";
import {dresAxios} from "../dres/generated/api/dresAxios";

type AuthState = {
    status: "loading" | "loggedOut" | "loggedIn";
    user: ApiUser | null;
    session: string | null;
    login: (req: LoginRequest) => Promise<void>;
    logout: () => Promise<void>;
    loginOpen: boolean;
    openLogin: () => void;
    closeLogin: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

const LS_SESSION = "dres_session";
const LS_USER = "dres_user";

export function AuthProvider({children}: { children: React.ReactNode }) {
    const basePath = useMemo(() => (import.meta.env.VITE_DRES_BASE_URL ?? "").toString(), []);
    const userApi = useMemo(() => UserApiFactory(undefined, basePath, dresAxios), [basePath]);
    const [status, setStatus] = useState<AuthState["status"]>("loading");
    const [session, setSession] = useState<string | null>(null);
    const [user, setUser] = useState<ApiUser | null>(null);
    const [loginOpen, setLoginOpen] = useState(false);
    const openLogin = () => setLoginOpen(true);
    const closeLogin = () => setLoginOpen(false);


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

    const login = async (req: LoginRequest) => {
        // 1) login (sets cookie)
        const loginResp = await userApi.postApiV2Login(req);
        const loggedInUser = loginResp.data ?? null;

        // 2) fetch sessionId (cookie-authenticated call)
        const sessionResp = await userApi.getApiV2UserSession();
        const sessionId = sessionResp.data;

        setUser(loggedInUser);
        setSession(sessionId);
        setStatus("loggedIn");

        setLoginOpen(false);

        try {
            window.localStorage.setItem(LS_SESSION, sessionId);
            window.localStorage.setItem(LS_USER, JSON.stringify(loggedInUser));
        } catch {
            // ignore
        }
    };

    const logout = async () => {
        try {
            // optional server-side logout
            // note: endpoint accepts session query param, but cookie should also work
            if (session) await userApi.getApiV2Logout(session);
        } catch {
            // ignore
        }

        setUser(null);
        setSession(null);
        setStatus("loggedOut");

        try {
            window.localStorage.removeItem(LS_SESSION);
            window.localStorage.removeItem(LS_USER);
        } catch {
            // ignore
        }
    };

    const value: AuthState = {status, user, session, login, logout, loginOpen, openLogin, closeLogin};

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
    return ctx;
}
