import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  Car,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  Lightbulb,
  MapPin,
  ParkingCircle,
  RefreshCw,
  Share2,
  Star,
  Utensils,
  X,
} from "lucide-react";
import { ParkingSummary, RestaurantWithTelemetry } from "../types";

interface RestaurantDetailDrawerProps {
  item: RestaurantWithTelemetry;
  onClose: () => void;
  onRetryAnalysis: (placeId: string) => void;
  onSharePlan: (item: RestaurantWithTelemetry) => void;
}

function formatParkingList(parking: ParkingSummary | null): string[] {
  if (!parking) return [];
  const labels: string[] = [];
  if (parking.valet) labels.push("Valet Parking");
  if (parking.freeLot) labels.push("Free Lot");
  if (parking.paidLot) labels.push("Paid Lot");
  if (parking.freeGarage) labels.push("Free Garage");
  if (parking.paidGarage) labels.push("Paid Garage");
  if (parking.freeStreet) labels.push("Free Street");
  if (parking.paidStreet) labels.push("Paid Street");
  return labels;
}

function getSpiceSegments(level: string): number {
  switch (level) {
    case "Mild":
      return 1;
    case "Medium":
      return 2;
    case "Spicy":
      return 3;
    case "Fiery":
      return 4;
    default:
      return 2;
  }
}

