import { Flame, Navigation } from "lucide-react";
import { MeatCategory } from "../types";

interface HeaderProps {
  activeCategory: MeatCategory;
  onSelectCategory: (category: MeatCategory) => void;
  onLocateMe: () => void;
  isLocating: boolean;
  onResetHome: () => void;
}

const NAV_CATEGORIES: Array<{ id: MeatCategory; label: string }> = [
  { id: "all", label: "All Cuts" },
  { id: "steakhouse", label: "Steakhouse" },
  { id: "bbq", label: "BBQ & Grill" },
  { id: "biryani", label: "Biryani" },
  { id: "seafood", label: "Seafood" },
];

export function Header({
  activeCategory,
  onSelectCategory,
  onLocateMe,
  isLocating,
  onResetHome,
}: HeaderProps) {
  return (
    <header className="h-16 px-4 lg:px-6 bg-[#111317] border-b border-[#2A2F3A] flex items-center justify-between gap-8 shrink-0 z-30">
      {/* Zone 1: Single-element Brand Wordmark */}
      <button
        type="button"
        onClick={onResetHome}
        className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] rounded-md px-1 py-0.5"
      >
        <Flame className="w-5 h-5 text-[#F97316] transition-transform duration-150 group-hover:scale-105" />
        <span className="font-display text-lg font-extrabold tracking-tight text-[#F8FAFC]">
          CarnivoreRoute
        </span>
      </button>

      {/* Zone 2: Clean single-line text navigation links */}
      <nav
        aria-label="Meat categories"
        className="hidden md:flex items-center gap-6 overflow-x-auto"
      >
        {NAV_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] rounded ${
                isActive
                  ? "text-[#F8FAFC]"
                  : "text-[#94A3B8] hover:text-[#F8FAFC]"
              }`}
            >
              {cat.label}
              {isActive && (
                <span className="absolute left-0 right-0 -bottom-[1px] h-[2px] bg-[#F97316]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: 1 Primary Action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onLocateMe}
          disabled={isLocating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F97316] hover:bg-[#EA580C] active:scale-[0.98] disabled:opacity-60 text-white text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          <Navigation className={`w-3.5 h-3.5 ${isLocating ? "animate-spin" : ""}`} />
          <span>{isLocating ? "Locating..." : "Use My GPS"}</span>
        </button>
      </div>
    </header>
  );
}
