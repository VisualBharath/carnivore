import {
  HourlySlot,
  OriginLocation,
  RestaurantPlace,
  RouteTelemetry,
  TrafficStatus,
  VisitPlan,
  WaitLevel,
} from "../types";
import { checkQuotaError, isOpenAtDate } from "./placesService";

const routeCache = new globalThis.Map<string, RouteTelemetry>();

export function classifyTraffic(durationSec: number, staticDurationSec: number): {
  status: TrafficStatus;
  ratio: number;
} {
  const safeStatic = Math.max(staticDurationSec, 60);
  const ratio = durationSec / safeStatic;

  if (durationSec <= safeStatic * 1.15) {
    return { status: "Light Traffic", ratio };
  }
  if (durationSec <= safeStatic * 1.4) {
    return { status: "Moderate Traffic", ratio };
  }
  return { status: "Heavy Traffic", ratio };
}

export async function computeRouteTelemetry(
  routesLib: google.maps.RoutesLibrary,
  origin: OriginLocation,
  destination: { lat: number; lng: number },
  placeId: string
): Promise<RouteTelemetry | null> {
  const cacheKey = `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}->${placeId}`;
  const cached = routeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const request: google.maps.routes.ComputeRoutesRequest = {
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      travelMode: "DRIVING",
      routingPreference: "TRAFFIC_AWARE",
      fields: [
        "path",
        "distanceMeters",
        "durationMillis",
        "staticDurationMillis",
        "viewport",
        "legs",
      ],
      internalUsageAttributionIds: ["gmp_mcp_codeassist_v1_aistudio"],
    };

    const result = await routesLib.Route.computeRoutes(request);
    const route = result?.routes?.[0];
    if (!route) return null;

    const durationSec = Math.max(60, Math.round((route.durationMillis ?? 0) / 1000));
    const staticDurationSec = Math.max(
      60,
      Math.round((route.staticDurationMillis ?? route.durationMillis ?? 0) / 1000)
    );
    const distanceMeters = route.distanceMeters ?? 0;

    const { status, ratio } = classifyTraffic(durationSec, staticDurationSec);

    const telemetry: RouteTelemetry = {
      placeId,
      durationSec,
      staticDurationSec,
      distanceMeters,
      trafficStatus: status,
      trafficRatio: ratio,
      routeInstance: route,
    };

    routeCache.set(cacheKey, telemetry);
    return telemetry;
  } catch (err) {
    checkQuotaError(err);
    console.warn(`Routes API calculation failed for ${placeId}:`, err);
    return null;
  }
}

function formatHour(hour24: number, minute = 0): string {
  const normalized = ((hour24 % 24) + 24) % 24;
  const period = normalized >= 12 ? "PM" : "AM";
  const h12 = normalized % 12 === 0 ? 12 : normalized % 12;
  const minStr = minute === 0 ? "00" : String(minute).padStart(2, "0");
  return `${h12}:${minStr} ${period}`;
}

