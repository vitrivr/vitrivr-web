"use client";

import React from "react";
import {useAuth} from "../state/AuthContext";
import LoginModal from "./LoginModal";

export default function AuthGate({children}: { children: React.ReactNode }) {
    const {status} = useAuth();

    if (status === "loading") return null; // or a splash screen
    if (status !== "loggedIn") return <LoginModal/>;

    return <>{children}</>;
}
