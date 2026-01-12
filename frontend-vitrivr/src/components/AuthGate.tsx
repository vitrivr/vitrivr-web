"use client";

import {useAuth} from "../state/AuthContext";
import LoginModal from "./LoginModal";

export default function AuthGate() {
    const {status, loginOpen, closeLogin} = useAuth();

    if (status === "loading") return null;

    if (status !== "loggedIn" || loginOpen) {
        return <LoginModal onClose={status === "loggedIn" ? closeLogin : undefined}/>;
    }

    return null;
}
