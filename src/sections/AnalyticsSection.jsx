function AnalyticsSection({ latestPredictionData }) {
  const selectedModel = latestPredictionData?.selectedModel;
  const prediction = latestPredictionData?.prediction;

  if (!selectedModel || !prediction) {
    return (
      <section id="analytics" className="mb-5">
        <div className="immersive-section-card dashboard-panel dashboard-panel-compact">
          <div className="section-heading-wrap">
            <div>
              <span className="section-kicker">Analytics</span>
              <h3>Prediction Intelligence</h3>
            </div>
          </div>
          <p className="mb-0 text-muted">
            Generate a prediction to see live model insights, alert levels, and forecast analytics.
          </p>
        </div>
      </section>
    );
  }

  const alerts = prediction.alerts || [];
  const futureTemps = selectedModel.future || [];
  const tempSpread = futureTemps.length
    ? Math.max(...futureTemps) - Math.min(...futureTemps)
    : 0;

  const analyticsItems = [
    {
      label: "Best Model",
      value: selectedModel.model,
      note: `R2 score ${selectedModel.r2_score ?? "-"}`,
    },
    {
      label: "Alert Count",
      value: String(alerts.length),
      note: alerts.length ? alerts[0].title : "No active forecast alerts",
    },
    {
      label: "Temperature Spread",
      value: `${tempSpread.toFixed(1)} C`,
      note: `Peak ${selectedModel.highest_temp_next_month?.toFixed(1) ?? "-"} C`,
    },
  ];

  return (
    <section id="analytics" className="mb-5">
      <div className="immersive-section-card dashboard-panel dashboard-panel-compact">
        <div className="section-heading-wrap">
          <div>
            <span className="section-kicker">Analytics</span>
            <h3>Prediction Intelligence</h3>
          </div>
          <span className="section-caption">{latestPredictionData.targetDate}</span>
        </div>

        <div className="analytics-chip-grid">
          {analyticsItems.map((item) => (
            <div className="analytics-chip-card" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default AnalyticsSection;
