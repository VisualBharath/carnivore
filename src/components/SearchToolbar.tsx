import { useCallback, useEffect, useRef, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { MeatCategory, OriginLocation, SortOption } from "../types";
import { MEAT_CATEGORY_LABELS } from "../services/placesService";

interface SearchToolbarProps {
  origin: OriginLocation;
  onOriginChange: (nextOrigin: OriginLocation) => void;
  activeCategory: MeatCategory;
  onCategoryChange: (cat: MeatCategory) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  radiusMeters: number;
  onRadiusChange: (radius: number) => void;
  openNowOnly: boolean;
  onOpenNowChange: (openOnly: boolean) => void;
  resultCount: number;
  isLoading: boolean;
}

const ALL_CATEGORIES: MeatCategory[] = [
  "all",
  "steakhouse",
  "bbq",
  "biryani",
  "seafood",
  "chicken",
  "pork",
];

const SORT_OPTIONS: Array<{ id: SortOption; label: string }> = [
  { id: "optimal", label: "Optimal Visit" },
  { id: "rating", label: "Top Rated" },
  { id: "reviews", label: "Most Reviewed" },
  { id: "distance", label: "Shortest Drive" },
];

const RADIUS_OPTIONS = [
  { meters: 5000, label: "5 km" },
  { meters: 12000, label: "12 km" },
  { meters: 25000, label: "25 km" },
];

export function SearchToolbar({
  origin,
  onOriginChange,
  activeCategory,
  onCategoryChange,
  sortBy,
  onSortChange,
  radiusMeters,
  onRadiusChange,
  openNowOnly,
  onOpenNowChange,
  resultCount,
  isLoading,
}: SearchToolbarProps) {
  const placesLib = useMapsLibrary("places");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);

  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!placesLib) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsFetchingSuggestions(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setIsFetchingSuggestions(true);
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
        }
        const res = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: trimmed,
          sessionToken: sessionTokenRef.current,
        });
        setSuggestions(res.suggestions ?? []);
        setIsDropdownOpen(true);
      } catch (err) {
        console.warn("Autocomplete suggestions error:", err);
        setSuggestions([]);
      } finally {
        setIsFetchingSuggestions(false);
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [placesLib, query]);

  const handleSelectSuggestion = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!suggestion.placePrediction) return;
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ["location", "displayName", "formattedAddress"],
        });

        if (place.location) {
          const label =
            place.displayName ||
            place.formattedAddress ||
            suggestion.placePrediction.text.text;
          onOriginChange({
            lat: place.location.lat(),
            lng: place.location.lng(),
            label,
            isCurrentGps: false,
          });
        }

        setQuery("");
        setSuggestions([]);
        setIsDropdownOpen(false);
        sessionTokenRef.current = null;
      } catch (err) {
        console.error("Failed to fetch selected autocomplete place:", err);
      }
    },
    [onOriginChange]
  );

  return (
    <div className="p-4 border-b border-[#2A2F3A] bg-[#111317] space-y-3 shrink-0">
      {/* Location Autocomplete Search Input */}
      <div ref={containerRef} className="relative">
        <div className="flex items-center gap-2 h-11 px-3 rounded-lg bg-[#0F1115] border border-[#2A2F3A] focus-within:border-[#F97316] focus-within:ring-1 focus-within:ring-[#F97316] transition-all">
          <Search className="w-4 h-4 text-[#94A3B8] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setIsDropdownOpen(true)}
            placeholder={`Search neighborhood or city (Current: ${origin.label})`}
            aria-label="Search starting location"
            className="w-full bg-transparent text-sm text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSuggestions([]);
                setIsDropdownOpen(false);
              }}
              aria-label="Clear location search"
              className="text-[#94A3B8] hover:text-[#F8FAFC] p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Autocomplete Suggestions Dropdown */}
        {isDropdownOpen && (suggestions.length > 0 || isFetchingSuggestions) && (
          <div className="absolute left-0 right-0 top-12 z-40 rounded-lg bg-[#22262E] border border-[#2A2F3A] shadow-[0_12px_28px_-4px_rgba(0,0,0,0.75)] overflow-hidden">
            {isFetchingSuggestions && suggestions.length === 0 ? (
              <div className="px-3.5 py-2.5 text-xs text-[#94A3B8]">
                Searching locations...
              </div>
            ) : (
              <ul role="listbox" className="divide-y divide-[#2A2F3A] max-h-60 overflow-y-auto">
                {suggestions.map((item, idx) => {
                  const text = item.placePrediction?.text.text;
                  if (!text) return null;
                  return (
                    <li key={item.placePrediction?.placeId ?? idx}>
                      <button
                        type="button"
                        onClick={() => void handleSelectSuggestion(item)}
                        className="w-full text-left px-3.5 py-2.5 text-sm text-[#F8FAFC] hover:bg-[#F97316]/15 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5 text-[#F97316] shrink-0" />
                        <span className="truncate">{text}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Category Filter Strip (visible on all viewports for full cut control including Chicken & Pork) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {ALL_CATEGORIES.map((cat) => {
          const selected = activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] ${
                selected
                  ? "bg-[#F97316] text-white"
                  : "bg-[#181B20] text-[#94A3B8] border border-[#2A2F3A] hover:text-[#F8FAFC] hover:border-[#F97316]/50"
              }`}
            >
              {MEAT_CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>

      {/* Sort & Constraints Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1 bg-[#181B20] p-1 rounded-lg border border-[#2A2F3A] overflow-x-auto">
          {SORT_OPTIONS.map((opt) => {
            const active = sortBy === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSortChange(opt.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? "bg-[#22262E] text-[#F8FAFC]"
                    : "text-[#94A3B8] hover:text-[#F8FAFC]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Radius selector */}
          <div className="flex items-center gap-1 text-xs text-[#94A3B8]">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#64748B]" />
            <select
              aria-label="Search radius"
              value={radiusMeters}
              onChange={(e) => onRadiusChange(Number(e.target.value))}
              className="bg-[#181B20] border border-[#2A2F3A] rounded-md px-2 py-1 text-xs text-[#F8FAFC] font-mono tabular-nums focus:outline-none focus:border-[#F97316] cursor-pointer"
            >
              {RADIUS_OPTIONS.map((opt) => (
                <option key={opt.meters} value={opt.meters}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Open Now Toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={openNowOnly}
            onClick={() => onOpenNowChange(!openNowOnly)}
            className="flex items-center gap-2 text-xs text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer whitespace-nowrap shrink-0"
          >
            <span
              className={`w-8 h-4.5 rounded-full p-0.5 transition-colors border border-[#2A2F3A] flex items-center ${
                openNowOnly ? "bg-[#EA580C]" : "bg-[#0F1115]"
              }`}
            >
              <span
                className={`w-3 h-3 rounded-full transition-transform ${
                  openNowOnly ? "translate-x-3.5 bg-[#F97316]" : "translate-x-0 bg-[#64748B]"
                }`}
              />
            </span>
            <span>Open now</span>
          </button>
        </div>
      </div>

      {/* Quiet unboxed quality gate summary */}
      <div className="flex items-center justify-between text-xs text-[#94A3B8] pt-0.5">
        <span className="truncate">
          Origin: <strong className="text-[#F8FAFC] font-medium">{origin.label}</strong>
        </span>
        <span className="font-mono tabular-nums shrink-0">
          {isLoading
            ? "Scanning 500+ review spots..."
            : `${resultCount} verified ${resultCount === 1 ? "spot" : "spots"} · ≥ 500 reviews`}
        </span>
      </div>
    </div>
  );
}
