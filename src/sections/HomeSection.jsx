function HomeSection({ weatherMood, latestPredictionData }) {
  const moodLabel = {
    clear: "Clear sky mode",
    cloudy: "Cloud cover mode",
    rainy: "Rain alert mode",
    stormy: "Storm watch mode",
    snowy: "Snow mode",
    warm: "Warm weather mode",
  }[weatherMood] || "Adaptive weather mode";

  const city = latestPredictionData?.city || "Awaiting city";
  const weather = latestPredictionData?.weather;
  const selectedModel = latestPredictionData?.selectedModel;
  const currentTemp = weather?.temps?.at?.(-1);
  const avgHumidity = weather?.humidity?.length
    ? weather.humidity.reduce((sum, value) => sum + value, 0) / weather.humidity.length
    : null;
  const avgWind = weather?.wind?.length
    ? weather.wind.reduce((sum, value) => sum + value, 0) / weather.wind.length
    : null;
  const totalRain = weather?.precipitation?.length
    ? weather.precipitation.reduce((sum, value) => sum + value, 0)
    : null;
  const forecastLow = selectedModel?.future?.length ? Math.min(...selectedModel.future) : null;
  const forecastHigh = selectedModel?.future?.length ? Math.max(...selectedModel.future) : null;

  const statItems = [
    {
      label: "Wind",
      value: avgWind !== null ? `${avgWind.toFixed(1)} km/h` : "Awaiting forecast",
    },
    {
      label: "Rain",
      value: totalRain !== null ? `${totalRain.toFixed(1)} mm` : "Awaiting forecast",
    },
    {
      label: "Humidity",
      value: avgHumidity !== null ? `${avgHumidity.toFixed(0)}%` : "Awaiting forecast",
    },
  ];

  return (
    <section id="home" className={`weather-now-hero weather-now-hero-${weatherMood}`}>
      <div className="weather-now-overlay" />
      <div className="container weather-now-hero-inner">
        <div className="weather-now-copy-card">
          <span className="weather-now-kicker">WeatherCast</span>
          <h1>Weather Portal</h1>
          <p>
            Search any city to view live weather, forecast details, and a quick weather summary.
          </p>

          <div className="weather-now-chip-row">
            <a className="weather-now-chip weather-now-chip-primary" href="#prediction">
              Open Weather Portal
            </a>
            <span className="weather-now-chip">{moodLabel}</span>
            <span className="weather-now-chip">
              {latestPredictionData?.targetDate || "7-day outlook"}
            </span>
          </div>
        </div>

        <div className="weather-now-info-grid">
          <div className="weather-now-highlight-card">
            <span>Current city</span>
            <strong>{city}</strong>
            <p>{selectedModel ? selectedModel.model : "Search a city to load forecast details"}</p>
          </div>

          <div className="weather-now-highlight-card weather-now-highlight-temp">
            <span>Temperature</span>
            <strong>{currentTemp !== undefined ? `${currentTemp.toFixed(1)}°C` : "--"}</strong>
            <p>
              {forecastLow !== null && forecastHigh !== null
                ? `${forecastLow.toFixed(1)}°C to ${forecastHigh.toFixed(1)}°C`
                : "Awaiting forecast range"}
            </p>
          </div>

          {statItems.map((item) => (
            <div className="weather-now-stat-box" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HomeSection;
