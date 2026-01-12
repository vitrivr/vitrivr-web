import "./Header.css";
import {useAuth} from "../state/AuthContext";

function Header() {
    const {status, user, logout, openLogin} = useAuth();

    const username = user?.username ?? "unknown";

    return (
        <header className="header">
            <div className="header__inner">
                <div className="header__brand">VITRIVR</div>
                <div className="header__dot">·</div>
                <div className="header__subtitle">Multimedia Retrieval</div>

                <div className="header__actions">
                    {status === "loggedIn" ? (
                        <div className="header__auth">
                            <span className="header__user">{username}</span>
                            <button className="header__btn" onClick={logout} type="button">
                                Logout
                            </button>
                        </div>
                    ) : (
                        <button className="header__btn" onClick={openLogin} type="button">
                            Login
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}

export default Header;
