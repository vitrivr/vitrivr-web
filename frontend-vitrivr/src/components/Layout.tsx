import type {PropsWithChildren} from "react";
import Header from "./Header";
import "../styles/styles.css"

function Layout({children}: PropsWithChildren) {
    return (
        <div>
            <Header/>
            <main className="layout">{children}</main>
        </div>
    );
}

export default Layout;
