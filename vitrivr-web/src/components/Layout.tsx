import type {PropsWithChildren} from "react";
import Header from "./Header";
import AuthGate from "./AuthGate";
import EvaluationPicker from "./EvaluationPicker";
import {useAuth} from "../state/AuthContext";

function Layout({children}: PropsWithChildren) {
    const {status, evaluationId} = useAuth();
    return (
        <div>
            <Header/>
            <main className="layout">{children}</main>
            <AuthGate/>
            {status === "loggedIn" && !evaluationId && <EvaluationPicker/>}
        </div>
    );
}

export default Layout;
