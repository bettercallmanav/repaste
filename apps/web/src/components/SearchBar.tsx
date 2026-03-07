import { useRef, useCallback } from "react";
import { Search, X } from "lucide-react";
import { useClipboardStore } from "../store.ts";

export function SearchBar() {
  const { searchQuery, setSearchQuery, search, clearSearch } = useClipboardStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (value.trim().length > 0) {
          search(value);
        } else {
          clearSearch();
        }
      }, 250);
    },
    [setSearchQuery, search, clearSearch],
  );

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
      <input
        type="text"
        placeholder="Search clips..."
        value={searchQuery}
        onChange={handleChange}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-10 pr-8 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none"
      />
      {searchQuery.length > 0 && (
        <button
          onClick={clearSearch}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:text-zinc-200"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
