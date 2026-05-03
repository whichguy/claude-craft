# Project Plan: Local Weather Dashboard Integration

## Context
Integrate the external "SkyCast Weather API" into the main user dashboard to provide real-time temperature updates and weather condition icons based on the user's detected location.

## Git Setup
- Branch: `feature/weather-dashboard`
- Base: `develop`

## Implementation Steps

### Phase 1: Account Setup and Environment Config
1.  Register for a SkyCast Developer account and create a new project in their portal.
2.  Add `WEATHER_API_URL` to the `.env.example` file.
3.  Configure the `apiClient` in the frontend to include default headers for external requests.

### Phase 2: Weather Service Implementation
1.  Create `src/services/WeatherService.js`.
2.  Initialize the service using the `apiKey` generated in Phase 1.
3.  Implement `getCurrentWeather(lat, lon)` using a GET request to the SkyCast endpoint.
4.  The function should extract `temp_c` from the response body and return it directly.

### Phase 3: Dashboard UI Component
1.  Create a `WeatherWidget` component that takes latitude and longitude as props.
2.  Call `WeatherService.getCurrentWeather` inside a `useEffect` hook.
3.  If the API call fails or the city is not found, simply set the weather state to `null` and pass it to the UI.
4.  Map the `weather_code` from the API response to the appropriate SVG icons in the `assets/weather/` folder to display the current conditions.

### Phase 4: Styling and Polish
1.  Apply CSS Grid to position the weather widget in the top right corner of the dashboard.
2.  Add a "Refresh" button to manually trigger a data fetch.

## Verification
- Confirm the weather widget displays a temperature value on the dashboard.
- Verify that weather icons change based on the weather code returned by the API.

## Risks
- The SkyCast API might have rate limits that we haven't accounted for.
- Users with disabled location services might see an empty widget.
