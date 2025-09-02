function Header() {
    return (
        <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
            <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
                <div className="font-semibold text-lg">VITRIVR</div>
                <div className="text-neutral-400">·</div>
                <div className="text-neutral-600">Multimedia Retrieval</div>
                <div className="ml-auto flex items-center gap-2 text-sm text-neutral-500">
                </div>
            </div>
        </header>
    );
}

export default Header;