function formatShortHour(hour24: number): string {
  const normalized = ((hour24 % 24) + 24) % 24;
  const period = normalized >= 12 ? "p" : "a";
  const h12 = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${h12}${period}`;
}

/**
 * Generates an interactive 12-hour traffic & crowd profile anchored on live Routes API telemetry
 * and restaurant opening hours, returning a concrete leave-by recommendation.
 */
export function generateSmartVisitPlan(
  place: RestaurantPlace,
  route: RouteTelemetry | undefined,
  straightLineMeters: number,
  now: Date = new Date()
): VisitPlan {
  // Baseline static & live durations anchored by real Routes API when available
  const estimatedFallbackMin = Math.max(6, Math.round((straightLineMeters / 1000) * 2.4));
  const staticMin = route
    ? Math.max(3, Math.round(route.staticDurationSec / 60))
    : estimatedFallbackMin;
  const liveMin = route
    ? Math.max(3, Math.round(route.durationSec / 60))
    : estimatedFallbackMin;

  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const liveRatio = Math.max(1.0, liveMin / Math.max(staticMin, 1));

  // Typical restaurant & commuter curve multipliers from 11 AM (11) to 11 PM (23)
  const hours = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

  // Popularity factor scaled slightly by review volume (proven high-volume spots peak sharper)
  const popularityBoost = place.userRatingCount >= 2000 ? 1.12 : place.userRatingCount >= 1000 ? 1.05 : 0.96;

  const hourlyCurve: HourlySlot[] = hours.map((h) => {
    const slotDate = new Date(now);
    slotDate.setHours(h, 15, 0, 0);
    const periodOpen = isOpenAtDate(place.periods, slotDate);
    // If periods are unavailable, assume standard dining hours 11:30–22:30
    const isOpen = periodOpen !== null ? periodOpen : h >= 11 && h <= 22;

    // Modeled traffic multiplier for urban dining corridors
    let trafficMultiplier = 1.04;
    if (h >= 12 && h <= 13) trafficMultiplier = 1.18;
    else if (h >= 17 && h <= 18) trafficMultiplier = 1.38;
    else if (h === 19) trafficMultiplier = 1.28;
    else if (h === 20) trafficMultiplier = 1.16;
    else if (h >= 21) trafficMultiplier = 1.05;

    // Anchor the current hour directly to live Routes API ratio
    if (h === currentHour) {
      trafficMultiplier = liveRatio;
    } else if (Math.abs(h - currentHour) === 1 && route) {
      trafficMultiplier = (trafficMultiplier + liveRatio) / 2;
    }

    const driveMinutes = Math.max(3, Math.round(staticMin * trafficMultiplier));

    // Modeled dining crowd curve (lunch peak 13:00, dinner peak 20:00)
    let baseCrowd = 30;
    if (h === 11) baseCrowd = 28;
    else if (h === 12) baseCrowd = 64;
    else if (h === 13) baseCrowd = 80;
    else if (h === 14) baseCrowd = 52;
    else if (h === 15 || h === 16) baseCrowd = 24;
    else if (h === 17) baseCrowd = 42;
    else if (h === 18) baseCrowd = 68;
    else if (h === 19) baseCrowd = 86;
    else if (h === 20) baseCrowd = 94;
    else if (h === 21) baseCrowd = 74;
    else if (h === 22) baseCrowd = 44;
    else if (h === 23) baseCrowd = 22;

    const crowdPercent = isOpen
      ? Math.min(98, Math.max(12, Math.round(baseCrowd * popularityBoost)))
      : 0;

    const waitLevel: WaitLevel =
      crowdPercent >= 78 ? "High" : crowdPercent >= 52 ? "Moderate" : "Low";

    // Lower combined score is better (low drive delay + low crowd while open)
    const combinedScore = isOpen
      ? driveMinutes * 1.4 + crowdPercent * 0.55
      : 999;

    return {
      hour: h,
      hourLabel: formatShortHour(h),
      driveMinutes,
      staticMinutes: staticMin,
      crowdPercent,
      waitLevel,
      isOpen,
      combinedScore,
    };
  });

  // Find upcoming open slots from currentHour onward (or wrap to next opening if late)
  const upcomingOpenSlots = hourlyCurve.filter((s) => s.isOpen && s.hour >= currentHour);
  const candidateSlots =
    upcomingOpenSlots.length > 0 ? upcomingOpenSlots : hourlyCurve.filter((s) => s.isOpen);

  const bestSlot =
    candidateSlots.reduce<HourlySlot | null>(
      (best, curr) => (!best || curr.combinedScore < best.combinedScore ? curr : best),
      null
    ) ?? hourlyCurve[7];

  const currentSlot = hourlyCurve.find((s) => s.hour === currentHour);
  const isCurrentlyOpen = place.isOpenNow ?? currentSlot?.isOpen ?? true;

  // Build actionable recommendation string
  let bestTimeLabel = "";
  let optimalLeaveTime = formatHour(currentHour, currentMin);
  const arrivalDate = new Date(now.getTime() + liveMin * 60000);
  let optimalArrivalTime = formatHour(arrivalDate.getHours(), arrivalDate.getMinutes());
  let waitEstimate: WaitLevel = currentSlot?.waitLevel ?? "Low";

  const trafficDelayMin = Math.max(0, liveMin - staticMin);

  if (!isCurrentlyOpen) {
    const nextOpen = upcomingOpenSlots[0] ?? candidateSlots[0];
    if (nextOpen) {
      const leaveHour = nextOpen.hour;
      const leaveMin = Math.max(0, 60 - nextOpen.driveMinutes);
      const displayLeaveHour = nextOpen.driveMinutes > 15 ? leaveHour - 1 : leaveHour;
      const displayLeaveMin = nextOpen.driveMinutes > 15 ? leaveMin : 0;
      optimalLeaveTime = formatHour(displayLeaveHour, displayLeaveMin);
      optimalArrivalTime = formatHour(nextOpen.hour, 0);
      waitEstimate = nextOpen.waitLevel;
      bestTimeLabel = `Currently closed · Leave at ${optimalLeaveTime} (${nextOpen.driveMinutes} min drive) for opening seating`;
    } else {
      bestTimeLabel = `Plan for ${formatHour(bestSlot.hour, 0)} (${bestSlot.driveMinutes} min drive) when dining room opens`;
    }
  } else if (
    route?.trafficStatus === "Heavy Traffic" &&
    bestSlot.hour > currentHour &&
    liveMin - bestSlot.driveMinutes >= 6
  ) {
    const savedMin = liveMin - bestSlot.driveMinutes;
    optimalLeaveTime = formatHour(bestSlot.hour, 0);
    const arriveDt = new Date(now);
    arriveDt.setHours(bestSlot.hour, bestSlot.driveMinutes, 0, 0);
    optimalArrivalTime = formatHour(arriveDt.getHours(), arriveDt.getMinutes());
    waitEstimate = bestSlot.waitLevel;
    bestTimeLabel = `Wait until ${optimalLeaveTime} when traffic drops by ${savedMin} mins (${bestSlot.driveMinutes} min drive)`;
  } else if (currentHour >= 17 && currentHour < 20 && currentSlot && currentSlot.crowdPercent < 82) {
    bestTimeLabel = `Leave now (${liveMin} min drive) to beat the 8:00 PM dinner peak`;
  } else if (trafficDelayMin <= 3 && (currentSlot?.crowdPercent ?? 40) <= 65) {
    bestTimeLabel = `Ideal window right now (${liveMin} min drive · Low wait)`;
  } else if (bestSlot.hour > currentHour && bestSlot.combinedScore + 8 < (currentSlot?.combinedScore ?? 999)) {
    optimalLeaveTime = formatHour(bestSlot.hour, 0);
    const arriveDt = new Date(now);
    arriveDt.setHours(bestSlot.hour, bestSlot.driveMinutes, 0, 0);
    optimalArrivalTime = formatHour(arriveDt.getHours(), arriveDt.getMinutes());
    waitEstimate = bestSlot.waitLevel;
    bestTimeLabel = `Best window at ${optimalLeaveTime} (${bestSlot.driveMinutes} min drive · ${bestSlot.waitLevel} wait)`;
  } else {
    bestTimeLabel = `Leave now (${liveMin} min drive · ${waitEstimate} crowd wait)`;
  }

  return {
    bestTimeLabel,
    optimalLeaveTime,
    optimalArrivalTime,
    waitEstimate,
    optimalHour: bestSlot.hour,
    hourlyCurve,
  };
}
