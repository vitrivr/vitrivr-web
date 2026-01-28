import "./Header.css";
import {useAuth} from "../state/AuthContext";
import {useState} from "react";
import EvaluationPicker from "./EvaluationPicker";

function Header() {
    const {status, user, logout, openLogin} = useAuth();
    const [showEvalPicker, setShowEvalPicker] = useState(false);

    const username = user?.username ?? "unknown";

    return (
        <>
            {showEvalPicker && (
                <EvaluationPicker onClose={() => setShowEvalPicker(false)}/>
            )}

            <header className="header">
                <div className="header__inner">
                    <div className="header__brand">VITRIVR</div>
                    <div className="header__dot">·</div>
                    <div className="header__subtitle">Multimedia Retrieval</div>

                    <div className="header__actions">
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
                                <button className="header__btn" onClick={openLogin}>Login</button>
                            </div>
                        )}
                    </div>
                </div>
            </header>
        </>
    );
}

export default Header;
