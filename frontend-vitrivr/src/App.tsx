import Layout from "./components/Layout";
import Card from "./components/Card";
import SearchCard from "./components/SearchCard";

export default function App() {
    return (
        <Layout>
            <Card
                title="Welcome to vitrivr"
                subtitle="This is a very cool and extremely helpful subtitle. "
                className="mb-6"
            >
                <p className="text-sm text-neutral-600 leading-relaxed">
                    This is a work-in-progress frontend. Right now the frontend can (barely) search for images and
                    videos
                    with the help of CLIP. Emotions, 3D objects are more will at some point also be possible. Stay
                    tuned.
                </p>
            </Card>
            <SearchCard/>
        </Layout>
    );
}
