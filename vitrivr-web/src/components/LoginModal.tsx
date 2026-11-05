/**
 * LoginModal
 *
 * A modal dialog for signing in to DRES.
 *
 * Features:
 * - Collects username and password
 * - Submits credentials through auth context
 * - Shows loading and error states
 * - Supports optional closing via close button
 *
 * Props:
 * @param onClose - Optional callback fired when the modal should close
 *
 * Behavior:
 * - Prevents default form submission
 * - Trims the username before login
 * - Closes automatically after a successful login
 * - Displays an error message when login fails
 *
 * Dependencies:
 * - Uses `useAuth` for the `login` action
 *
 * Example:
 * <LoginModal onClose={() => setOpen(false)} />
 */

"use client";

import React, {useEffect, useRef, useState} from "react";
import {useAuth} from "../state/AuthContext";
import {dresErrorMessage, type DresLoginStage} from "../dres/auth.ts";
import "./LoginModal.css";

type LoginModalProps = {
    onClose?: () => void;
};

export default function LoginModal({onClose}: LoginModalProps) {
    const {login} = useAuth();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [stage, setStage] = useState<DresLoginStage>("credentials");
    const activeRequest = useRef<AbortController | null>(null);

    useEffect(() => () => {
        activeRequest.current?.abort();
        activeRequest.current = null;
    }, []);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (activeRequest.current) return;
        const controller = new AbortController();
        activeRequest.current = controller;
        setError(null);
        setSubmitting(true);

        try {
            await login({username: username.trim(), password}, {signal: controller.signal, onStage: next => {
                if (!controller.signal.aborted) setStage(next);
            }});
            onClose?.();
        } catch (err) {
            if (!controller.signal.aborted && activeRequest.current === controller) setError(dresErrorMessage(err));
        } finally {
            if (activeRequest.current === controller) {
                activeRequest.current = null;
                setSubmitting(false);
            }
        }
    };

    return (
        <div className="lm-backdrop" role="dialog" aria-modal="true" aria-label="Login">
            <div className="lm-modal">
                {onClose && (
                    <button
                        type="button"
                        className="lm-close"
                        aria-label="Close login"
                        onClick={() => { activeRequest.current?.abort(); onClose(); }}
                    >
                        ×
                    </button>
                )}

                <div className="lm-head">
                    <div className="lm-title">Login</div>
                    <div className="lm-subtitle">Sign in to DRES to continue.</div>
                </div>

                <form className="lm-form" onSubmit={onSubmit} data-log-private aria-busy={submitting}>
                    <label className="lm-label">
                        Username
                        <input
                            className="lm-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="username"
                            required
                            disabled={submitting}
                            autoFocus
                        />
                    </label>

                    <label className="lm-label">
                        Password
                        <input
                            className="lm-input"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            disabled={submitting}
                        />
                    </label>

                    {error && <div className="lm-error" role="alert">{error}</div>}

                    <button className="lm-btn" type="submit" disabled={submitting}>
                        {submitting ? stage === "session" ? "Checking session…" : "Signing in…" : "Sign in"}
                    </button>
                    {submitting && <button className="btn" type="button" onClick={() => activeRequest.current?.abort()}>Cancel</button>}
                </form>
            </div>
        </div>
    );
}
