import Card from "./Card";
import SearchBar from "./SearchBar";

export default function SearchCard() {
    return (
        <Card
            title="CLIP Search"
            subtitle="Type a textual prompt."
            actions={
                <div className="text-xs text-neutral-500">schema: <code>sandbox</code></div>
            }
        >
            <SearchBar/>
        </Card>
    );
}