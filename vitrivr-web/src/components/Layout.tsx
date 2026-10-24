import {useState, type PropsWithChildren} from "react";
import {useLocation} from "react-router-dom";
import "./SearchTheme.css";
import Header from "./Header";
import AuthGate from "./AuthGate";
import EvaluationPicker from "./EvaluationPicker";
import {useAuth} from "../state/AuthContext";

function Layout({children, onHome}: PropsWithChildren<{onHome: () => void}>) {
    const isSearch = useLocation().pathname === "/";
    const [theme, setTheme] = useState<"light" | "dark">(() => {
        try {
            const saved = localStorage.getItem("vitrivr_search_theme");
            if (saved === "light" || saved === "dark") return saved;
        } catch { /* Storage is optional. */ }
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    });
    const toggleTheme = () => {
        const next = theme === "light" ? "dark" : "light";
        setTheme(next);
        try { localStorage.setItem("vitrivr_search_theme", next); } catch { /* Storage is optional. */ }
    };
    const {status, evaluationId} = useAuth();
    return (
        <div className={isSearch ? `search-shell search-shell--${theme}` : undefined}>
            <Header onHome={onHome} theme={isSearch ? theme : undefined} onToggleTheme={toggleTheme}/>
            <main className="layout">{children}</main>
            <AuthGate/>
            {status === "loggedIn" && !evaluationId && <EvaluationPicker/>}
        </div>
    );
}

export default Layout;
