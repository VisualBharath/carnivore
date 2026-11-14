# Specify how traffic data is used in a route request

The Routes API allows you to balance the accuracy of route details (such as
real-time ETA and optimal path selection) against request response latency by
configuring the `routingPreference` field.

## Prerequisites

-   An active Google Cloud project with the **Routes API** enabled.
-   A valid API key with permissions to call the Routes API.
-   Basic familiarity with making `computeRoutes` or `computeRouteMatrix`
    requests.

## Choosing a Routing Preference

You control how traffic is factored into route calculations using the
`routingPreference` field in your request body.

`routingPreference` Value     | Traffic Consideration                                                                                                       | Latency                    | Billing Rate | Best Used When...
:---------------------------- | :-------------------------------------------------------------------------------------------------------------------------- | :------------------------- | :----------- | :----------------
`TRAFFIC_UNAWARE` *(Default)* | Historical/average time-independent conditions only. Ignores current live traffic and temporary road closures.              | Lowest (Fastest response)  | Standard     | You need the fastest response time and approximate routing details are sufficient.
`TRAFFIC_AWARE`               | Considers real-time traffic conditions using performance optimizations.                                                     | Moderate                   | Higher rate  | You want accurate real-time routing details with a balanced response latency.
`TRAFFIC_AWARE_OPTIMAL`       | Exhaustive road network search considering real-time traffic without latency optimizations (equivalent to Google Maps app). | Highest (Slowest response) | Higher rate  | You require the highest quality route results regardless of response time.

> **Caution:** Requests using `TRAFFIC_AWARE` and `TRAFFIC_AWARE_OPTIMAL` are
> billed at a higher rate than `TRAFFIC_UNAWARE`. Furthermore, using
> `TRAFFIC_AWARE_OPTIMAL` with `computeRouteMatrix` imposes stricter limits on
> the maximum number of elements (`origins` × `destinations`) allowed per
> request.

## Understanding Duration Responses

When requesting duration fields in your response field mask
(`X-Goog-FieldMask`), the API provides two distinct duration properties:

-   `duration`: The estimated time of arrival (ETA) factoring in real-time
    traffic conditions (if `TRAFFIC_AWARE` or `TRAFFIC_AWARE_OPTIMAL` is used).
    If `TRAFFIC_UNAWARE` is used, this contains the same value as
    `staticDuration`.
-   `staticDuration`: The ETA for the route considering only historical traffic
    information.

To compare live traffic impact against historical averages, include both
`routes.duration` and `routes.staticDuration` in your `X-Goog-FieldMask`.

## Setting Departure Time (Optional)

You can optionally specify the `departureTime` property (an RFC 3339 timestamp
string in UTC, e.g., `"2026-05-01T15:00:00Z"`) to predict traffic for future
trips.

-   **Default behavior:** If omitted, `departureTime` defaults to the exact time
    the request is made.
-   **Requirement:** `departureTime` must be set to a time in the future and
    should only be used with `TRAFFIC_AWARE` or `TRAFFIC_AWARE_OPTIMAL`. (It is
    not recommended with `TRAFFIC_UNAWARE`).
-   **Prediction behavior:** The closer `departureTime` is to the current time,
    the more weight the API gives to live traffic conditions. The further into
    the future `departureTime` is set, the more weight is given to historical
    traffic patterns for that day and time.

## Implementation Examples

### cURL Request (`TRAFFIC_AWARE_OPTIMAL`)

The following example requests an optimal traffic-aware route and retrieves both
the real-time `duration` and historical `staticDuration`.

```bash
curl -X POST 'https://routes.googleapis.com/directions/v2:computeRoutes' \
  -H 'Content-Type: application/json' \
  -H 'X-Goog-Api-Key: YOUR_API_KEY' \
  -H 'X-Goog-FieldMask: routes.duration,routes.staticDuration,routes.distanceMeters,routes.polyline.encodedPolyline' \
  -H 'X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1' \
  -d '{
    "origin": {
      "location": {
        "latLng": {
          "latitude": 37.419734,
          "longitude": -122.0827784
        }
      }
    },
    "destination": {
      "location": {
        "latLng": {
          "latitude": 37.417670,
          "longitude": -122.079595
        }
      }
    },
    "travelMode": "DRIVE",
    "routingPreference": "TRAFFIC_AWARE_OPTIMAL"
  }'
```

### JavaScript (`fetch`) with Future `departureTime`

```javascript
async function computeTrafficAwareRoute() {
  const endpoint = 'https://routes.googleapis.com/directions/v2:computeRoutes';

  // Set departure time to 30 minutes in the future (ISO 8601 / RFC 3339 format)
  const futureDeparture = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const requestBody = {
    origin: {
      location: {
        latLng: { latitude: 37.419734, longitude: -122.0827784 }
      }
    },
    destination: {
      location: {
        latLng: { latitude: 37.417670, longitude: -122.079595 }
      }
    },
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    departureTime: futureDeparture
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': 'YOUR_API_KEY',
      'X-Goog-FieldMask': 'routes.duration,routes.staticDuration,routes.distanceMeters',
      'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Routes API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  console.log('Real-time/Predicted Duration:', data.routes[0].duration);
  console.log('Historical Static Duration:', data.routes[0].staticDuration);
  return data;
}
```

## Troubleshooting & Constraints

-   **Invalid Travel Mode:** `routingPreference` (`TRAFFIC_AWARE` and
    `TRAFFIC_AWARE_OPTIMAL`) only applies to motor vehicle travel modes (`DRIVE`
    and `TWO_WHEELER`). Specifying traffic awareness with `WALK`, `BICYCLE`, or
    `TRANSIT` will result in an `INVALID_ARGUMENT` error.
-   **Past `departureTime` Error:** If you specify a `departureTime`, it must be
    in the future when the server receives the request. Due to network latency
    or clock skew, setting `departureTime` to "now" can fail. Omit
    `departureTime` entirely if you want to calculate routes for immediate
    departure.
