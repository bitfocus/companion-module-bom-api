## Bureau of Meteorology API

Get Australian weather data

### Actions

- Select Location

When the location search (based on the module config), returns multiple hits, you can select which location to retrieve data for here.

- Get Data

Fetches one kind of data (Observations, Daily Forecast, Hourly Forecast, Warnings or Location Information) for a geohash, and returns the whole response as the action's result, for storing in a variable and reading with expressions. The geohash defaults to the current location, and a blank geohash also uses the current location. It does not change the module's variables.

### Feedbacks

None

### Variables

- Daily Forecast
- Hourly Forecast
- Location Info
- Observations
- Warnings
