import { useEffect, useState } from "react";
import Home from "./pages/Home";
import Navbar from "./components/Navbar";
import "./App.css";

function App() {
  const [weatherMood, setWeatherMood] = useState("clear");
  const [latestPredictionData, setLatestPredictionData] = useState(null);
  const [themeMode, setThemeMode] = useState(
    () => localStorage.getItem("weather-theme-mode") || "light"
  );

  useEffect(() => {
    localStorage.setItem("weather-theme-mode", themeMode);
    document.body.style.background = themeMode === "dark" ? "#0b1220" : "#efe6d7";
    document.documentElement.setAttribute("data-theme", themeMode);
  }, [themeMode]);

  return (
    <div className={`app-shell mood-${weatherMood} theme-${themeMode}`}>
      <div className="weather-canvas" aria-hidden="true">
        <div className="sky-glow" />
        <div className="warm-glow" />
        <div className="cloud cloud-one" />
        <div className="cloud cloud-two" />
        <div className="cloud cloud-three" />
        <div className="sun-halo" />
        <div className="rain-layer rain-fast" />
        <div className="rain-layer rain-slow" />
        <div className="snow-layer snow-slow" />
        <div className="snow-layer snow-fast" />
      </div>

      <div className="app-content">
        <Navbar
          themeMode={themeMode}
          onToggleTheme={() =>
            setThemeMode((currentMode) => (currentMode === "dark" ? "light" : "dark"))
          }
        />
        <Home
          latestPredictionData={latestPredictionData}
          onPredictionDataChange={setLatestPredictionData}
          onWeatherMoodChange={setWeatherMood}
          weatherMood={weatherMood}
          themeMode={themeMode}
        />
      </div>
    </div>
  );
}

export default App;
