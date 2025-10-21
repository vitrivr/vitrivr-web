import {Routes, Route, Navigate} from "react-router-dom";
import Layout from "./components/Layout";
import Card from "./components/Card";
import {SearchCard} from "./components/SearchCard";
import VideoPage from "./components/VideoPage";

function Home() {
    return (
        <>
            <Card
                title="Welcome to vitrivr"
                subtitle="This is a very cool and extremely helpful subtitle."
                className="mb-6"
            >
                <p className="text-sm text-neutral-600 leading-relaxed">
                    This is a work-in-progress frontend. Right now the frontend can (barely) search for images and
                    videos with the help of CLIP. Emotions, 3D objects and more will at some point also be possible.
                    Stay tuned.
                </p>
            </Card>
            <SearchCard/>
        </>
    );
}

export default function App() {
    return (
        <Layout>
            <Routes>
                <Route path="/" element={<Home/>}/>
                <Route path="/video/:id" element={<VideoPage/>}/>
                <Route path="*" element={<Navigate to="/" replace/>}/>
            </Routes>
        </Layout>
    );
}
