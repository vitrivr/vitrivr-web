import type {PropsWithChildren} from "react";
import Header from "./Header";

function Layout({children}: PropsWithChildren) {
    return (
        <div className="min-h-screen bg-neutral-50 text-neutral-900">
            <Header/>
            <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
            <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-neutral-500">
                © {new Date().getFullYear()} DBIS
            </footer>
        </div>
    );
}

export default Layout;
