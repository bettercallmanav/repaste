import { useCallback, useMemo, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useClipboardStore } from "../store.ts";

const TYPE_CHIPS = ["text", "image", "url", "code", "email", "color", "json", "phone", "filePath", "richText"] as const;

const TOKEN_RE = /^(type|tag|app|pinned|from|to):/i;

function isoDaysAgo(days: number): string {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function parseTokens(query: string): string[] {
  return query
    .split(/\s+/)
    .filter((part) => TOKEN_RE.test(part))
    .map((token) => token.toLowerCase());
}

/**
 * Filter chips write real search tokens into the query, so the panel and
 * the typed syntax are one system (and the panel teaches the syntax).
 */
function toggleTokenIn(query: string, token: string): string {
  const parts = query.split(/\s+/).filter(Boolean);
  const has = parts.some((part) => part.toLowerCase() === token);
  let next = parts.filter((part) => part.toLowerCase() !== token);
  if (!has) {
    // type: and from: are single-choice — picking one replaces the other.
    const prefix = token.slice(0, token.indexOf(":") + 1);
    if (prefix === "type:" || prefix === "from:") {
      next = next.filter((part) => !part.toLowerCase().startsWith(prefix));
    }
    next.push(token);
  }
  return next.join(" ");
}

export function SearchBar() {
  const {
    searchQuery,
    searchFilters,
    setSearchQuery,
    search,
    clearSearch,
    knownTags,
    clips,
  } = useClipboardStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [showFilters, setShowFilters] = useState(false);

  const tokens = parseTokens(searchQuery);
  const hasActiveSearch = searchQuery.trim().length > 0;

  const timePresets = useMemo(
    () => [
      { label: "today", token: `from:${isoDaysAgo(0)}` },
      { label: "7 days", token: `from:${isoDaysAgo(7)}` },
      { label: "30 days", token: `from:${isoDaysAgo(30)}` },
    ],
    [],
  );

  const tagChips = useMemo(() => knownTags.slice(0, 6), [knownTags]);
  const appChips = useMemo(() => {
    const apps = new Set<string>();
    for (const clip of clips) {
      if (clip.sourceApp) apps.add(clip.sourceApp);
      if (apps.size >= 6) break;
    }
    return [...apps];
  }, [clips]);

  const scheduleSearch = useCallback(
    (nextQuery: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (nextQuery.trim().length > 0) {
          void search(nextQuery, searchFilters);
        } else {
          clearSearch();
        }
      }, 250);
    },
    [search, clearSearch, searchFilters],
  );

  const applyQuery = useCallback(
    (nextQuery: string) => {
      setSearchQuery(nextQuery);
      scheduleSearch(nextQuery);
    },
    [setSearchQuery, scheduleSearch],
  );

  const toggleToken = useCallback(
    (token: string) => applyQuery(toggleTokenIn(searchQuery, token.toLowerCase())),
    [applyQuery, searchQuery],
  );

  function chipClass(token: string): string {
    return tokens.includes(token.toLowerCase()) ? "ui-fchip ui-fchip-on ui-mono" : "ui-fchip ui-mono";
  }

  function handleClear() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    clearSearch();
    setShowFilters(false);
  }

  return (
    <div className="space-y-2">
      {/* Command row */}
      <div className="flex items-center gap-2">
        <span className="ui-hotkey ui-mono">⌘⇧V</span>
        <div className="relative flex-1">
          <Search className="ui-text-muted absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search your clipboard…"
            value={searchQuery}
            onChange={(e) => applyQuery(e.target.value)}
            className="ui-input ui-mono w-full rounded-lg py-1.5 pl-8 pr-2 text-[13px]"
          />
        </div>
        {hasActiveSearch && (
          <button onClick={handleClear} className="ui-icon-button rounded-lg p-1.5" title="Clear search">
            <X className="size-3.5" />
          </button>
        )}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`relative shrink-0 rounded-lg p-1.5 ${showFilters ? "ui-tab-active" : "ui-icon-button"}`}
          title="Filters"
        >
          <SlidersHorizontal className="size-3.5" />
          {tokens.length > 0 && (
            <span className="ui-mono absolute -right-1 -top-1 flex size-[13px] items-center justify-center rounded-full bg-blue-500 text-[8.5px] font-bold text-white">
              {tokens.length}
            </span>
          )}
        </button>
      </div>

      {/* Token builder — chips write real tokens into the query above */}
      {showFilters && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="ui-flabel ui-mono uppercase">Type</span>
            {TYPE_CHIPS.map((type) => (
              <button key={type} className={chipClass(`type:${type}`)} onClick={() => toggleToken(`type:${type}`)}>
                {type}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="ui-flabel ui-mono uppercase">Time</span>
            {timePresets.map(({ label, token }) => (
              <button key={token} className={chipClass(token)} onClick={() => toggleToken(token)}>
                {label}
              </button>
            ))}
          </div>
          {tagChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="ui-flabel ui-mono uppercase">Tags</span>
              {tagChips.map((tag) => (
                <button key={tag} className={chipClass(`tag:${tag}`)} onClick={() => toggleToken(`tag:${tag}`)}>
                  {tag}
                </button>
              ))}
            </div>
          )}
          {appChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="ui-flabel ui-mono uppercase">Apps</span>
              {appChips.map((app) => (
                <button key={app} className={chipClass(`app:${app.toLowerCase()}`)} onClick={() => toggleToken(`app:${app.toLowerCase()}`)}>
                  {app}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="ui-flabel ui-mono uppercase">More</span>
            <button className={chipClass("pinned:true")} onClick={() => toggleToken("pinned:true")}>
              pinned only
            </button>
            <span className="ui-text-muted ui-mono text-[9.5px]">
              chips write real tokens — exact dates: type from:2026-07-01
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
