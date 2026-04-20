"use client";

import {useAuth} from "../state/AuthContext";
import LoginModal from "./LoginModal";

/**
 * This was added because for the VBS DRES was used. Can be removed if the frontend is used in a non competition context.
 */
export default function AuthGate() {
    const {loginOpen, closeLogin} = useAuth();

    if (!loginOpen) return null;
    return <LoginModal onClose={closeLogin}/>;
}
