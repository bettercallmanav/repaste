import { useCallback, useRef } from "react";
import type { ClipSearchFilters, ContentType } from "@clipm/contracts";
import { Search, X } from "lucide-react";
import { useClipboardStore } from "../store.ts";

const CONTENT_TYPE_OPTIONS: ReadonlyArray<{ value: ContentType; label: string }> = [
  { value: "text", label: "Text" },
  { value: "image", label: "Image" },
  { value: "url", label: "URL" },
  { value: "code", label: "Code" },
  { value: "email", label: "Email" },
  { value: "color", label: "Color" },
  { value: "json", label: "JSON" },
  { value: "phone", label: "Phone" },
  { value: "filePath", label: "File path" },
  { value: "richText", label: "Rich text" },
];

function hasActiveFilters(filters: ClipSearchFilters): boolean {
  return Boolean(
    filters.contentType
      || filters.pinned !== undefined
      || filters.tag?.trim()
      || filters.sourceApp?.trim()
      || filters.dateFrom
      || filters.dateTo,
  );
}

export function SearchBar() {
  const {
    searchQuery,
    searchFilters,
    setSearchQuery,
    setSearchFilters,
    search,
    clearSearch,
  } = useClipboardStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const activeFilters = hasActiveFilters(searchFilters);
  const activeFilterCount = [
    searchFilters.contentType,
    searchFilters.pinned !== undefined ? "pinned" : "",
    searchFilters.tag?.trim(),
    searchFilters.sourceApp?.trim(),
    searchFilters.dateFrom,
    searchFilters.dateTo,
  ].filter(Boolean).length;
  const hasActiveSearch = searchQuery.trim().length > 0 || activeFilters;

  const scheduleSearch = useCallback(
    (nextQuery: string, nextFilters: ClipSearchFilters) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (nextQuery.trim().length > 0 || hasActiveFilters(nextFilters)) {
          void search(nextQuery, nextFilters);
        } else {
          clearSearch();
        }
      }, 250);
    },
    [search, clearSearch],
  );

  const handleFilterChange = useCallback(
    (patch: Partial<ClipSearchFilters>) => {
      const nextFilters = {
        ...searchFilters,
        ...patch,
      };
      setSearchFilters(patch);
      scheduleSearch(searchQuery, nextFilters);
    },
    [searchFilters, searchQuery, scheduleSearch, setSearchFilters],
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="ui-text-muted absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search clips..."
          value={searchQuery}
          onChange={(e) => {
            const value = e.target.value;
            setSearchQuery(value);
            scheduleSearch(value, searchFilters);
          }}
          className="ui-input w-full rounded-lg py-2 pl-10 pr-8 text-sm"
        />
        {hasActiveSearch && (
          <button
            onClick={() => {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              clearSearch();
            }}
            className="ui-icon-button absolute right-2 top-1/2 rounded p-0.5 -translate-y-1/2"
            title="Clear search"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select
          value={searchFilters.contentType ?? ""}
          onChange={(e) =>
            handleFilterChange({
              contentType: e.target.value.length > 0
                ? e.target.value as ContentType
                : undefined,
            })
          }
          className="ui-input rounded-lg px-3 py-2 text-xs"
        >
          <option value="">All types</option>
          {CONTENT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label className="ui-card flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
          <input
            type="checkbox"
            checked={searchFilters.pinned === true}
            onChange={(e) =>
              handleFilterChange({ pinned: e.target.checked ? true : undefined })
            }
            className="accent-blue-500"
          />
          <span className="ui-text-secondary">Pinned only</span>
        </label>

        <input
          type="text"
          value={searchFilters.tag ?? ""}
          onChange={(e) =>
            handleFilterChange({
              tag: e.target.value.length > 0 ? e.target.value : undefined,
            })
          }
          placeholder="Filter by tag"
          className="ui-input rounded-lg px-3 py-2 text-xs"
        />

        <input
          type="text"
          value={searchFilters.sourceApp ?? ""}
          onChange={(e) =>
            handleFilterChange({
              sourceApp: e.target.value.length > 0 ? e.target.value : undefined,
            })
          }
          placeholder="Source app"
          className="ui-input rounded-lg px-3 py-2 text-xs"
        />

        <input
          type="date"
          value={searchFilters.dateFrom ?? ""}
          onChange={(e) =>
            handleFilterChange({
              dateFrom: e.target.value.length > 0 ? e.target.value : undefined,
            })
          }
          className="ui-input rounded-lg px-3 py-2 text-xs"
        />

        <input
          type="date"
          value={searchFilters.dateTo ?? ""}
          onChange={(e) =>
            handleFilterChange({
              dateTo: e.target.value.length > 0 ? e.target.value : undefined,
            })
          }
          className="ui-input rounded-lg px-3 py-2 text-xs"
        />
      </div>

      {hasActiveSearch && (
        <div className="flex items-center justify-between gap-2">
          <span className="ui-text-muted text-xs">
            {activeFilterCount > 0
              ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active`
              : "Text search active"}
          </span>
          <button
            onClick={() => {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              clearSearch();
            }}
            className="ui-tab rounded px-2 py-1 text-xs"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
