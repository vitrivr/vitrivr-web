/**
 * Header
 *
 * The top navigation bar for the application.
 *
 * Features:
 * - Displays the vitrivr brand and logo
 * - Shows authentication status in the header
 * - Lets logged-in users open the evaluation picker
 * - Lets users log in or log out
 *
 * Dependencies:
 * - Uses `useAuth` for authentication state and actions
 * - Uses `EvaluationPicker` for selecting an evaluation or task
 *
 * Example:
 * <Header />
 */

import "./Header.css";
import {useAuth} from "../state/AuthContext";
import {useId, useRef, useState} from "react";
import {Link} from "react-router-dom";
import {useSearch} from "../state/SearchContext";
import FrontendSettingsPanel from "./FrontendSettingsPanel.tsx";
import SchemaSelector from "./SchemaSelector";
import EvaluationPicker from "./EvaluationPicker";

function Header({theme, onToggleTheme, onHome}: {theme?: "light" | "dark"; onToggleTheme?: () => void; onHome: () => void}) {
    const {status, user, logout, openLogin} = useAuth();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [showEvalPicker, setShowEvalPicker] = useState(false);

    const {schema, setSchema} = useSearch();
    const settingsRef = useRef<HTMLDialogElement>(null);
    const settingsTitle = useId();
    const username = user?.username ?? "unknown";

    return (
        <>
            {showEvalPicker && <EvaluationPicker onClose={() => setShowEvalPicker(false)}/>}

            <header className="header">
                <div className="header__inner">
                    <Link to="/" className="header__home" aria-label="vitrivr start page — reset search"
                        onClick={(event) => {
                            if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onHome();
                        }}>
                        <img src="/vitrivr.svg" className="header__logo" alt="vitrivr"/>
                    </Link>

                    {/* RIGHT */}
                    <div className="header__actions">
                        {theme && <button type="button" className="header__btn theme-toggle"
                            onClick={onToggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
                            title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}>
                            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                {theme === "dark" ? <>
                                    <circle cx="12" cy="12" r="4"/>
                                    <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>
                                </> : <path d="M20.5 13a8.5 8.5 0 0 1-9.5-9.5A8.5 8.5 0 1 0 20.5 13Z"/>}
                            </svg>
                        </button>}
                        <button type="button" className="header__btn header__settingsButton"
                            onClick={() => { setSettingsOpen(true); settingsRef.current?.showModal(); }} aria-haspopup="dialog"
                            title="Settings" aria-label="Settings">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                                <path d="M4 7h16M4 17h16"/>
                                <circle cx="9" cy="7" r="3" fill="var(--surface)"/>
                                <circle cx="15" cy="17" r="3" fill="var(--surface)"/>
                            </svg>
                        </button>
                        {status === "loggedIn" ? (
                            <div className="header__auth">
                                <button
                                    className="header__btn"
                                    type="button"
                                    onClick={() => setShowEvalPicker(true)}
                                    title="Select evaluation / task"
                                >
                                    Evaluation
                                </button>

                                <span className="header__user">{username}</span>
                                <button
                                    className="header__btn"
                                    onClick={() => {
                                        setShowEvalPicker(false);
                                        logout();
                                    }}
                                >
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <div className="header__auth">
                                <span className="header__user">Guest</span>
                                <button className="header__btn" onClick={openLogin}>
                                    Login
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>
            <dialog ref={settingsRef} className="header__settings" aria-labelledby={settingsTitle} onClose={() => setSettingsOpen(false)}
                onClick={(event) => { if (event.target === event.currentTarget) settingsRef.current?.close(); }}>
                <div className="header__settingsContent">
                    <div className="row-between header__settingsHeading">
                        <h2 id={settingsTitle}>Settings</h2>
                        <button type="button" className="header__btn" onClick={() => settingsRef.current?.close()} aria-label="Close settings">×</button>
                    </div>
                    <div className="header__settingsBody">
                        <SchemaSelector value={schema} onChange={setSchema} renderControl={control => {
                            const schemaSelector = <div className="stack-xs">
                                <span className="label">Schema</span>
                                {control}
                            </div>;
                            return settingsOpen ? <FrontendSettingsPanel schemaSelector={schemaSelector} onClose={() => settingsRef.current?.close()}/> : schemaSelector;
                        }}/>
                    </div>
                </div>
            </dialog>
        </>
    );
}

export default Header;
