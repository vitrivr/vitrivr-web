import type {PropsWithChildren} from "react";
import Header from "./Header";
import "../styles/styles.css"
import AuthGate from "./AuthGate.tsx";

function Layout({children}: PropsWithChildren) {
    return (
        <div>
            <Header/>
            <main>{children}</main>
            <AuthGate/>
        </div>
    );
}

export default Layout;
