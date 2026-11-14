import {
  MeatCategory,
  OpeningPeriod,
  OriginLocation,
  ParkingSummary,
  PlaceReview,
  RestaurantPlace,
} from "../types";

export const DEFAULT_CITY_CENTER: OriginLocation = {
  lat: 37.7749,
  lng: -122.4194,
  label: "San Francisco, CA",
  isCurrentGps: false,
};

export const MEAT_CATEGORY_QUERIES: Record<MeatCategory, string> = {
  all: "best non veg restaurants biryani seafood steakhouse bbq grill",
  steakhouse: "best steakhouse prime rib wagyu grill restaurant",
  bbq: "best bbq smokehouse brisket ribs grill restaurant",
  biryani: "best biryani tandoori kebab chicken mutton restaurant",
  seafood: "best seafood crab lobster coastal grill restaurant",
  chicken: "best fried chicken wings rotisserie peri peri restaurant",
  pork: "best pork ribs char siu ramen tonkatsu restaurant",
};

export const MEAT_CATEGORY_LABELS: Record<MeatCategory, string> = {
  all: "All Cuts",
  steakhouse: "Steakhouse",
  bbq: "BBQ & Grill",
  biryani: "Biryani & Kebabs",
  seafood: "Seafood",
  chicken: "Chicken",
  pork: "Pork & Ribs",
};

export function checkQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("OVER_QUERY_LIMIT") ||
    msg.includes("QuotaExceededError")
  ) {
    window.dispatchEvent(new CustomEvent("gmp-quota-exceeded"));
    return true;
  }
  return false;
}

export function requestUserLocation(): Promise<OriginLocation> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(DEFAULT_CITY_CENTER);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: "Current GPS Location",
          isCurrentGps: true,
        });
      },
      () => {
        resolve(DEFAULT_CITY_CENTER);
      },
      {
        enableHighAccuracy: false,
        timeout: 6000,
        maximumAge: 120000,
      }
    );
  });
}

export function haversineDistanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatPriceLevel(priceLevel: string | null | undefined): string | null {
  switch (priceLevel) {
    case "FREE":
      return "Free";
    case "INEXPENSIVE":
      return "$";
    case "MODERATE":
      return "$$";
    case "EXPENSIVE":
      return "$$$";
    case "VERY_EXPENSIVE":
      return "$$$$";
    default:
      return null;
  }
}

function extractParking(
  parking: google.maps.places.ParkingOptions | null | undefined
): ParkingSummary | null {
  if (!parking) return null;
  const summary: ParkingSummary = {
    freeLot: Boolean(parking.hasFreeParkingLot),
    paidLot: Boolean(parking.hasPaidParkingLot),
    freeStreet: Boolean(parking.hasFreeStreetParking),
    paidStreet: Boolean(parking.hasPaidStreetParking),
    valet: Boolean(parking.hasValetParking),
    freeGarage: Boolean(parking.hasFreeGarageParking),
    paidGarage: Boolean(parking.hasPaidGarageParking),
  };
  const anyTrue = Object.values(summary).some(Boolean);
  return anyTrue ? summary : null;
}

function extractPeriods(
  hours: google.maps.places.OpeningHours | null | undefined
): OpeningPeriod[] {
  if (!hours?.periods) return [];
  return hours.periods
    .filter((p) => p.open)
    .map((p) => ({
      openDay: p.open!.day,
      openHour: p.open!.hour,
      openMinute: p.open!.minute,
      closeDay: p.close?.day,
      closeHour: p.close?.hour,
      closeMinute: p.close?.minute,
    }));
}