export function RestaurantDetailDrawer({
  item,
  onClose,
  onRetryAnalysis,
  onSharePlan,
}: RestaurantDetailDrawerProps) {
  const { place, route, straightLineMeters, visitPlan, analysis, analysisLoading, analysisError } =
    item;

  const [selectedHour, setSelectedHour] = useState<number>(() => {
    const nowHour = new Date().getHours();
    const clamped = Math.min(23, Math.max(11, nowHour));
    return clamped;
  });
  const [imgError, setImgError] = useState(false);

  // Reset image error and default scrubber to optimal hour when switching restaurants
  useEffect(() => {
    setImgError(false);
    setSelectedHour(visitPlan.optimalHour);
  }, [place.id, visitPlan.optimalHour]);

  // Escape key closes drawer
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const activeSlot = useMemo(() => {
    return (
      visitPlan.hourlyCurve.find((s) => s.hour === selectedHour) ??
      visitPlan.hourlyCurve[0]
    );
  }, [visitPlan.hourlyCurve, selectedHour]);

  const parkingLabels = useMemo(() => formatParkingList(place.parkingOptions), [place.parkingOptions]);
  const distanceKm = ((route?.distanceMeters ?? straightLineMeters) / 1000).toFixed(1);
  const spiceSegments = getSpiceSegments(analysis?.heroDish.spiceLevel ?? "Medium");

  const heroPhoto = !imgError && place.photoUrls.length > 0 ? place.photoUrls[0] : null;

  return (
    <aside
      aria-label={`${place.name} details`}
      className="h-full w-full flex flex-col bg-[#111317] border-r border-[#2A2F3A] overflow-hidden"
    >
      {/* Top Bar Inside Drawer */}
      <div className="px-5 py-3.5 border-b border-[#2A2F3A] bg-[#181B20] flex items-center justify-between gap-4 shrink-0">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#94A3B8]">Culinary & Route Brief</p>
          <h2 className="font-display text-lg font-bold text-[#F8FAFC] truncate">
            {place.name}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close restaurant details"
          className="p-2 rounded-lg bg-[#22262E] border border-[#2A2F3A] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#F97316] transition-colors cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Hero Image + Gallery Strip */}
        <div className="space-y-2">
          <div className="relative h-48 w-full rounded-xl overflow-hidden bg-[#181B20] border border-[#2A2F3A]">
            {heroPhoto ? (
              <img
                src={heroPhoto}
                alt={place.name}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#181B20] to-[#0F1115] text-[#64748B]">
                <Utensils className="w-8 h-8 mb-2 text-[#F97316]/60" />
                <span className="text-xs text-[#94A3B8]">{place.name}</span>
              </div>
            )}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#0F1115]/90 via-transparent to-transparent"
            />
            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-[#F8FAFC]">
                <span className="inline-flex items-center gap-1 font-bold">
                  <Star className="w-3.5 h-3.5 text-[#F97316] fill-[#F97316]" />
                  {place.rating.toFixed(1)}
                </span>
                <span aria-hidden="true">·</span>
                <span>{place.userRatingCount.toLocaleString()} reviews</span>
                {place.priceLevel && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{place.priceLevel}</span>
                  </>
                )}
              </div>
              {place.isOpenNow !== null && (
                <span
                  className={`text-xs font-semibold ${
                    place.isOpenNow ? "text-[#10B981]" : "text-[#EF4444]"
                  }`}
                >
                  {place.isOpenNow ? "Open Now" : "Closed"}
                </span>
              )}
            </div>
          </div>

          {place.photoUrls.length > 1 && (
            <div className="grid grid-cols-3 gap-2">
              {place.photoUrls.slice(1, 4).map((url, idx) => (
                <div
                  key={idx}
                  className="h-16 rounded-lg overflow-hidden bg-[#181B20] border border-[#2A2F3A]"
                >
                  <img
                    src={url}
                    alt={`${place.name} view ${idx + 2}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Address & Action Buttons */}
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-xs text-[#94A3B8]">
            <MapPin className="w-4 h-4 text-[#F97316] shrink-0 mt-0.5" />
            <span>{place.formattedAddress}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <a
              href={place.googleMapsUri}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#F97316] hover:bg-[#EA580C] active:scale-[0.98] text-white text-sm font-semibold transition-all whitespace-nowrap"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Start Navigation</span>
            </a>

            <button
              type="button"
              onClick={() => onSharePlan(item)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#181B20] hover:bg-[#22262E] border border-[#2A2F3A] hover:border-[#F97316] text-[#F8FAFC] text-sm font-semibold transition-all whitespace-nowrap cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-[#F97316]" />
              <span>Share Visit Plan</span>
            </button>
          </div>
        </div>

        <hr className="border-[#2A2F3A]" />

        {/* Smart Visit & Traffic Planner Section */}
        <section aria-labelledby="visit-planner-heading" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3
              id="visit-planner-heading"
              className="font-display text-base font-bold text-[#F8FAFC]"
            >
              Smart Visit & Traffic Planner
            </h3>
            {route && (
              <span
                className={`text-xs font-semibold ${
                  route.trafficStatus === "Heavy Traffic"
                    ? "text-[#EF4444]"
                    : route.trafficStatus === "Moderate Traffic"
                    ? "text-[#F59E0B]"
                    : "text-[#10B981]"
                }`}
              >
                {route.trafficStatus}
              </span>
            )}
          </div>

          {/* Best Window Summary */}
          <div className="p-3.5 rounded-xl bg-[#181B20] border border-[#2A2F3A] space-y-3">
            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-[#F97316] shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-[#F8FAFC] leading-snug">
                {visitPlan.bestTimeLabel}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2.5 border-t border-[#2A2F3A] font-mono tabular-nums">
              <div>
                <p className="text-[11px] text-[#94A3B8]">Leave By</p>
                <p className="text-sm font-bold text-[#F8FAFC] mt-0.5">
                  {visitPlan.optimalLeaveTime}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#94A3B8]">Live Drive</p>
                <p className="text-sm font-bold text-[#F97316] mt-0.5">
                  {route ? `${Math.round(route.durationSec / 60)} min` : `~${activeSlot.driveMinutes} min`}
                  <span className="text-[11px] font-normal text-[#94A3B8] ml-1">
                    ({distanceKm} km)
                  </span>
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#94A3B8]">Wait Est.</p>
                <p
                  className={`text-sm font-bold mt-0.5 ${
                    visitPlan.waitEstimate === "High"
                      ? "text-[#EF4444]"
                      : visitPlan.waitEstimate === "Moderate"
                      ? "text-[#F59E0B]"
                      : "text-[#10B981]"
                  }`}
                >
                  {visitPlan.waitEstimate}
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Recharts Timeline Chart */}
          <div className="p-3.5 rounded-xl bg-[#181B20] border border-[#2A2F3A] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#94A3B8]">
                Hourly Drive Time (min) vs. Crowd (%)
              </span>
              <span className="font-mono tabular-nums text-[#F8FAFC]">
                {activeSlot.hourLabel.toUpperCase()} ·{" "}
                <strong className="text-[#F97316]">{activeSlot.driveMinutes}m drive</strong> ·{" "}
                {activeSlot.isOpen ? `${activeSlot.crowdPercent}% busy` : "Closed"}
              </span>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={visitPlan.hourlyCurve}
                  margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="crowdFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F97316" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#F97316" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#2A2F3A" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="hourLabel"
                    tick={{ fill: "#94A3B8", fontSize: 11 }}
                    axisLine={{ stroke: "#2A2F3A" }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="crowd"
                    domain={[0, 100]}
                    tick={{ fill: "#64748B", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="drive"
                    orientation="right"
                    hide
                    domain={[0, "dataMax + 10"]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#22262E",
                      borderColor: "#2A2F3A",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#F8FAFC",
                    }}
                    formatter={(value: unknown, name: unknown) => {
                      if (name === "crowdPercent") return [`${value}%`, "Crowd Density"];
                      if (name === "driveMinutes") return [`${value} min`, "Drive Time"];
                      return [String(value), String(name)];
                    }}
                  />
                  <ReferenceLine
                    yAxisId="crowd"
                    x={activeSlot.hourLabel}
                    stroke="#F8FAFC"
                    strokeDasharray="3 3"
                  />
                  <Area
                    yAxisId="crowd"
                    type="monotone"
                    dataKey="crowdPercent"
                    stroke="#F97316"
                    strokeWidth={2}
                    fill="url(#crowdFill)"
                  />
                  <Line
                    yAxisId="drive"
                    type="monotone"
                    dataKey="driveMinutes"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: "#10B981" }}
                    activeDot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Interactive Hour Slider */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                <label htmlFor="hour-scrubber">Scrub departure hour</label>
                <span className="font-mono tabular-nums text-[#F8FAFC]">
                  {activeSlot.hour > 12
                    ? `${activeSlot.hour - 12}:00 PM`
                    : activeSlot.hour === 12
                    ? "12:00 PM"
                    : `${activeSlot.hour}:00 AM`}{" "}
                  · {activeSlot.waitLevel} wait
                </span>
              </div>
              <input
                id="hour-scrubber"
                type="range"
                min={11}
                max={23}
                step={1}
                value={selectedHour}
                onChange={(e) => setSelectedHour(Number(e.target.value))}
                className="w-full accent-[#F97316] cursor-pointer"
              />
            </div>
          </div>
        </section>

        <hr className="border-[#2A2F3A]" />

        {/* Gemini AI Dish & Pros/Cons Intelligence */}
        <section aria-labelledby="ai-analysis-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3
              id="ai-analysis-heading"
              className="font-display text-base font-bold text-[#F8FAFC]"
            >
              Signature Dishes & Review Breakdown
            </h3>
            <span className="text-[11px] font-mono text-[#94A3B8]">
              {analysisLoading ? "Analyzing reviews..." : "Review synthesis"}
            </span>
          </div>

          {analysisLoading && !analysis && (
            <div className="space-y-3 animate-pulse">
              <div className="h-28 rounded-xl bg-[#181B20] border border-[#2A2F3A]" />
              <div className="h-20 rounded-xl bg-[#181B20] border border-[#2A2F3A]" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-24 rounded-xl bg-[#181B20] border border-[#2A2F3A]" />
                <div className="h-24 rounded-xl bg-[#181B20] border border-[#2A2F3A]" />
              </div>
            </div>
          )}

          {analysisError && !analysis && (
            <div className="p-4 rounded-xl bg-[#181B20] border border-[#EF4444]/40 space-y-2.5">
              <div className="flex items-start gap-2 text-xs text-[#EF4444]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{analysisError}</span>
              </div>
              <button
                type="button"
                onClick={() => onRetryAnalysis(place.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#22262E] border border-[#2A2F3A] hover:border-[#F97316] text-xs font-semibold text-[#F8FAFC] cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Dish Extraction</span>
              </button>
            </div>
          )}

          {analysis && (
            <div className="space-y-4">
              {/* Hero Dish Spotlight */}
              <div className="p-4 rounded-xl bg-[#181B20] border border-[#F97316]/50 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#F97316] font-bold">
                    #1 Hero Dish · {analysis.heroDish.meatType}
                  </span>
                  <div
                    className="flex items-center gap-1.5"
                    title={`Spice level: ${analysis.heroDish.spiceLevel}`}
                  >
                    <span className="text-[11px] font-mono text-[#94A3B8]">
                      {analysis.heroDish.spiceLevel}
                    </span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4].map((seg) => (
                        <span
                          key={seg}
                          className={`w-3 h-1.5 rounded-sm ${
                            seg <= spiceSegments ? "bg-[#F97316]" : "bg-[#2A2F3A]"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <h4 className="font-display text-lg font-extrabold text-[#F8FAFC] flex items-center gap-2">
                  <Flame className="w-4 h-4 text-[#F97316] shrink-0" />
                  <span>{analysis.heroDish.name}</span>
                </h4>

                <p className="text-sm text-[#E2E2E8] leading-relaxed">
                  {analysis.heroDish.whyItsFamous}
                </p>
              </div>

              {/* Runner-Up Must-Tries */}
              {analysis.runnerUpDishes.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-[#94A3B8]">
                    Runner-Up Must-Tries
                  </h4>
                  <div className="divide-y divide-[#2A2F3A] rounded-xl bg-[#181B20] border border-[#2A2F3A]">
                    {analysis.runnerUpDishes.map((dish, idx) => (
                      <div key={idx} className="px-3.5 py-2.5">
                        <p className="text-sm font-semibold text-[#F8FAFC]">{dish.name}</p>
                        <p className="text-xs text-[#94A3B8] mt-0.5 leading-relaxed">
                          {dish.mentionsContext}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Honest Pros & Cons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-[#181B20] border border-[#2A2F3A] space-y-2">
                  <h4 className="text-xs font-bold text-[#10B981]">Strengths (Pros)</h4>
                  <ul className="space-y-2">
                    {analysis.pros.map((pro, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-[#E2E2E8] leading-relaxed">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 rounded-xl bg-[#181B20] border border-[#2A2F3A] space-y-2">
                  <h4 className="text-xs font-bold text-[#EF4444]">Watch-Outs (Cons)</h4>
                  <ul className="space-y-2">
                    {analysis.cons.map((con, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-[#E2E2E8] leading-relaxed">
                        <AlertCircle className="w-3.5 h-3.5 text-[#EF4444] shrink-0 mt-0.5" />
                        <span>{con}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Actionable Insider Tip */}
              <div className="p-3.5 rounded-xl bg-[#22262E] border border-[#2A2F3A] flex items-start gap-2.5">
                <Lightbulb className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-[#F8FAFC]">Insider Tip</p>
                  <p className="text-xs text-[#E2E2E8] mt-0.5 leading-relaxed">
                    {analysis.visitTip}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Practical Logistics & Hours */}
        {(parkingLabels.length > 0 || place.weekdayDescriptions.length > 0) && (
          <>
            <hr className="border-[#2A2F3A]" />
            <section className="space-y-3">
              <h3 className="font-display text-sm font-bold text-[#F8FAFC]">
                Parking & Hours
              </h3>

              {parkingLabels.length > 0 && (
                <div className="flex items-start gap-2 text-xs text-[#E2E2E8]">
                  <ParkingCircle className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                  <span>{parkingLabels.join(" · ")}</span>
                </div>
              )}

              {place.weekdayDescriptions.length > 0 && (
                <ul className="space-y-1 text-xs text-[#94A3B8] font-mono tabular-nums">
                  {place.weekdayDescriptions.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {/* Recent Google Reviews */}
        {place.reviews.length > 0 && (
          <>
            <hr className="border-[#2A2F3A]" />
            <section className="space-y-3 pb-4">
              <h3 className="font-display text-sm font-bold text-[#F8FAFC]">
                Recent Verified Reviews
              </h3>
              <div className="space-y-2.5">
                {place.reviews.slice(0, 4).map((rev, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#181B20] border border-[#2A2F3A] space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#F8FAFC]">{rev.author}</span>
                      <span className="font-mono tabular-nums text-[#94A3B8]">
                        {rev.rating} ★ · {rev.relativeTime}
                      </span>
                    </div>
                    <p className="text-xs text-[#94A3B8] leading-relaxed line-clamp-4">
                      {rev.text}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
