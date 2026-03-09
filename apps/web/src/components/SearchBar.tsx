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
      <Search className="ui-text-muted absolute left-3 top-1/2 size-4 -translate-y-1/2" />
      <input
        type="text"
        placeholder="Search clips..."
        value={searchQuery}
        onChange={handleChange}
        className="ui-input w-full rounded-lg py-2 pl-10 pr-8 text-sm"
      />
      {searchQuery.length > 0 && (
        <button
          onClick={clearSearch}
          className="ui-icon-button absolute right-2 top-1/2 rounded p-0.5 -translate-y-1/2"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
