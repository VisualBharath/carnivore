export interface OriginLocation {
  lat: number;
  lng: number;
  label: string;
  isCurrentGps: boolean;
}

export type MeatCategory =
  | "all"
  | "steakhouse"
  | "bbq"
  | "biryani"
  | "seafood"
  | "chicken"
  | "pork";

export type SortOption = "optimal" | "rating" | "reviews" | "distance";

export type TrafficStatus = "Light Traffic" | "Moderate Traffic" | "Heavy Traffic";

export type WaitLevel = "Low" | "Moderate" | "High";

export interface PlaceReview {
  author: string;
  rating: number;
  text: string;
  relativeTime: string;
}

export interface ParkingSummary {
  freeLot?: boolean;
  paidLot?: boolean;
  freeStreet?: boolean;
  paidStreet?: boolean;
  valet?: boolean;
  freeGarage?: boolean;
  paidGarage?: boolean;
}

export interface OpeningPeriod {
  openDay: number;
  openHour: number;
  openMinute: number;
  closeDay?: number;
  closeHour?: number;
  closeMinute?: number;
}

export interface RestaurantPlace {
  id: string;
  name: string;
  formattedAddress: string;
  location: { lat: number; lng: number };
  rating: number;
  userRatingCount: number;
  priceLevel: string | null;
  isOpenNow: boolean | null;
  weekdayDescriptions: string[];
  periods: OpeningPeriod[];
  photoUrls: string[];
  reviews: PlaceReview[];
  parkingOptions: ParkingSummary | null;
  googleMapsUri: string;
}

export interface RouteTelemetry {
  placeId: string;
  durationSec: number;
  staticDurationSec: number;
  distanceMeters: number;
  trafficStatus: TrafficStatus;
  trafficRatio: number;
  routeInstance?: google.maps.routes.Route;
}

export interface HourlySlot {
  hour: number;
  hourLabel: string;
  driveMinutes: number;
  staticMinutes: number;
  crowdPercent: number;
  waitLevel: WaitLevel;
  isOpen: boolean;
  combinedScore: number;
}

export interface VisitPlan {
  bestTimeLabel: string;
  optimalLeaveTime: string;
  optimalArrivalTime: string;
  waitEstimate: WaitLevel;
  optimalHour: number;
  hourlyCurve: HourlySlot[];
}

export interface HeroDish {
  name: string;
  meatType: string;
  spiceLevel: "Mild" | "Medium" | "Spicy" | "Fiery";
  whyItsFamous: string;
}

export interface RunnerUpDish {
  name: string;
  mentionsContext: string;
}

export interface GeminiDishAnalysis {
  heroDish: HeroDish;
  runnerUpDishes: RunnerUpDish[];
  pros: string[];
  cons: string[];
  visitTip: string;
}

export interface RestaurantWithTelemetry {
  place: RestaurantPlace;
  route?: RouteTelemetry;
  straightLineMeters: number;
  visitPlan: VisitPlan;
  analysis?: GeminiDishAnalysis;
  analysisLoading?: boolean;
  analysisError?: string;
}