export function isOpenAtDate(periods: OpeningPeriod[], target: Date): boolean | null {
  if (!periods || periods.length === 0) return null;
  // 24/7 check: single period starting Sunday 00:00 with no close
  if (periods.length === 1 && periods[0].closeHour === undefined) {
    return true;
  }

  const day = target.getDay();
  const minutesSinceMidnight = target.getHours() * 60 + target.getMinutes();

  for (const p of periods) {
    if (p.openDay === day) {
      const openMin = p.openHour * 60 + p.openMinute;
      if (p.closeHour === undefined || p.closeMinute === undefined) {
        if (minutesSinceMidnight >= openMin) return true;
      } else {
        const closeDay = p.closeDay ?? p.openDay;
        const closeMin = p.closeHour * 60 + p.closeMinute;
        if (closeDay === p.openDay) {
          if (minutesSinceMidnight >= openMin && minutesSinceMidnight < closeMin) {
            return true;
          }
        } else {
          // Crosses midnight into next day
          if (minutesSinceMidnight >= openMin) return true;
        }
      }
    } else if (p.closeDay === day && p.closeHour !== undefined && p.closeMinute !== undefined) {
      const closeMin = p.closeHour * 60 + p.closeMinute;
      if (minutesSinceMidnight < closeMin) return true;
    }
  }
  return false;
}

export async function searchNonVegRestaurants(
  placesLib: google.maps.PlacesLibrary,
  origin: OriginLocation,
  category: MeatCategory,
  radiusMeters: number,
  openNowOnly: boolean
): Promise<{ restaurants: RestaurantPlace[]; rawTotalCount: number }> {
  const query = MEAT_CATEGORY_QUERIES[category] ?? MEAT_CATEGORY_QUERIES.all;

  try {
    const request: google.maps.places.SearchByTextRequest = {
      textQuery: query,
      includedType: "restaurant",
      minRating: 4.0,
      maxResultCount: 20,
      isOpenNow: openNowOnly ? true : undefined,
      locationBias: {
        center: { lat: origin.lat, lng: origin.lng },
        radius: radiusMeters,
      },
      fields: [
        "id",
        "displayName",
        "formattedAddress",
        "location",
        "rating",
        "userRatingCount",
        "priceLevel",
        "regularOpeningHours",
        "photos",
        "reviews",
        "parkingOptions",
        "googleMapsURI",
      ],
      internalUsageAttributionIds: ["gmp_mcp_codeassist_v1_aistudio"],
    };

    const response = await placesLib.Place.searchByText(request);
    const rawPlaces = response?.places ?? [];

    // Mandatory Quality Gate: strictly filter userRatingCount >= 500 AND rating >= 4.0
    const qualified = rawPlaces.filter(
      (p) => (p.userRatingCount ?? 0) >= 500 && (p.rating ?? 0) >= 4.0 && Boolean(p.location)
    );

    const restaurants: RestaurantPlace[] = await Promise.all(
      qualified.map(async (p) => {
        const loc = p.location!;
        const periods = extractPeriods(p.regularOpeningHours);
        let openNow: boolean | null = null;
        try {
          const openResult = await p.isOpen();
          openNow = typeof openResult === "boolean" ? openResult : isOpenAtDate(periods, new Date());
        } catch {
          openNow = isOpenAtDate(periods, new Date());
        }

        const photoUrls: string[] = (p.photos ?? [])
          .slice(0, 4)
          .map((photo) => {
            try {
              return photo.getURI({ maxWidth: 800, maxHeight: 600 });
            } catch {
              return "";
            }
          })
          .filter(Boolean);

        const reviews: PlaceReview[] = (p.reviews ?? [])
          .filter((r) => Boolean(r.text))
          .slice(0, 10)
          .map((r) => ({
            author: r.authorAttribution?.displayName || "Verified Diner",
            rating: r.rating ?? 5,
            text: r.text || "",
            relativeTime: r.relativePublishTimeDescription || "Recent",
          }));

        const lat = loc.lat();
        const lng = loc.lng();

        return {
          id: p.id,
          name: p.displayName || "Unnamed Restaurant",
          formattedAddress: p.formattedAddress || "",
          location: { lat, lng },
          rating: p.rating ?? 4.0,
          userRatingCount: p.userRatingCount ?? 500,
          priceLevel: formatPriceLevel(p.priceLevel),
          isOpenNow: openNow,
          weekdayDescriptions: p.regularOpeningHours?.weekdayDescriptions ?? [],
          periods,
          photoUrls,
          reviews,
          parkingOptions: extractParking(p.parkingOptions),
          googleMapsUri:
            p.googleMapsURI ||
            `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${encodeURIComponent(p.id)}`,
        };
      })
    );

    return {
      restaurants,
      rawTotalCount: rawPlaces.length,
    };
  } catch (err) {
    checkQuotaError(err);
    throw err;
  }
}
