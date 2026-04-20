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

import React, {useState} from "react";
import {useAuth} from "../state/AuthContext";
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

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            await login({username: username.trim(), password});
            onClose?.();
        } catch (err: any) {
            setError(err?.response?.data?.description ?? err?.message ?? "Login failed.");
        } finally {
            setSubmitting(false);
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
                        onClick={onClose}
                    >
                        ×
                    </button>
                )}

                <div className="lm-head">
                    <div className="lm-title">Login</div>
                    <div className="lm-subtitle">Sign in to DRES to continue.</div>
                </div>

                <form className="lm-form" onSubmit={onSubmit}>
                    <label className="lm-label">
                        Username
                        <input
                            className="lm-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="username"
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
                        />
                    </label>

                    {error && <div className="lm-error">{error}</div>}

                    <button className="lm-btn" type="submit" disabled={submitting}>
                        {submitting ? "Signing in…" : "Sign in"}
                    </button>
                </form>
            </div>
        </div>
    );
}
