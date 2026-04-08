import HomeSection from "../sections/HomeSection";
import Prediction from "../components/Prediction";
import ForecastSection from "../sections/ForecastSection";
import AnalyticsSection from "../sections/AnalyticsSection";
import ModelsSection from "../sections/ModelsSelection";

function Home({
  latestPredictionData,
  onPredictionDataChange,
  onWeatherMoodChange,
  weatherMood,
  themeMode,
}) {
  return (
    <div className="app-page weather-now-page">
      <HomeSection
        weatherMood={weatherMood}
        latestPredictionData={latestPredictionData}
        themeMode={themeMode}
      />

      <main className="container weather-now-content">
        <section id="prediction" className="mb-5">
          <Prediction
            onPredictionDataChange={onPredictionDataChange}
            onWeatherMoodChange={onWeatherMoodChange}
          />
        </section>

        <div className="weather-now-grid">
          <ForecastSection latestPredictionData={latestPredictionData} />
          <AnalyticsSection latestPredictionData={latestPredictionData} />
        </div>

        <ModelsSection />
      </main>
    </div>
  );
}

export default Home;
