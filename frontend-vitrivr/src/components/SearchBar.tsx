import { Fragment } from "react/jsx-runtime";
import { useState } from "react";

function SearchBar() {
  const [query, setQuery] = useState("");
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log("Searching for:", query);
    alert(`Pretend searching for: ${query}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-2">
      <input
        type="text"
        placeholder="Search..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1 border rounded px-3 py-2"
      />
      <button
        type="submit"
        className="bg-blue-600 text-white rounded px-4 py-2"
      >
        Search
      </button>
    </form>
  );
}

export default SearchBar;
