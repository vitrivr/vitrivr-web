import {Routes, Route, Navigate} from "react-router-dom";
import Layout from "./components/Layout";
import CardHeader from "./components/CardHeader";
import {SearchCard} from "./components/SearchCard";
import VideoPage from "./components/VideoPage";
import {SearchProvider} from "./state/SearchContext.tsx";
import "./styles/styles.css"

function Home() {
    return (
        <>
            <CardHeader
                title="Welcome to VITRIVR-WEB"
                subtitle="Search for multimedia content."
                className="mb-6"
            >
                <p className="text-sm text-neutral-600 leading-relaxed">
                </p>
            </CardHeader>
            <SearchCard/>
        </>
    );
}

export default function App() {
    const initialBlocks: never[] = [];
    return (
        <Layout>
            <SearchProvider initial={{blocks: initialBlocks}}>
                <Routes>
                    <Route path="/" element={<Home/>}/>
                    <Route path="/video/:id" element={<VideoPage/>}/>
                    <Route path="*" element={<Navigate to="/" replace/>}/>
                </Routes>
            </SearchProvider>
        </Layout>
    );
}
