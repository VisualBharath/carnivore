import { useState } from "react";
import { AlertTriangle, Car, Clock, Flame, Star, Utensils } from "lucide-react";
import { RestaurantWithTelemetry } from "../types";

interface RestaurantCardProps {
  item: RestaurantWithTelemetry;
  isSelected: boolean;
  onSelect: () => void;
  onHover: (hovered: boolean) => void;
}

export function RestaurantCard({
  item,
  isSelected,
  onSelect,
  onHover,
}: RestaurantCardProps) {
  const { place, route, straightLineMeters, visitPlan, analysis } = item;
  const [imgError, setImgError] = useState(false);

  const heroPhoto = !imgError && place.photoUrls.length > 0 ? place.photoUrls[0] : null;
  const driveMinutes = route ? Math.round(route.durationSec / 60) : null;
  const distanceKm = ((route?.distanceMeters ?? straightLineMeters) / 1000).toFixed(1);

  const trafficColorClass =
    route?.trafficStatus === "Heavy Traffic"
      ? "text-[#EF4444]"
      : route?.trafficStatus === "Moderate Traffic"
      ? "text-[#F59E0B]"
      : "text-[#10B981]";

  return (
    <article
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={`rounded-xl bg-[#181B20] border transition-all overflow-hidden cursor-pointer ${
        isSelected
          ? "border-[#F97316] ring-1 ring-[#F97316] shadow-[0_0_20px_-4px_rgba(249,115,22,0.28)]"
          : "border-[#2A2F3A] hover:border-[#F97316]/60 hover:bg-[#22262E]/70"
      }`}
      onClick={onSelect}
    >
      {/* Photo Banner with Vignette Overlay */}
      <div className="relative h-36 w-full bg-[#0F1115] overflow-hidden">
        {heroPhoto ? (
          <img
            src={heroPhoto}
            alt={place.name}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#181B20] via-[#1E2024] to-[#0F1115] text-[#64748B]">
            <Utensils className="w-7 h-7 mb-1.5 text-[#F97316]/60" />
            <span className="text-xs font-medium text-[#94A3B8] px-4 text-center truncate max-w-full">
              {place.name}
            </span>
          </div>
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#181B20] via-[#181B20]/35 to-transparent"
        />

        {/* Bottom-left title over vignette */}
        <div className="absolute bottom-2.5 left-3.5 right-3.5 flex items-end justify-between gap-2">
          <h3 className="font-display text-base font-bold text-[#F8FAFC] leading-snug line-clamp-1">
            {place.name}
          </h3>
          {place.isOpenNow !== null && (
            <span
              className={`text-[11px] font-semibold shrink-0 ${
                place.isOpenNow ? "text-[#10B981]" : "text-[#EF4444]"
              }`}
            >
              {place.isOpenNow ? "Open Now" : "Closed"}
            </span>
          )}
        </div>
      </div>

      {/* Card Body: Clean unboxed metadata & telemetry */}
      <div className="p-3.5 space-y-2.5">
        {/* Strict Quality Gate & Rating Metadata Line */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#94A3B8] font-mono tabular-nums">
          <span className="inline-flex items-center gap-1 text-[#F8FAFC] font-semibold">
            <Star className="w-3.5 h-3.5 text-[#F97316] fill-[#F97316]" />
            {place.rating.toFixed(1)}
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-[#F8FAFC]">
            {place.userRatingCount.toLocaleString()} reviews
          </span>
          {place.priceLevel && (
            <>
              <span aria-hidden="true">·</span>
              <span>{place.priceLevel}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span>{distanceKm} km</span>
        </div>

        {/* Live Routes API Traffic Telemetry */}
        <div className="flex items-center justify-between gap-2 text-xs pt-0.5 border-t border-[#2A2F3A]/70">
          <div className="flex items-center gap-1.5 font-mono tabular-nums">
            <Car className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
            {driveMinutes !== null ? (
              <span className="text-[#F8FAFC] font-semibold">{driveMinutes} min drive</span>
            ) : (
              <span className="text-[#94A3B8]">~{distanceKm} km away</span>
            )}
          </div>

          {route ? (
            <span className={`inline-flex items-center gap-1 font-semibold ${trafficColorClass}`}>
              {route.trafficStatus === "Heavy Traffic" && (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              )}
              {route.trafficStatus}
            </span>
          ) : (
            <span className="text-[#64748B]">Click for live route</span>
          )}
        </div>

        {/* Smart Visit Recommendation */}
        <div className="flex items-start gap-2 text-xs text-[#E2E2E8] bg-[#0F1115]/70 rounded-lg px-2.5 py-2 border border-[#2A2F3A]/80">
          <Clock className="w-3.5 h-3.5 text-[#F97316] shrink-0 mt-0.5" />
          <span className="leading-relaxed">{visitPlan.bestTimeLabel}</span>
        </div>

        {/* AI Hero Dish Preview (if pre-fetched or cached) */}
        {analysis && (
          <div className="flex items-center justify-between gap-2 text-xs pt-0.5">
            <span className="inline-flex items-center gap-1.5 text-[#F8FAFC] font-medium truncate">
              <Flame className="w-3.5 h-3.5 text-[#F97316] shrink-0" />
              <span className="truncate">Must-Try: {analysis.heroDish.name}</span>
            </span>
            <span className="text-[11px] font-mono text-[#94A3B8] shrink-0">
              {analysis.heroDish.spiceLevel}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
