function ModelsSection() {
  const models = [
    "Linear Regression",
    "Polynomial Regression",
    "SARIMA",
    "Random Forest",
    "Gradient Boosting",
    "Extra Trees",
    "AdaBoost",
    "XGBoost",
  ];

  return (
    <section id="models" className="mb-5">
      <div className="card p-4 shadow-lg border-0 rounded-4 dashboard-panel">
        <h3 className="mb-3">Models</h3>
        <p className="mb-3">
          The system compares multiple forecasting models and automatically
          selects the strongest result using performance scoring.
        </p>

        <div className="row g-3">
          {models.map((model) => (
            <div className="col-md-4 col-sm-6" key={model}>
              <div className="prediction-model-chip">{model}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ModelsSection;
