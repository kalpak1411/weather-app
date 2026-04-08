function ForecastSection({ latestPredictionData }) {
  const selectedModel = latestPredictionData?.selectedModel;
  const weather = latestPredictionData?.weather;

  if (!selectedModel || !weather) {
    return (
      <section id="forecast" className="mb-5">
        <div className="immersive-section-card dashboard-panel dashboard-panel-compact">
          <div className="section-heading-wrap">
            <div>
              <span className="section-kicker">Forecast</span>
              <h3>Weekly Forecast Snapshot</h3>
            </div>
          </div>
          <p className="mb-0 text-muted">
            Generate a prediction to see a live weekly forecast summary for the selected city.
          </p>
        </div>
      </section>
    );
  }

  const futureTemps = selectedModel.future || [];
  const futureDates = selectedModel.future_dates || [];
  const nextDays = futureTemps.slice(0, 3).map((temp, index) => ({
    title: index === 0 ? "Tomorrow" : `Day ${index + 2}`,
    value: `${temp.toFixed(1)} C`,
    note: futureDates[index] || "Upcoming date",
  }));

  const avgHumidity = weather.humidity?.length
    ? weather.humidity.reduce((sum, value) => sum + value, 0) / weather.humidity.length
    : 0;
  const maxWind = weather.wind?.length ? Math.max(...weather.wind) : 0;
  const totalRain = weather.precipitation?.length
    ? weather.precipitation.reduce((sum, value) => sum + value, 0)
    : 0;

  const forecastCards = [
    nextDays[0] || { title: "Tomorrow", value: "-", note: "No data" },
    {
      title: "Rainfall",
      value: `${totalRain.toFixed(1)} mm`,
      note: "Recent 7-day precipitation",
    },
    {
      title: "Humidity / Wind",
      value: `${avgHumidity.toFixed(0)}% / ${maxWind.toFixed(1)} km/h`,
      note: "Latest city conditions",
    },
  ];

  return (
    <section id="forecast" className="mb-5">
      <div className="immersive-section-card dashboard-panel dashboard-panel-compact">
        <div className="section-heading-wrap">
          <div>
            <span className="section-kicker">Forecast</span>
            <h3>Weekly Forecast Snapshot</h3>
          </div>
          <span className="section-caption">{latestPredictionData.city}</span>
        </div>

        <div className="forecast-snapshot-grid">
          {forecastCards.map((item) => (
            <div className="forecast-snapshot-card" key={item.title}>
              <span>{item.title}</span>
              <strong>{item.value}</strong>
              <p>{item.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ForecastSection;
