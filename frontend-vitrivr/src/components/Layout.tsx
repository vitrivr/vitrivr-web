import type {PropsWithChildren} from "react";
import Header from "./Header";
import "../styles/styles.css"
import AuthGate from "./AuthGate.tsx";

function Layout({children}: PropsWithChildren) {
    return (
        <AuthGate>
            <div>
                <Header/>
                <main className="layout">{children}</main>
            </div>
        </AuthGate>
    );
}

export default Layout;
