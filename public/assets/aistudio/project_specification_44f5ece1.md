# Project Specification: CarnivoreRoute (Non-Veg Restaurant & Smart Visit Planner)

## 1. Executive Summary
**CarnivoreRoute** (working title) is a specialized culinary discovery and visit-planning web application designed exclusively for non-vegetarian food enthusiasts. Unlike generic restaurant aggregators, it enforces a strict quality filter (minimum 500+ Google ratings) and solves the "when should I leave?" problem by combining real-time/historical Google Maps traffic data, restaurant peak-hour telemetry, and AI-synthesized review insights (signature dishes, pros, and cons).

---

## 2. Target Audience & Value Proposition
* **Target Audience:** Foodies, meat lovers, groups planning weekend dinners, and travelers looking for guaranteed high-volume, high-rated non-veg spots without wasting hours in traffic or waiting lists.
* **Core Value Proposition:**
  1. **Zero-Fluff Quality:** Only surfaces proven non-veg establishments with $\ge 500$ reviews and high ratings.
  2. **Time & Traffic Intelligence:** Calculates the optimal "Leave By" and "Arrive By" windows by cross-referencing live/predictive Google Maps travel times with restaurant crowd density.
  3. **Dish-First Discovery:** Highlights the exact must-order non-veg signature dishes rather than generic cuisine tags.
  4. **Honest Decision Matrix:** Uses AI to distill hundreds of reviews into clear, scannable Pros & Cons.

---

## 3. Core Functional Requirements

### 3.1. Discovery & Strict Filtering Engine
* **Hard Filter:** Automatically excludes any venue with `< 500` total user ratings on Google Places.
* **Non-Veg Focus:** Filters for steakhouses, BBQ, biryani houses, coastal seafood, shawarma/kebab joints, fried chicken, and regional meat specialties.
* **Search & Filters:**
  * Location-based search (Current GPS or custom city/neighborhood).
  * Meat/Dish Type filter (Chicken, Mutton/Lamb, Seafood, Pork, Beef, Mixed Grill).
  * Sort by: *Optimal Visit Time Now*, *Highest Rating*, *Most Reviewed*, *Shortest Drive*.

### 3.2. Smart Visit & Traffic Planner (The Core Differentiator)
* **Origin-to-Destination Routing:** Uses user's starting location to calculate current drive time vs. typical drive time.
* **Crowd vs. Traffic Matrix:** Combines Google Maps traffic duration with popular times (busyness) data to recommend:
  * **Best Time to Visit Today:** e.g., *"Leave at 7:15 PM (22 min drive) to arrive right before the 8:00 PM rush."*
  * **Wait-Time Estimator:** Low / Moderate / High wait warning.
* **Interactive Timeline Slider:** Users can scrub through hours of the day to see how both traffic duration and restaurant crowd levels fluctuate.

### 3.3. Restaurant Deep-Dive Profile
* **Header Telemetry:** Name, Rating (e.g., `4.6 ★`), Total Review Count (`2,450+ reviews`), Price Tier (`₹₹` / `$$`), Open/Closed status, and Direct "Start Navigation" CTA.
* **The "Hero" Dish Spotlight:** Prominently displays the #1 community-voted non-veg dish (e.g., *"Mutton Nalli Nihari"* or *"Ghee Roast Crab"*), complete with a brief description and why people love it.
* **Secondary Must-Tries:** Top 3–4 runner-up dishes extracted from review frequency.
* **AI-Synthesized Pros & Cons:**
  * **Pros (Green):** e.g., *Tender meat quality, generous portions, quick table turnover.*
  * **Cons (Red/Amber):** e.g., *No valet parking, loud ambiance, spicy baseline.*
* **Practical Logistics:** Parking availability, seating type (family/casual/fine-dine), spice level indicator, and hygiene/service sentiment.

---

## 4. Technical Architecture & Data Flow

### 4.1. Tech Stack
* **Frontend:** React (TypeScript), Tailwind CSS, Lucide Icons, Recharts (for traffic/crowd timeline charts).
* **APIs & Services:**
  * **Google Maps JavaScript API & Places API (New):** Fetch place details, ratings, `userRatingCount` ($\ge 500$), photos, and reviews.
  * **Google Routes API:** Compute real-time and predictive traffic duration (`TRAFFIC_AWARE`).
  * **Gemini API (`gemini-2.5-flash`):** Process raw Google Places reviews in real time to extract the *Best Non-Veg Dish*, *Top Runner-up Dishes*, and structured *Pros & Cons* JSON.

### 4.2. Data Pipeline
1. User enters location $\rightarrow$ Query **Places API** for non-veg restaurants.
2. Client/Middleware filters array where `userRatingCount >= 500` and `rating >= 4.0`.
3. Parallel call to **Routes API** calculates travel duration from user origin.
4. On card click (or top results pre-fetch), pass top 15–20 recent/relevant reviews to **Gemini API** with a strict JSON schema prompt to output signature dishes and pros/cons.

---

## 5. UI/UX & Design System
* **Theme:** Modern Dark-Mode Culinary Aesthetic (Deep charcoal `#121212` backgrounds, warm ember/terracotta `#E85D04` primary accents, crisp off-white `#F8F9FA` typography) to make food photography pop.
* **Layout:** Split-screen view on desktop (Interactive Map on the right, scrollable rich restaurant cards on the left); bottom-sheet map toggle on mobile.
* **Micro-interactions:** Live traffic pulse badges (Green/Yellow/Red), expandable Pros/Cons accordions, and one-click "Share Visit Plan" (copies formatted text with restaurant, dish, and departure time for WhatsApp/iMessage).