import { useEffect, useMemo, useRef } from "react";
import {
  AdvancedMarker,
  Map as GoogleMap,
  useMap,
} from "@vis.gl/react-google-maps";
import { Car, Compass, Star } from "lucide-react";
import { OriginLocation, RestaurantWithTelemetry } from "../types";

interface MapCanvasProps {
  origin: OriginLocation;
  restaurants: RestaurantWithTelemetry[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelectRestaurant: (id: string) => void;
  onHoverRestaurant: (id: string | null) => void;
}

const Z_INDEX_SELECTED = 1000;
const Z_INDEX_HOVER = 999;

export function MapCanvas({
  origin,
  restaurants,
  selectedId,
  hoveredId,
  onSelectRestaurant,
  onHoverRestaurant,
}: MapCanvasProps) {
  const map = useMap("carnivore-main-map");
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  const selectedItem = useMemo(
    () => restaurants.find((r) => r.place.id === selectedId) ?? null,
    [restaurants, selectedId]
  );

  // Sort markers south-to-north by latitude for natural visual overlap depth
  const sortedMarkers = useMemo(() => {
    return [...restaurants]
      .sort((a, b) => b.place.location.lat - a.place.location.lat)
      .map((item, idx) => ({ item, baseZIndex: idx + 10 }));
  }, [restaurants]);

  // Center map smoothly when origin changes and no restaurant is selected
  useEffect(() => {
    if (!map) return;
    if (!selectedId) {
      map.panTo({ lat: origin.lat, lng: origin.lng });
      map.setZoom(13);
    }
  }, [map, origin.lat, origin.lng, selectedId]);

  // Fit bounds around all results on initial load if none selected
  useEffect(() => {
    if (!map || selectedId || restaurants.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: origin.lat, lng: origin.lng });
    restaurants.slice(0, 12).forEach((r) => {
      bounds.extend(r.place.location);
    });
    map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
  }, [map, restaurants, origin.lat, origin.lng, selectedId]);

  // Render live route polyline & pan/fit when a restaurant is selected
  useEffect(() => {
    // Cleanup previous polylines
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!map || !selectedItem) return;

    const routeInstance = selectedItem.route?.routeInstance;
    if (routeInstance) {
      try {
        const created = routeInstance.createPolylines();
        created.forEach((polyline) => {
          polyline.setOptions({
            strokeColor: "#F97316",
            strokeOpacity: 0.95,
            strokeWeight: 5,
            zIndex: 50,
          });
          polyline.setMap(map);
        });
        polylinesRef.current = created;

        if (routeInstance.viewport) {
          map.fitBounds(routeInstance.viewport, {
            top: 64,
            right: 64,
            bottom: 84,
            left: 64,
          });
        } else {
          map.panTo(selectedItem.place.location);
        }
      } catch (err) {
        console.warn("Failed to render route polyline:", err);
        map.panTo(selectedItem.place.location);
        map.setZoom(14);
      }
    } else {
      map.panTo(selectedItem.place.location);
      map.setZoom(14);
    }

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, selectedItem]);

  return (
    <div className="relative w-full h-full bg-[#0F1115]">
      <GoogleMap
        id="carnivore-main-map"
        mapId="DEMO_MAP_ID"
        colorScheme="DARK"
        defaultCenter={{ lat: origin.lat, lng: origin.lng }}
        defaultZoom={13}
        gestureHandling="greedy"
        disableDefaultUI={false}
        streetViewControl={false}
        mapTypeControl={false}
        fullscreenControl={false}
        clickableIcons={false}
        internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
        className="w-full h-full"
      >
        {/* Origin Pin */}
        <AdvancedMarker
          position={{ lat: origin.lat, lng: origin.lng }}
          zIndex={500}
          title={origin.label}
        >
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111317] border-2 border-[#10B981] text-[#F8FAFC] shadow-lg">
            <Compass className="w-3.5 h-3.5 text-[#10B981]" />
            <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
              Start
            </span>
          </div>
        </AdvancedMarker>

        {/* Filtered (>= 500 reviews) Restaurant Markers */}
        {sortedMarkers.map(({ item, baseZIndex }) => {
          const isSelected = item.place.id === selectedId;
          const isHovered = item.place.id === hoveredId;
          const zIndex = isSelected
            ? Z_INDEX_SELECTED
            : isHovered
            ? Z_INDEX_HOVER
            : baseZIndex;

          return (
            <AdvancedMarker
              key={item.place.id}
              position={item.place.location}
              zIndex={zIndex}
              title={item.place.name}
              onClick={() => onSelectRestaurant(item.place.id)}
            >
              <button
                type="button"
                onMouseEnter={() => onHoverRestaurant(item.place.id)}
                onMouseLeave={() => onHoverRestaurant(null)}
                aria-label={`${item.place.name}, rated ${item.place.rating.toFixed(1)} stars`}
                className={`group flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-xs font-bold tabular-nums transition-transform duration-150 cursor-pointer shadow-lg ${
                  isSelected
                    ? "bg-[#F97316] text-white border-2 border-white scale-115 shadow-[0_0_20px_rgba(249,115,22,0.65)]"
                    : isHovered
                    ? "bg-[#22262E] text-[#F8FAFC] border-2 border-[#F97316] scale-105"
                    : "bg-[#181B20] text-[#F8FAFC] border border-[#F97316]/75 hover:border-[#F97316]"
                }`}
              >
                <Star
                  className={`w-3 h-3 ${
                    isSelected
                      ? "text-white fill-white"
                      : "text-[#F97316] fill-[#F97316]"
                  }`}
                />
                <span>{item.place.rating.toFixed(1)}</span>
              </button>
            </AdvancedMarker>
          );
        })}
      </GoogleMap>

      {/* Active Route Summary Overlay on Map */}
      {selectedItem && (
        <div className="absolute bottom-5 left-5 right-5 sm:right-auto sm:max-w-md z-10 rounded-xl bg-[#181B20]/95 backdrop-blur-md border border-[#2A2F3A] px-4 py-3 shadow-[0_12px_28px_-4px_rgba(0,0,0,0.75)]">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-display text-sm font-bold text-[#F8FAFC] truncate">
                {selectedItem.place.name}
              </p>
              <p className="text-xs text-[#94A3B8] truncate mt-0.5">
                {selectedItem.visitPlan.bestTimeLabel}
              </p>
            </div>

            {selectedItem.route && (
              <div className="shrink-0 text-right font-mono tabular-nums">
                <div className="inline-flex items-center gap-1.5 text-sm font-bold text-[#F97316]">
                  <Car className="w-3.5 h-3.5" />
                  <span>{Math.round(selectedItem.route.durationSec / 60)} min</span>
                </div>
                <p className="text-[11px] text-[#94A3B8]">
                  {(selectedItem.route.distanceMeters / 1000).toFixed(1)} km ·{" "}
                  <span
                    className={
                      selectedItem.route.trafficStatus === "Heavy Traffic"
                        ? "text-[#EF4444]"
                        : selectedItem.route.trafficStatus === "Moderate Traffic"
                        ? "text-[#F59E0B]"
                        : "text-[#10B981]"
                    }
                  >
                    {selectedItem.route.trafficStatus}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
