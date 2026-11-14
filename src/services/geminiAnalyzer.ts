import { GeminiDishAnalysis, RestaurantPlace } from "../types";

const STORAGE_PREFIX = "carnivore_route_ai_v1:";
const memoryCache = new globalThis.Map<string, GeminiDishAnalysis>();
const inflightRequests = new globalThis.Map<string, Promise<GeminiDishAnalysis>>();

export function getCachedAnalysis(placeId: string): GeminiDishAnalysis | null {
  const mem = memoryCache.get(placeId);
  if (mem) return mem;

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${placeId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as GeminiDishAnalysis;
      if (parsed?.heroDish?.name) {
        memoryCache.set(placeId, parsed);
        return parsed;
      }
    }
  } catch {
    // Ignore localStorage parse/access issues
  }
  return null;
}

export async function analyzeRestaurantWithGemini(
  place: RestaurantPlace
): Promise<GeminiDishAnalysis> {
  const cached = getCachedAnalysis(place.id);
  if (cached) return cached;

  const existing = inflightRequests.get(place.id);
  if (existing) return existing;

  const promise = (async () => {
    const response = await fetch("/api/analyze-restaurant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        placeId: place.id,
        name: place.name,
        formattedAddress: place.formattedAddress,
        rating: place.rating,
        userRatingCount: place.userRatingCount,
        reviews: place.reviews,
      }),
    });

    if (!response.ok) {
      let errMsg = `Gemini analysis failed (${response.status})`;
      try {
        const errData = (await response.json()) as { error?: string };
        if (errData?.error) errMsg = errData.error;
      } catch {
        // Keep generic error
      }
      throw new Error(errMsg);
    }

    const data = (await response.json()) as { analysis: GeminiDishAnalysis };
    const analysis = data.analysis;

    memoryCache.set(place.id, analysis);
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${place.id}`, JSON.stringify(analysis));
    } catch {
      // Ignore storage quota errors
    }

    return analysis;
  })();

  inflightRequests.set(place.id, promise);
  try {
    return await promise;
  } finally {
    inflightRequests.delete(place.id);
  }
}
