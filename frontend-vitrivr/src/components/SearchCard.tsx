import Card from "./Card";
import SearchBar from "./SearchBar";

export default function SearchCard() {
    return (
        <Card
            title="CLIP Search"
            subtitle="Type a textual prompt."
            actions={
                <div>schema: <code>sandbox</code></div>
            }
        >
            <SearchBar/>
        </Card>
    );
}