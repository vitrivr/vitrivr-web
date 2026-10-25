import {useState} from "react";
import {Routes, Route, Navigate} from "react-router-dom";
import Layout from "./components/Layout";
import {SearchCard} from "./components/SearchCard";
import VideoPage from "./components/VideoPage/VideoPage.tsx";
import {FrontendSettingsProvider} from "./state/FrontendSettingsContext.tsx";
import {SearchProvider} from "./state/SearchContext.tsx";
import "./styles/styles.css"

function Home() {
    return (
        <div className="sc-page">
            <SearchCard/>
        </div>
    );
}

export default function App() {
    const initialBlocks: never[] = [];
    const [searchSession, setSearchSession] = useState(0);
    const resetSearch = () => {
        setSearchSession(session => session + 1);
        window.scrollTo(0, 0);
    };
    return (
        <FrontendSettingsProvider>
        <SearchProvider key={searchSession} initial={{blocks: initialBlocks}}>
            <Layout onHome={resetSearch}>
                <Routes>
                    <Route path="/" element={<Home/>}/>
                    <Route path="/video/:id" element={<VideoPage/>}/>
                    <Route path="*" element={<Navigate to="/" replace/>}/>
                </Routes>
            </Layout>
        </SearchProvider>
        </FrontendSettingsProvider>
    );
}
