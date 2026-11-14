import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import {
  AlertTriangle,
  Compass,
  Expand,
  Flame,
  List,
  Map as MapIcon,
  Check,
} from "lucide-react";
import { Header } from "./components/Header";
import { MapCanvas } from "./components/MapCanvas";
import { RestaurantCard } from "./components/RestaurantCard";
import { RestaurantDetailDrawer } from "./components/RestaurantDetailDrawer";
import { SearchToolbar } from "./components/SearchToolbar";
import {
  analyzeRestaurantWithGemini,
  getCachedAnalysis,
} from "./services/geminiAnalyzer";
import {
  DEFAULT_CITY_CENTER,
  haversineDistanceMeters,
  requestUserLocation,
  searchNonVegRestaurants,
} from "./services/placesService";
import {
  computeRouteTelemetry,
  generateSmartVisitPlan,
} from "./services/trafficPlanner";
import {
  MeatCategory,
  OriginLocation,
  RestaurantWithTelemetry,
  SortOption,
} from "./types";

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

function Workspace() {
  const placesLib = useMapsLibrary("places");
  const routesLib = useMapsLibrary("routes");

  const [origin, setOrigin] = useState<OriginLocation>(DEFAULT_CITY_CENTER);
  const [isLocating, setIsLocating] = useState(true);
  const [activeCategory, setActiveCategory] = useState<MeatCategory>("all");
  const [sortBy, setSortBy] = useState<SortOption>("optimal");
  const [radiusMeters, setRadiusMeters] = useState<number>(12000);
  const [openNowOnly, setOpenNowOnly] = useState<boolean>(false);

  const [restaurants, setRestaurants] = useState<RestaurantWithTelemetry[]>([]);
  const [rawTotalCount, setRawTotalCount] = useState<number>(0);
  const [isSearching, setIsSearching] = useState<boolean>(true);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const searchVersionRef = useRef(0);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  // Initialize user GPS location on mount
  useEffect(() => {
    let active = true;
    requestUserLocation().then((loc) => {
      if (!active) return;
      setOrigin(loc);
      setIsLocating(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleLocateMe = useCallback(async () => {
    setIsLocating(true);
    const loc = await requestUserLocation();
    setOrigin(loc);
    setSelectedId(null);
    setIsLocating(false);
    if (!loc.isCurrentGps) {
      showToast("Location permission unavailable — using city center");
    } else {
      showToast("Updated origin to your current GPS coordinates");
    }
  }, [showToast]);

  const triggerGeminiAnalysis = useCallback(async (place: RestaurantWithTelemetry["place"]) => {
    setRestaurants((prev) =>
      prev.map((item) =>
        item.place.id === place.id
          ? { ...item, analysisLoading: true, analysisError: undefined }
          : item
      )
    );

    try {
      const analysis = await analyzeRestaurantWithGemini(place);
      setRestaurants((latest) =>
        latest.map((item) =>
          item.place.id === place.id
            ? { ...item, analysis, analysisLoading: false, analysisError: undefined }
            : item
        )
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to extract dishes.";
      setRestaurants((latest) =>
        latest.map((item) =>
          item.place.id === place.id
            ? { ...item, analysisLoading: false, analysisError: message }
            : item
        )
      );
    }
  }, []);

  // Fetch Places whenever search parameters or origin change
  useEffect(() => {
    if (!placesLib || isLocating) return;

    const version = ++searchVersionRef.current;
    setIsSearching(true);
    setSearchError(null);
    setSelectedId(null);

    searchNonVegRestaurants(
      placesLib,
      origin,
      activeCategory,
      radiusMeters,
      openNowOnly
    )
      .then(async ({ restaurants: placesList, rawTotalCount: rawCount }) => {
        if (version !== searchVersionRef.current) return;

        setRawTotalCount(rawCount);
        const now = new Date();

        const initialItems: RestaurantWithTelemetry[] = placesList.map((place) => {
          const straightLineMeters = haversineDistanceMeters(origin, place.location);
          const cachedAnalysis = getCachedAnalysis(place.id) ?? undefined;
          return {
            place,
            straightLineMeters,
            visitPlan: generateSmartVisitPlan(place, undefined, straightLineMeters, now),
            analysis: cachedAnalysis,
          };
        });

        setRestaurants(initialItems);
        setIsSearching(false);

        // Pre-fetch Gemini structured extraction for top 3 uncached results
        initialItems.slice(0, 3).forEach((item) => {
          if (!item.analysis) {
            void triggerGeminiAnalysis(item.place);
          }
        });

        // Compute live traffic-aware Routes for top 6 results
        if (routesLib && initialItems.length > 0) {
          const topForRoutes = initialItems.slice(0, 6);
          const routeResults = await Promise.all(
            topForRoutes.map((item) =>
              computeRouteTelemetry(
                routesLib,
                origin,
                item.place.location,
                item.place.id
              )
            )
          );

          if (version !== searchVersionRef.current) return;

          setRestaurants((prev) =>
            prev.map((item) => {
              const matchedRoute = routeResults.find(
                (r) => r && r.placeId === item.place.id
              );
              if (!matchedRoute) return item;
              return {
                ...item,
                route: matchedRoute,
                visitPlan: generateSmartVisitPlan(
                  item.place,
                  matchedRoute,
                  item.straightLineMeters,
                  new Date()
                ),
              };
            })
          );
        }
      })
      .catch((err: unknown) => {
        if (version !== searchVersionRef.current) return;
        console.error("Places search failed:", err);
        setSearchError(
          err instanceof Error
            ? err.message
            : "Unable to load non-veg spots from Google Places."
        );
        setRestaurants([]);
        setIsSearching(false);
      });
  }, [
    placesLib,
    routesLib,
    origin,
    activeCategory,
    radiusMeters,
    openNowOnly,
    isLocating,
    triggerGeminiAnalysis,
  ]);

  // Handle selecting a restaurant card or map pin
  const handleSelectRestaurant = useCallback(
    async (placeId: string) => {
      setSelectedId(placeId);

      const target = restaurants.find((r) => r.place.id === placeId);
      if (!target) return;

      // Trigger Gemini extraction if not yet loaded
      if (!target.analysis && !target.analysisLoading) {
        void triggerGeminiAnalysis(target.place);
      }

      // Compute live Routes API telemetry + polyline if not yet computed
      if (!target.route && routesLib) {
        const route = await computeRouteTelemetry(
          routesLib,
          origin,
          target.place.location,
          placeId
        );
        if (route) {
          setRestaurants((prev) =>
            prev.map((item) =>
              item.place.id === placeId
                ? {
                    ...item,
                    route,
                    visitPlan: generateSmartVisitPlan(
                      item.place,
                      route,
                      item.straightLineMeters,
                      new Date()
                    ),
                  }
                : item
            )
          );
        }
      }
    },
    [restaurants, routesLib, origin, triggerGeminiAnalysis]
  );

  const handleRetryAnalysis = useCallback(
    (placeId: string) => {
      const target = restaurants.find((r) => r.place.id === placeId);
      if (target) {
        void triggerGeminiAnalysis(target.place);
      }
    },
    [restaurants, triggerGeminiAnalysis]
  );

  const handleSharePlan = useCallback(
    async (item: RestaurantWithTelemetry) => {
      const hero = item.analysis?.heroDish.name ?? "Chef's Signature Cut";
      const driveInfo = item.route
        ? `${Math.round(item.route.durationSec / 60)} min drive (${item.route.trafficStatus})`
        : `${(item.straightLineMeters / 1000).toFixed(1)} km away`;

      const snippet = [
        `CarnivoreRoute Visit Plan: ${item.place.name}`,
        `Rating: ${item.place.rating.toFixed(1)}★ (${item.place.userRatingCount.toLocaleString()} reviews)`,
        `Must-Try Dish: ${hero}`,
        `Timing: ${item.visitPlan.bestTimeLabel} · ${driveInfo}`,
        `Maps: ${item.place.googleMapsUri}`,
      ].join("\n");

      try {
        await navigator.clipboard.writeText(snippet);
        showToast("Visit plan copied to clipboard");
      } catch {
        showToast("Could not copy automatically — please copy from address bar");
      }
    },
    [showToast]
  );

  const handleExpandRadius = useCallback(() => {
    if (openNowOnly) {
      setOpenNowOnly(false);
    }
    setRadiusMeters((prev) => {
      if (prev < 12000) return 12000;
      if (prev < 25000) return 25000;
      return 45000;
    });
  }, [openNowOnly]);

  // Sort displayed list
  const sortedRestaurants = useMemo(() => {
    const copy = [...restaurants];
    copy.sort((a, b) => {
      if (sortBy === "rating") {
        if (b.place.rating !== a.place.rating) return b.place.rating - a.place.rating;
        return b.place.userRatingCount - a.place.userRatingCount;
      }
      if (sortBy === "reviews") {
        return b.place.userRatingCount - a.place.userRatingCount;
      }
      if (sortBy === "distance") {
        const distA = a.route?.distanceMeters ?? a.straightLineMeters;
        const distB = b.route?.distanceMeters ?? b.straightLineMeters;
        return distA - distB;
      }
      // "optimal": prioritize open spots, lower traffic/wait score, and strong rating
      const openWeightA = a.place.isOpenNow === false ? 1000 : 0;
      const openWeightB = b.place.isOpenNow === false ? 1000 : 0;
      const nowHour = new Date().getHours();
      const slotA =
        a.visitPlan.hourlyCurve.find((s) => s.hour === nowHour) ??
        a.visitPlan.hourlyCurve[0];
      const slotB =
        b.visitPlan.hourlyCurve.find((s) => s.hour === nowHour) ??
        b.visitPlan.hourlyCurve[0];
      const scoreA = openWeightA + (slotA?.combinedScore ?? 100) - a.place.rating * 6;
      const scoreB = openWeightB + (slotB?.combinedScore ?? 100) - b.place.rating * 6;
      return scoreA - scoreB;
    });
    return copy;
  }, [restaurants, sortBy]);

  const selectedRestaurant = useMemo(
    () => sortedRestaurants.find((r) => r.place.id === selectedId) ?? null,
    [sortedRestaurants, selectedId]
  );

  return (
    <div className="flex flex-col h-screen bg-[#0F1115] overflow-hidden">
      <Header
        activeCategory={activeCategory}
        onSelectCategory={(cat) => {
          setActiveCategory(cat);
          setSelectedId(null);
        }}
        onLocateMe={() => void handleLocateMe()}
        isLocating={isLocating}
        onResetHome={() => {
          setActiveCategory("all");
          setSelectedId(null);
        }}
      />

      {/* Main Split-Screen Workspace */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-0 relative">
        {/* Left Panel: Discovery Feed or Restaurant Detail Drawer */}
        <section
          aria-label="Restaurant discovery and visit planner"
          className={`w-full lg:w-[460px] xl:w-[500px] shrink-0 h-full flex flex-col bg-[#111317] border-r border-[#2A2F3A] min-h-0 ${
            mobileView === "map" ? "hidden lg:flex" : "flex"
          }`}
        >
          {selectedRestaurant ? (
            <RestaurantDetailDrawer
              item={selectedRestaurant}
              onClose={() => setSelectedId(null)}
              onRetryAnalysis={handleRetryAnalysis}
              onSharePlan={(item) => void handleSharePlan(item)}
            />
          ) : (
            <>
              <SearchToolbar
                origin={origin}
                onOriginChange={(next) => {
                  setOrigin(next);
                  setSelectedId(null);
                }}
                activeCategory={activeCategory}
                onCategoryChange={(cat) => {
                  setActiveCategory(cat);
                  setSelectedId(null);
                }}
                sortBy={sortBy}
                onSortChange={setSortBy}
                radiusMeters={radiusMeters}
                onRadiusChange={setRadiusMeters}
                openNowOnly={openNowOnly}
                onOpenNowChange={setOpenNowOnly}
                resultCount={sortedRestaurants.length}
                isLoading={isSearching}
              />

              {/* Scrollable Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {isSearching && (
                  <div className="space-y-3.5" aria-busy="true" aria-label="Loading restaurants">
                    {[1, 2, 3, 4].map((n) => (
                      <div
                        key={n}
                        className="rounded-xl bg-[#181B20] border border-[#2A2F3A] overflow-hidden animate-pulse"
                      >
                        <div className="h-36 bg-[#22262E]" />
                        <div className="p-3.5 space-y-2.5">
                          <div className="h-4 w-2/3 bg-[#22262E] rounded" />
                          <div className="h-3 w-1/2 bg-[#22262E] rounded" />
                          <div className="h-8 w-full bg-[#22262E] rounded-lg" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!isSearching && searchError && (
                  <div className="p-5 rounded-xl bg-[#181B20] border border-[#EF4444]/40 space-y-3 text-center">
                    <AlertTriangle className="w-7 h-7 text-[#EF4444] mx-auto" />
                    <div className="space-y-1">
                      <h2 className="font-display text-base font-bold text-[#F8FAFC]">
                        Places Search Interrupted
                      </h2>
                      <p className="text-xs text-[#94A3B8] leading-relaxed">
                        {searchError}
                      </p>
                    </div>
                  </div>
                )}

                {!isSearching && !searchError && sortedRestaurants.length === 0 && (
                  <div className="p-6 rounded-xl bg-[#181B20] border border-[#2A2F3A] space-y-4 text-center">
                    <Flame className="w-8 h-8 text-[#F97316] mx-auto" />
                    <div className="space-y-1.5">
                      <h2 className="font-display text-base font-bold text-[#F8FAFC]">
                        No 500+ Review Spots Found Nearby
                      </h2>
                      <p className="text-xs text-[#94A3B8] leading-relaxed max-w-sm mx-auto">
                        {rawTotalCount > 0
                          ? `Scanned ${rawTotalCount} restaurants in this radius, but none met the mandatory 500+ reviews and 4.0★ quality gate${
                              openNowOnly ? " while open right now" : ""
                            }.`
                          : "No matching non-veg restaurants were found within this search radius."}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2.5">
                      {radiusMeters < 45000 && (
                        <button
                          type="button"
                          onClick={handleExpandRadius}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Expand className="w-3.5 h-3.5" />
                          <span>
                            Expand Radius to{" "}
                            {radiusMeters < 12000
                              ? "12 km"
                              : radiusMeters < 25000
                              ? "25 km"
                              : "45 km"}
                          </span>
                        </button>
                      )}
                      {activeCategory !== "all" && (
                        <button
                          type="button"
                          onClick={() => setActiveCategory("all")}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#22262E] border border-[#2A2F3A] hover:border-[#F97316] text-[#F8FAFC] text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Compass className="w-3.5 h-3.5 text-[#F97316]" />
                          <span>Show All Cuts</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {!isSearching &&
                  !searchError &&
                  sortedRestaurants.map((item) => (
                    <RestaurantCard
                      key={item.place.id}
                      item={item}
                      isSelected={item.place.id === selectedId}
                      onSelect={() => void handleSelectRestaurant(item.place.id)}
                      onHover={(hovered) =>
                        setHoveredId(hovered ? item.place.id : null)
                      }
                    />
                  ))}
              </div>
            </>
          )}
        </section>

        {/* Right Panel: Interactive Google Map */}
        <section
          aria-label="Interactive route and restaurant map"
          className={`flex-1 h-full min-h-0 relative ${
            mobileView === "list" ? "hidden lg:block" : "block"
          }`}
        >
          <MapCanvas
            origin={origin}
            restaurants={sortedRestaurants}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelectRestaurant={(id) => void handleSelectRestaurant(id)}
            onHoverRestaurant={setHoveredId}
          />
        </section>

        {/* Mobile View Switcher (compact, <= 15% mobile sticky cap) */}
        <div className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 p-1 rounded-full bg-[#181B20]/95 backdrop-blur-md border border-[#2A2F3A] shadow-xl">
          <button
            type="button"
            onClick={() => setMobileView("list")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              mobileView === "list"
                ? "bg-[#F97316] text-white"
                : "text-[#94A3B8] hover:text-[#F8FAFC]"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>List</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileView("map")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              mobileView === "map"
                ? "bg-[#F97316] text-white"
                : "text-[#94A3B8] hover:text-[#F8FAFC]"
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Map</span>
          </button>
        </div>

        {/* Clipboard Toast Notification */}
        {toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#22262E] border border-[#10B981]/60 text-xs font-semibold text-[#F8FAFC] shadow-[0_12px_28px_-4px_rgba(0,0,0,0.75)]"
          >
            <Check className="w-4 h-4 text-[#10B981]" />
            <span>{toastMessage}</span>
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener("gmp-quota-exceeded", onQuotaExceeded);
    return () => window.removeEventListener("gmp-quota-exceeded", onQuotaExceeded);
  }, []);

  if (!MAPS_API_KEY) {
    return (
      <div className="min-h-screen bg-[#0F1115] text-[#F8FAFC] flex items-center justify-center p-6">
        <div className="max-w-md w-full p-6 rounded-xl bg-[#181B20] border border-[#2A2F3A] space-y-3 text-center">
          <AlertTriangle className="w-8 h-8 text-[#F97316] mx-auto" />
          <h1 className="font-display text-lg font-bold">
            Google Maps API Key Required
          </h1>
          <p className="text-sm text-[#94A3B8] leading-relaxed">
            Configure <code className="font-mono text-[#F8FAFC]">VITE_GOOGLE_MAPS_API_KEY</code> in
            your environment secrets to load live Maps, Places, and Routes data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1115] flex flex-col">
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{" "}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{" "}
            for instructions to update your account.
          </span>
        </div>
      )}

      <APIProvider
        apiKey={MAPS_API_KEY}
        libraries={["places", "routes", "marker"]}
        language="en"
        region="US"
      >
        <Workspace />
      </APIProvider>
    </div>
  );
}
