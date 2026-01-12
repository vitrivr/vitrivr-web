"use client";

import {useAuth} from "../state/AuthContext";
import LoginModal from "./LoginModal";

export default function AuthGate() {
    const {loginOpen, closeLogin} = useAuth();

    if (!loginOpen) return null;
    return <LoginModal onClose={closeLogin}/>;
}
