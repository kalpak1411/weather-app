import { useEffect, useMemo, useState } from "react";
import ActualChart from "../charts/ActualChart";
import ModelComparisonChart from "../charts/ModelComparisonChart";
import PredictedChart from "../charts/PredictedChart";
import WeatherMetricsChart from "../charts/WeatherMetricsChart";
import { apiBaseUrl, fetchPrediction, fetchWeather } from "../services/api";

const loadingMessages = [
  "Checking local city data file",
  "Downloading latest city data if a file is not available",
  "Preparing recent weather history",
  "Comparing forecast models for your city",
  "Checking temperature patterns and alerts",
  "Generating summary brief for the selected outlook",
  "Preparing the best prediction for you",
];

const alertVisuals = {
  "Heatwave Warning": { icon: "High Temp", tone: "heat" },
  "Hot Weather Alert": { icon: "High Temp", tone: "heat" },
  "Cold Wave Alert": { icon: "Cold", tone: "cold" },
  "Heavy Rain Alert": { icon: "Rain", tone: "rain" },
  "Rain Watch": { icon: "Rain", tone: "rain" },
  "Snowfall Alert": { icon: "Snow", tone: "cold" },
  "Strong Wind Warning": { icon: "Wind", tone: "wind" },
  "Wind Advisory": { icon: "Wind", tone: "wind" },
  "Storm Risk": { icon: "Storm", tone: "storm" },
};

const moodIcons = {
  clear: "☀",
  cloudy: "☁",
  rainy: "☂",
  stormy: "⚡",
  snowy: "❄",
  warm: "☀",
};

function Prediction({ onPredictionDataChange, onWeatherMoodChange }) {
  const [city, setCity] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsAlertsEnabled, setSmsAlertsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [weatherData, setWeatherData] = useState(null);
  const [result, setResult] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [currentMood, setCurrentMood] = useState("clear");
  const [showAllModels, setShowAllModels] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [typedLoadingMessage, setTypedLoadingMessage] = useState("");
  const [typedSummaryText, setTypedSummaryText] = useState("");
  const [metricSeries, setMetricSeries] = useState({
    temperature: true,
    humidity: true,
    rain: true,
  });

  const inferWeatherMood = (incomingWeatherData) => {
    const humidityValues = incomingWeatherData.humidity || [];
    const windValues = incomingWeatherData.wind || [];
    const tempValues = incomingWeatherData.temps || [];
    const precipitationValues = incomingWeatherData.precipitation || [];
    const snowfallValues = incomingWeatherData.snowfall || [];

    const averageHumidity =
      humidityValues.reduce((sum, value) => sum + value, 0) / (humidityValues.length || 1);
    const maxWind = windValues.length ? Math.max(...windValues) : 0;
    const averageTemp =
      tempValues.reduce((sum, value) => sum + value, 0) / (tempValues.length || 1);
    const totalPrecipitation = precipitationValues.reduce((sum, value) => sum + value, 0);
    const totalSnowfall = snowfallValues.reduce((sum, value) => sum + value, 0);

    if (totalSnowfall > 1 || averageTemp <= 3) {
      return "snowy";
    }

    if ((totalPrecipitation > 18 || averageHumidity >= 82) && maxWind >= 18) {
      return "stormy";
    }

    if (totalPrecipitation > 4 || averageHumidity >= 72) {
      return "rainy";
    }

    if (averageTemp >= 33) {
      return "warm";
    }

    if (averageHumidity >= 58 || averageTemp <= 18) {
      return "cloudy";
    }

    return "clear";
  };

  useEffect(() => {
    if (!loading) {
      setLoadingMessageIndex(0);
      setTypedLoadingMessage("");
      return undefined;
    }

    const rotationTimer = window.setInterval(() => {
      setLoadingMessageIndex((currentIndex) => (currentIndex + 1) % loadingMessages.length);
    }, 1600);

    return () => window.clearInterval(rotationTimer);
  }, [loading]);

  useEffect(() => {
    if (!loading) {
      return undefined;
    }

    const activeMessage = loadingMessages[loadingMessageIndex];
    setTypedLoadingMessage("");
    let characterIndex = 0;

    const typingTimer = window.setInterval(() => {
      characterIndex += 1;
      setTypedLoadingMessage(activeMessage.slice(0, characterIndex));

      if (characterIndex >= activeMessage.length) {
        window.clearInterval(typingTimer);
      }
    }, 34);

    return () => window.clearInterval(typingTimer);
  }, [loading, loadingMessageIndex]);

  const resolveFutureDate = () => {
    if (!targetDate) {
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);
      return nextMonth.toISOString().split("T")[0];
    }

    const selected = new Date(targetDate);
    if (selected <= new Date()) {
      throw new Error("Select a future date");
    }

    return targetDate;
  };

  const formatDay = (value) =>
    new Date(value).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });

  const formatLongDate = (value) =>
    new Date(value).toLocaleDateString("en-IN", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  const toggleMetricSeries = (metricKey) => {
    setMetricSeries((current) => {
      const activeCount = Object.values(current).filter(Boolean).length;
      if (current[metricKey] && activeCount === 1) {
        return current;
      }

      return {
        ...current,
        [metricKey]: !current[metricKey],
      };
    });
  };

  const handlePredict = async () => {
    if (!city.trim()) {
      alert("Enter city");
      return;
    }

    try {
      setLoading(true);
      setStatusMessage("");
      const requestStartedAt = Date.now();
      console.log("[WeatherPortal] Checking local data and saved model cache...", {
        city: city.trim(),
      });

      const finalDate = resolveFutureDate();
      let weatherResponse = null;

      try {
        weatherResponse = await fetchWeather(city.trim());
        console.log("[WeatherPortal] Weather source", weatherResponse.data?.data_meta || {});
        const mood = inferWeatherMood(weatherResponse.data);
        onWeatherMoodChange(mood);
        setCurrentMood(mood);
      } catch (weatherError) {
        if (weatherError.response?.status === 404) {
          throw new Error(
            "City not found in the local dataset or weather service. Try another city name."
          );
        }
        throw weatherError;
      }

      const response = await fetchPrediction(city.trim(), finalDate, {
        phoneNumber,
        smsAlertsEnabled,
      });
      console.log("[WeatherPortal] Prediction source", {
        dataMeta: response.data?.data_meta || {},
        cacheMeta: response.data?.cache_meta || {},
        linearModelCache:
          response.data?.all_models?.find((item) => item.model === "Linear Regression")
            ?.model_cache || null,
      });

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      if (!response.data?.best_model) {
        throw new Error("Prediction could not be generated for this city.");
      }

      setWeatherData(weatherResponse?.data || null);
      setResult(response.data);
      setSelectedModel(response.data.best_model);
      onPredictionDataChange?.({
        city: city.trim(),
        targetDate: finalDate,
        weather: weatherResponse?.data || null,
        prediction: response.data,
        selectedModel: response.data.best_model,
      });

      if (response.data.sms_status?.enabled) {
        setStatusMessage(
          response.data.sms_status.sent
            ? `Prediction generated and SMS alert sent to ${response.data.sms_status.phone_number}.`
            : response.data.sms_status.reason || "Prediction generated, but SMS could not be sent."
        );
      } else if (response.data?.data_meta?.data_status === "downloaded_new_city_file") {
        setStatusMessage(
          `Downloaded latest city data for ${city.trim()} and generated the prediction successfully.`
        );
      } else if (response.data?.data_meta?.data_status === "refreshed_local_city_file") {
        setStatusMessage(
          `Refreshed the local city file for ${city.trim()} and generated the prediction successfully.`
        );
      } else {
        setStatusMessage(`Prediction generated successfully for ${city.trim()}.`);
      }

      const elapsed = Date.now() - requestStartedAt;
      const minimumLoadingTime = 10000;
      if (elapsed < minimumLoadingTime) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, minimumLoadingTime - elapsed)
        );
      }
    } catch (error) {
      console.error(error);
      if (!error.response) {
        alert(
          `Network error. The phone could not reach the backend at ${apiBaseUrl}. Make sure Django is running on 0.0.0.0:8000 and Windows Firewall allows it.`
        );
      } else {
        alert(error.response?.data?.error || error.message || "Error fetching prediction");
      }
    } finally {
      setLoading(false);
    }
  };

  const portalCity = city.trim() || "Search a city";
  const currentTemp = weatherData?.temps?.length
    ? weatherData.temps[weatherData.temps.length - 1]
    : null;
  const currentHumidity = weatherData?.humidity?.length
    ? weatherData.humidity[weatherData.humidity.length - 1]
    : null;
  const currentWind = weatherData?.wind?.length
    ? weatherData.wind[weatherData.wind.length - 1]
    : null;
  const currentRain = weatherData?.precipitation?.length
    ? weatherData.precipitation.reduce((sum, value) => sum + value, 0)
    : null;

  const recentWeatherRows = useMemo(() => {
    if (!weatherData?.labels?.length) {
      return [];
    }

    return weatherData.labels.map((label, index) => ({
      label: formatDay(label),
      temp: weatherData.temps?.[index],
      humidity: weatherData.humidity?.[index],
      precipitation: weatherData.precipitation?.[index] ?? 0,
    }));
  }, [weatherData]);

  const forecastRows = useMemo(() => {
    if (!selectedModel?.future?.length) {
      return [];
    }

    const low = Math.min(...selectedModel.future);
    const high = selectedModel.highest_temp_next_month ?? Math.max(...selectedModel.future);

    return selectedModel.future.slice(0, 7).map((temp, index) => ({
      label: selectedModel.future_dates?.[index]
        ? formatDay(selectedModel.future_dates[index])
        : `Day ${index + 1}`,
      temp,
      range: `${low.toFixed(1)}° / ${high.toFixed(1)}°`,
    }));
  }, [selectedModel]);

  const adaptiveAlerts = useMemo(() => {
    const sourceAlerts = [...(result?.alerts || [])];

    if (!sourceAlerts.length && currentTemp != null && currentTemp >= 35) {
      sourceAlerts.push({
        level: "medium",
        title: "Hot Weather Alert",
        message: `${portalCity} is already running warm near ${currentTemp.toFixed(1)} C.`,
      });
    }

    if (!sourceAlerts.length && currentRain != null && currentRain >= 8) {
      sourceAlerts.push({
        level: "medium",
        title: "Rain Watch",
        message: `${portalCity} has elevated rainfall in the latest weather window.`,
      });
    }

    if (!sourceAlerts.length && currentWind != null && currentWind >= 22) {
      sourceAlerts.push({
        level: "medium",
        title: "Wind Advisory",
        message: `${portalCity} is seeing breezy conditions near ${currentWind.toFixed(1)} km/h.`,
      });
    }

    return sourceAlerts.map((alert) => ({
      ...alert,
      ...(alertVisuals[alert.title] || { icon: "Alert", tone: "default" }),
    }));
  }, [currentRain, currentTemp, currentWind, portalCity, result]);

  const rankedModels = useMemo(() => {
    const allModels = result?.all_models || [];
    return [...allModels]
      .filter((item) => typeof item.r2_score === "number")
      .sort((first, second) => second.r2_score - first.r2_score)
      .slice(0, 6);
  }, [result]);

  const forecastInsights = useMemo(() => {
    if (!selectedModel?.future?.length) {
      return [];
    }

    const futureValues = selectedModel.future;
    const firstValue = futureValues[0];
    const lastValue = futureValues[futureValues.length - 1];
    const peakValue = Math.max(...futureValues);
    const lowValue = Math.min(...futureValues);
    const averageValue =
      futureValues.reduce((sum, value) => sum + value, 0) / futureValues.length;
    const highAlertCount = adaptiveAlerts.filter((item) => item.level === "high").length;

    let trendLabel = "Stable";
    if (lastValue - firstValue >= 2) {
      trendLabel = "Warming";
    } else if (firstValue - lastValue >= 2) {
      trendLabel = "Cooling";
    }

    let planningNote = "Comfortable conditions overall.";
    let planningTone = "normal";
    if (highAlertCount > 0) {
      planningNote = "High-priority alerts are active. Plan carefully before outdoor travel.";
      planningTone = "danger";
    } else if (peakValue >= 35) {
      planningNote = "Hot afternoons are likely. Keep hydration and shade in mind.";
      planningTone = "warning";
    } else if (lowValue <= 10) {
      planningNote = "Cool conditions are likely. Light layering may help.";
      planningTone = "calm";
    }

    return [
      {
        label: "Trend",
        value: trendLabel,
        helper: `From ${firstValue.toFixed(1)} C to ${lastValue.toFixed(1)} C`,
      },
      {
        label: "Temperature Range",
        value: `${lowValue.toFixed(1)} C - ${peakValue.toFixed(1)} C`,
        helper: "Expected spread in the forecast window",
      },
      {
        label: "Average Outlook",
        value: `${averageValue.toFixed(1)} C`,
        helper: "Mean predicted temperature",
      },
      {
        label: "Planning Note",
        value: planningNote,
        helper: `${highAlertCount} high-priority alert${highAlertCount === 1 ? "" : "s"} detected`,
        tone: planningTone,
      },
    ];
  }, [adaptiveAlerts, selectedModel]);

  const exactDayRecommendation = useMemo(() => {
    if (!selectedModel?.future?.length || !targetDate) {
      return null;
    }

    const futureDates = selectedModel.future_dates || [];
    const targetIndex = futureDates.indexOf(targetDate);
    if (targetIndex < 0) {
      return null;
    }

    const targetTemp = selectedModel.future[targetIndex];
    const hasHeatRisk = adaptiveAlerts.some((item) => item.tone === "heat");
    const hasRainRisk = adaptiveAlerts.some((item) => item.tone === "rain");
    const hasWindRisk = adaptiveAlerts.some((item) => item.tone === "wind");

    let headline = "Balanced weather outlook";
    let recommendation = "This day looks reasonable for regular plans.";
    let tone = "calm";
    let outdoorAdvice = "Outdoor plans look manageable for most of the day.";
    let travelAdvice = "Normal travel conditions are likely.";
    let packingAdvice = "Regular daily essentials should be enough.";
    let comfortAdvice = "Comfort should remain fairly steady if the forecast holds.";
    const modelScore = typeof selectedModel.r2_score === "number" ? selectedModel.r2_score : null;
    const freshnessStatus = weatherData?.data_meta?.data_status || result?.data_meta?.data_status || "";

    let confidenceLabel = "Medium confidence";
    let confidenceTone = "medium";

    if (modelScore != null && modelScore >= 0.85 && freshnessStatus !== "used_local_city_file_fallback") {
      confidenceLabel = "High confidence";
      confidenceTone = "high";
    } else if (modelScore != null && modelScore < 0.65) {
      confidenceLabel = "Watchful confidence";
      confidenceTone = "watch";
    } else if (freshnessStatus === "used_local_city_file_fallback") {
      confidenceLabel = "Cached confidence";
      confidenceTone = "watch";
    } else if (freshnessStatus === "downloaded_new_city_file" || freshnessStatus === "refreshed_local_city_file") {
      confidenceLabel = "Fresh data confidence";
      confidenceTone = "high";
    }

    if (hasHeatRisk || targetTemp >= 35) {
      headline = "Warm day planning suggested";
      recommendation = "Prefer early morning or evening activity and keep hydration nearby.";
      tone = "heat";
      outdoorAdvice = "Keep outdoor tasks shorter in the afternoon and use shade where possible.";
      travelAdvice = "Travel earlier in the day if you want to avoid peak warmth.";
      packingAdvice = "Carry water, sunglasses, and light breathable clothing.";
      comfortAdvice = "Heat stress could build during the warmest part of the day.";
    } else if (hasRainRisk || currentRain > 4) {
      headline = "Wet-weather planning suggested";
      recommendation = "Carry rain protection and allow extra travel time for outdoor plans.";
      tone = "rain";
      outdoorAdvice = "Flexible indoor backup plans would be useful for this date.";
      travelAdvice = "Road conditions may feel slower if showers return around travel hours.";
      packingAdvice = "Carry an umbrella or light rain jacket.";
      comfortAdvice = "Expect damp conditions rather than severe disruption.";
    } else if (hasWindRisk || currentWind >= 22) {
      headline = "Breezy day planning suggested";
      recommendation = "Expect gusty conditions and secure light items if you are outside.";
      tone = "wind";
      outdoorAdvice = "Outdoor seating, light gear, or signage may need extra attention.";
      travelAdvice = "Travel should stay workable, but open areas may feel gusty.";
      packingAdvice = "A light layer can help if winds make the air feel cooler.";
      comfortAdvice = "The day may feel breezier than the temperature alone suggests.";
    } else if (targetTemp <= 12) {
      headline = "Cool day planning suggested";
      recommendation = "A light layer may help if you will be outside for longer periods.";
      tone = "cold";
      outdoorAdvice = "Outdoor plans still look fine, but cooler periods may feel sharper later.";
      travelAdvice = "Travel conditions appear stable with only mild cool-weather impact.";
      packingAdvice = "Keep a light jacket or extra layer ready.";
      comfortAdvice = "Comfort will improve if you dress in layers.";
    }

    return {
      dateLabel: formatLongDate(targetDate),
      temperature: `${targetTemp.toFixed(1)} C`,
      headline,
      recommendation,
      tone,
      confidence: {
        label: confidenceLabel,
        tone: confidenceTone,
      },
      insights: [
        { label: "Outdoor", value: outdoorAdvice },
        { label: "Travel", value: travelAdvice },
        { label: "Carry", value: packingAdvice },
        { label: "Comfort", value: comfortAdvice },
      ],
    };
  }, [adaptiveAlerts, currentRain, currentWind, result?.data_meta?.data_status, selectedModel, targetDate, weatherData?.data_meta?.data_status]);

  const riskSignals = useMemo(() => {
    if (!selectedModel?.future?.length) {
      return [];
    }

    const signals = [];
    const peakTemp = Math.max(...selectedModel.future);
    const lowTemp = Math.min(...selectedModel.future);

      if (peakTemp >= 35) {
        signals.push({
          title: "High temperature",
          detail: `Forecast highs may reach ${peakTemp.toFixed(1)} C.`,
          tone: "heat",
          insight: `AI insight: heat pressure may build through the forecast window, so lighter daytime plans and hydration-friendly timing would be safer.`,
        });
      }

      if (currentRain != null && currentRain > 4) {
        signals.push({
          title: "Rain expected",
          detail: `Recent rain total is ${currentRain.toFixed(1)} mm.`,
          tone: "rain",
          insight: `AI insight: rainfall trends suggest a wetter pattern, so commute buffers and rain protection would be useful if this pattern holds.`,
        });
      }

      if (currentWind != null && currentWind >= 22) {
        signals.push({
          title: "Strong wind",
          detail: `Wind levels are near ${currentWind.toFixed(1)} km/h.`,
          tone: "wind",
          insight: `AI insight: breezy conditions could make exposed areas feel rougher than the temperature suggests, especially during travel or outdoor activity.`,
        });
      }

      if (lowTemp <= 12) {
        signals.push({
          title: "Cool conditions",
          detail: `Lows may dip to ${lowTemp.toFixed(1)} C.`,
          tone: "cold",
          insight: `AI insight: cooler lows may shift comfort later in the day, so a light extra layer would help keep conditions comfortable.`,
        });
      }

    return signals.slice(0, 4);
  }, [currentRain, currentWind, selectedModel]);

  const weeklyHighlights = useMemo(() => {
    if (!selectedModel?.future?.length) {
      return [];
    }

    const futureDates = selectedModel.future_dates || [];
    const futureValues = selectedModel.future || [];
    const hottestIndex = futureValues.indexOf(Math.max(...futureValues));
    const coolestIndex = futureValues.indexOf(Math.min(...futureValues));

    const recentPrecipitation = weatherData?.precipitation || [];
    const recentWind = weatherData?.wind || [];
    const recentLabels = weatherData?.labels || [];

    const wettestValue = recentPrecipitation.length ? Math.max(...recentPrecipitation) : null;
    const windiestValue = recentWind.length ? Math.max(...recentWind) : null;
    const wettestIndex =
      wettestValue != null ? recentPrecipitation.indexOf(wettestValue) : -1;
    const windiestIndex = windiestValue != null ? recentWind.indexOf(windiestValue) : -1;

    return [
      {
        label: "Hottest day",
        value:
          hottestIndex >= 0
            ? `${formatDay(futureDates[hottestIndex])} • ${futureValues[hottestIndex].toFixed(1)} C`
            : "--",
      },
      {
        label: "Coolest day",
        value:
          coolestIndex >= 0
            ? `${formatDay(futureDates[coolestIndex])} • ${futureValues[coolestIndex].toFixed(1)} C`
            : "--",
      },
      {
        label: "Wettest recent day",
        value:
          wettestIndex >= 0
            ? `${formatDay(recentLabels[wettestIndex])} • ${wettestValue.toFixed(1)} mm`
            : "--",
      },
      {
        label: "Windiest recent day",
        value:
          windiestIndex >= 0
            ? `${formatDay(recentLabels[windiestIndex])} • ${windiestValue.toFixed(1)} km/h`
            : "--",
      },
    ];
  }, [selectedModel, weatherData]);

  const forecastSummary = useMemo(() => {
    if (!selectedModel?.future?.length) {
      return null;
    }

    const futureValues = selectedModel.future;
    const futureDates = selectedModel.future_dates || [];
    const averageValue =
      futureValues.reduce((sum, value) => sum + value, 0) / futureValues.length;
    const peakValue = Math.max(...futureValues);
    const lowValue = Math.min(...futureValues);
    const strongestAlert = adaptiveAlerts[0] || null;
    const selectedDateIndex = targetDate ? futureDates.indexOf(targetDate) : -1;
    const exactDateTemp =
      selectedDateIndex >= 0 && selectedDateIndex < futureValues.length
        ? futureValues[selectedDateIndex]
        : null;
    const targetLabel =
      targetDate && selectedDateIndex >= 0
        ? formatLongDate(targetDate)
        : targetDate
          ? formatLongDate(targetDate)
          : "the upcoming forecast window";

    let overview = "";
    if (exactDateTemp != null) {
      overview = `${portalCity} is expected to be around ${exactDateTemp.toFixed(
        1
      )} C on ${targetLabel}.`;
    } else {
      overview = `${portalCity} is trending around ${averageValue.toFixed(
        1
      )} C across the upcoming outlook.`;
    }

    let conditions = "Conditions look fairly stable.";
    if (strongestAlert) {
      conditions = `${strongestAlert.title}: ${strongestAlert.message}`;
    } else if (peakValue >= 35) {
      conditions = `Warm daytime conditions are likely, with highs reaching ${peakValue.toFixed(
        1
      )} C.`;
    } else if (currentRain != null && currentRain > 0) {
      conditions = `Recent rain totals are around ${currentRain.toFixed(
        1
      )} mm, so keep an eye on wet conditions.`;
    }

    let guidance = "This looks suitable for regular outdoor plans.";
    if (strongestAlert?.tone === "heat") {
      guidance = "Plan outdoor activity earlier in the day and stay hydrated.";
    } else if (strongestAlert?.tone === "rain" || currentRain > 3) {
      guidance = "Carry rain protection and allow extra travel time.";
    } else if (strongestAlert?.tone === "wind") {
      guidance = "Expect breezy conditions and secure light outdoor items.";
    } else if (strongestAlert?.tone === "cold") {
      guidance = "Layer up if you will be outside for longer periods.";
    }

    const summaryTone =
      strongestAlert?.tone ||
      (peakValue >= 35
        ? "heat"
        : currentRain > 3
          ? "rain"
          : currentWind >= 22
            ? "wind"
            : lowValue <= 10
              ? "cold"
              : "clear");

    return {
        title:
          exactDateTemp != null
            ? `Weather summary for ${formatDay(targetDate)}`
            : "Weather summary",
      targetLabel,
      overview,
      conditions,
      guidance,
      tone: summaryTone,
      details: [
        { label: "Predicted temperature", value: exactDateTemp != null ? `${exactDateTemp.toFixed(1)} C` : `${averageValue.toFixed(1)} C avg` },
        { label: "Forecast range", value: `${lowValue.toFixed(1)} C - ${peakValue.toFixed(1)} C` },
        { label: "Humidity", value: currentHumidity != null ? `${currentHumidity.toFixed(0)}%` : "--" },
        { label: "Wind", value: currentWind != null ? `${currentWind.toFixed(1)} km/h` : "--" },
        { label: "Rain total", value: currentRain != null ? `${currentRain.toFixed(1)} mm` : "--" },
        { label: "Best model", value: selectedModel.model },
      ],
    };
  }, [
    adaptiveAlerts,
    currentHumidity,
    currentRain,
    currentWind,
    portalCity,
    selectedModel,
    targetDate,
  ]);

  useEffect(() => {
    if (!forecastSummary) {
      setTypedSummaryText("");
      return undefined;
    }

    const fullSummaryText = [
      forecastSummary.overview,
      forecastSummary.conditions,
      forecastSummary.guidance,
    ].join(" ");

    setTypedSummaryText("");
    let characterIndex = 0;

    const summaryTimer = window.setInterval(() => {
      characterIndex += 1;
      setTypedSummaryText(fullSummaryText.slice(0, characterIndex));

      if (characterIndex >= fullSummaryText.length) {
        window.clearInterval(summaryTimer);
      }
    }, 18);

    return () => window.clearInterval(summaryTimer);
  }, [forecastSummary]);

  const hasWeatherMetrics =
    Boolean(weatherData?.labels?.length) &&
    Boolean(weatherData?.temps?.length) &&
    Boolean(weatherData?.humidity?.length);
  const hasForecastData = Boolean(weatherData?.labels?.length || selectedModel?.future?.length);

  return (
    <div className="dashboard-prediction-shell">
      <div className="dashboard-section-header mb-4">
        <div>
          <span className="section-kicker">Prediction</span>
          <h2 className="fw-bold mb-1">Weather Portal</h2>
          <p className="text-muted mb-0">
            Search a city, choose a target date, and explore your weather details in one place.
          </p>
        </div>
      </div>

      <div className="portal-search-card dashboard-panel mb-4">
        <div className="portal-search-card-head">
          <div>
            <h4>Search Weather</h4>
            <p>Choose a city and target date to generate your weather view.</p>
          </div>
        </div>

        <div className="portal-search-grid portal-search-grid-wide">
          <input
            className="form-control"
            onChange={(event) => setCity(event.target.value)}
            placeholder="Search city"
            value={city}
          />
          <input
            className="form-control"
            onChange={(event) => setTargetDate(event.target.value)}
            placeholder="Target date (optional)"
            type="date"
            value={targetDate}
          />
          <div className="phone-alert-field">
            <input
              className="form-control"
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="Phone number for SMS alerts"
              value={phoneNumber}
            />
            <div className="phone-alert-row">
              <label className="form-check sms-optin-check mb-0 phone-alert-check">
                <input
                  checked={smsAlertsEnabled}
                  className="form-check-input"
                  id="smsAlertsEnabled"
                  onChange={(event) => setSmsAlertsEnabled(event.target.checked)}
                  type="checkbox"
                />
                <span className="form-check-label">Enable SMS alert</span>
              </label>
            </div>
          </div>
          <button className="btn btn-dark portal-search-button" onClick={handlePredict} type="button">
            {loading ? "Loading..." : "Search & Predict"}
          </button>
        </div>

        {statusMessage ? <div className="status-banner mt-3">{statusMessage}</div> : null}
        {loading ? (
          <div className="thinking-card mt-3">
            <div className="thinking-orb" aria-hidden="true" />
            <div>
              <span className="thinking-label">Thinking...</span>
              <p className="thinking-text mb-0">
                {typedLoadingMessage}
                <span className="thinking-cursor" aria-hidden="true">
                  |
                </span>
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {result && selectedModel ? (
        <div>
          {exactDayRecommendation ? (
            <div className={`card p-4 shadow-lg border-0 rounded-4 mb-4 dashboard-panel recommendation-card tone-${exactDayRecommendation.tone}`}>
              <div className="recommendation-head">
                <div>
                  <span className="forecast-report-kicker">Selected Date Recommendation</span>
                  <h5 className="fw-bold mb-1">{exactDayRecommendation.headline}</h5>
                  <div className="recommendation-meta">
                    <p className="text-muted mb-0">{exactDayRecommendation.dateLabel}</p>
                    <span className={`recommendation-confidence-chip tone-${exactDayRecommendation.confidence.tone}`}>
                      {exactDayRecommendation.confidence.label}
                    </span>
                  </div>
                </div>
                <div className="recommendation-temp">{exactDayRecommendation.temperature}</div>
              </div>
              <p className="recommendation-text mb-0">{exactDayRecommendation.recommendation}</p>
              <div className="recommendation-grid">
                {exactDayRecommendation.insights.map((item) => (
                  <div className="recommendation-detail" key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {forecastSummary ? (
            <div className="card p-4 shadow-lg border-0 rounded-4 mb-4 dashboard-panel forecast-report-card">
              <div className="forecast-report-head">
                <div>
                  <span className="forecast-report-kicker">Highlighted Summary</span>
                  <h5 className="fw-bold mb-1">{forecastSummary.title}</h5>
                  <p className="text-muted mb-0">{forecastSummary.targetLabel}</p>
                </div>
                <div className="forecast-report-badge">
                  {moodIcons[currentMood] || moodIcons.clear}
                </div>
              </div>

              <div className="forecast-report-body">
                <div className="forecast-report-generated">
                  <span className="forecast-report-generated-label">Key Takeaway</span>
                  <p className="forecast-report-generated-text mb-0">
                    {typedSummaryText}
                    <span className="thinking-cursor" aria-hidden="true">
                      |
                    </span>
                  </p>
                </div>
              </div>

              <div className="forecast-report-grid">
                {forecastSummary.details.map((item) => (
                  <div className="forecast-report-detail" key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {riskSignals.length ? (
            <div className="card p-4 shadow-lg border-0 rounded-4 mb-4 dashboard-panel risk-signals-card">
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h5 className="fw-bold mb-0">Risk signals</h5>
                <span className="text-muted small">Adaptive weather checks</span>
              </div>
                <div className="risk-signals-grid">
                  {riskSignals.map((signal) => (
                  <div className={`risk-signal-item tone-${signal.tone || "default"}`} key={signal.title}>
                      <strong>{signal.title}</strong>
                      <span>{signal.detail}</span>
                      <div className="risk-signal-ai-copy">
                        <small>AI insight</small>
                        <p>{signal.insight}</p>
                      </div>
                    </div>
                  ))}
                </div>
            </div>
          ) : null}

          {weeklyHighlights.length ? (
            <div className="card p-4 shadow-lg border-0 rounded-4 mb-4 dashboard-panel weekly-highlights-card">
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h5 className="fw-bold mb-0">Weekly highlights</h5>
                <span className="text-muted small">Fast overview of this weather window</span>
              </div>
              <div className="weekly-highlights-grid">
                {weeklyHighlights.map((item) => (
                  <div className="weekly-highlight-item" key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {adaptiveAlerts.length ? (
            <div className="alerts-grid mb-4">
              {adaptiveAlerts.map((alert) => (
                <div
                  className={`weather-alert-card ${alert.level === "high" ? "high" : "medium"} tone-${alert.tone}`}
                  key={`${alert.title}-${alert.message}`}
                >
                  <div className="weather-alert-icon">{alert.icon}</div>
                  <span className="weather-alert-level">
                    {alert.level === "high" ? "High Priority" : "Advisory"}
                  </span>
                  <h5>{alert.title}</h5>
                  <p>{alert.message}</p>
                </div>
              ))}
            </div>
          ) : null}

          {hasForecastData ? (
            <div className={`portal-shell portal-shell-single dashboard-panel mb-4 portal-mood-${currentMood}`}>
              <main className="portal-content">
                <section className="portal-chart-card">
                  <div className="portal-table-head">
                    <h4>Temperature & Humidity</h4>
                    <span>{portalCity} recent weather response</span>
                  </div>
                  <div className="chart-toggle-row">
                    <button
                      className={`chart-toggle-chip ${metricSeries.temperature ? "active" : ""}`}
                      onClick={() => toggleMetricSeries("temperature")}
                      type="button"
                    >
                      Temperature
                    </button>
                    <button
                      className={`chart-toggle-chip ${metricSeries.humidity ? "active" : ""}`}
                      onClick={() => toggleMetricSeries("humidity")}
                      type="button"
                    >
                      Humidity
                    </button>
                    <button
                      className={`chart-toggle-chip ${metricSeries.rain ? "active" : ""}`}
                      onClick={() => toggleMetricSeries("rain")}
                      type="button"
                    >
                      Rain
                    </button>
                  </div>
                  {hasWeatherMetrics ? (
                    <div style={{ height: 260 }}>
                      <WeatherMetricsChart
                        highlightedDate={targetDate}
                        labels={weatherData?.labels || []}
                        precipitation={weatherData?.precipitation || []}
                        temperatures={weatherData?.temps || []}
                        humidity={weatherData?.humidity || []}
                        visibleSeries={metricSeries}
                      />
                    </div>
                  ) : (
                    <div className="portal-chart-empty">
                      Run a prediction to load the live weather chart.
                    </div>
                  )}
                </section>

                <section className="portal-tables">
                  <div className="portal-table-card">
                    <div className="portal-table-head">
                      <h4>Recent Weather</h4>
                      <span>Last 7 available days</span>
                    </div>
                    <table className="portal-table">
                      <thead>
                        <tr>
                          <th>Day</th>
                          <th>Temp</th>
                          <th>Humidity</th>
                          <th>Precip</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentWeatherRows.length ? (
                          recentWeatherRows.map((item) => (
                            <tr key={item.label}>
                              <td>{item.label}</td>
                              <td>{item.temp != null ? `${item.temp.toFixed(1)}°C` : "--"}</td>
                              <td>{item.humidity != null ? `${item.humidity.toFixed(0)}%` : "--"}</td>
                              <td>{item.precipitation != null ? `${item.precipitation.toFixed(1)} mm` : "--"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4">Run a prediction to load recent city weather.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="portal-table-card">
                    <div className="portal-table-head">
                      <h4>Forecast Window</h4>
                      <span>{selectedModel ? selectedModel.model : "Best model forecast"}</span>
                    </div>
                    <table className="portal-table">
                      <thead>
                        <tr>
                          <th>Day</th>
                          <th>Temp</th>
                          <th>Range</th>
                        </tr>
                      </thead>
                      <tbody>
                        {forecastRows.length ? (
                          forecastRows.map((item) => (
                            <tr key={item.label}>
                              <td>{item.label}</td>
                              <td>{item.temp.toFixed(1)}°C</td>
                              <td>{item.range}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="3">Generate a forecast to view upcoming predicted dates.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <div className="portal-footer">
                  <span>Data source: {weatherData?.source || "Awaiting forecast"}</span>
                  <span>Rain total: {currentRain != null ? `${currentRain.toFixed(1)} mm` : "--"}</span>
                </div>
              </main>
            </div>
          ) : null}

          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold mb-0">
              Prediction till: {targetDate || "Next 30 Days"}
            </h5>

            <button
              className="btn btn-outline-dark"
              onClick={() => setShowAllModels(!showAllModels)}
              type="button"
            >
              {showAllModels ? "Best Model" : "All Models"}
            </button>
          </div>

          {!showAllModels ? (
            <div className="card p-4 shadow-lg border-0 rounded-4 mb-4 dashboard-panel">
              <h4 className="mb-3">Best Model: {selectedModel.model}</h4>

              <div className="row g-4">
                <div className="col-md-6">
                  <h6 className="text-center">Historical Trend</h6>
                  <div style={{ height: 260 }}>
                    <ActualChart
                      data={selectedModel.actual?.slice(-30)}
                      labels={selectedModel.actual_dates?.slice(-30)}
                      highlightedDate={targetDate}
                    />
                  </div>
                </div>

                <div className="col-md-6">
                  <h6 className="text-center">Predicted Trend</h6>
                  <div style={{ height: 260 }}>
                    <PredictedChart
                      data={selectedModel.future}
                      highlightedDate={targetDate}
                      labels={selectedModel.future_dates}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <p>
                  R2 Score: <strong>{selectedModel.r2_score}</strong>
                </p>
                <p>
                  MSE: <strong>{selectedModel.mse}</strong>
                </p>
                <p>
                  Peak Temp:{" "}
                  <strong>
                    {selectedModel.highest_temp_next_month != null
                      ? `${selectedModel.highest_temp_next_month.toFixed(2)} C`
                      : "N/A"}
                  </strong>
                </p>
              </div>
            </div>
          ) : (
            result.all_models?.map((model) => (
              <div className="card p-4 shadow-sm border-0 rounded-4 mb-3 dashboard-panel" key={model.model}>
                <h5 className="fw-bold">{model.model}</h5>

                <div className="row mt-3 g-4">
                  <div className="col-md-6">
                    <div style={{ height: 220 }}>
                      <ActualChart
                        data={model.actual?.slice(-30)}
                        labels={model.actual_dates?.slice(-30)}
                        highlightedDate={targetDate}
                      />
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div style={{ height: 220 }}>
                      <PredictedChart
                        data={model.future}
                        highlightedDate={targetDate}
                        labels={model.future_dates}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <p>R2: {model.r2_score}</p>
                  <p>MSE: {model.mse}</p>
                  <p>
                    Peak:{" "}
                    {model.highest_temp_next_month != null
                      ? `${model.highest_temp_next_month.toFixed(2)} C`
                      : "N/A"}
                  </p>
                </div>
              </div>
            ))
          )}

          {rankedModels.length ? (
            <div className="card p-4 shadow-lg border-0 rounded-4 mb-4 dashboard-panel">
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h5 className="fw-bold mb-0">Model Comparison</h5>
                <span className="text-muted small">Prediction accuracy by R2 score</span>
              </div>
              <div style={{ height: 280 }}>
                <ModelComparisonChart models={rankedModels} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="card p-4 shadow-lg border-0 rounded-4 mb-4 dashboard-panel">
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <h5 className="fw-bold mb-0">Forecast Insights</h5>
          <span className="text-muted small">
            {selectedModel ? `Based on ${selectedModel.model}` : "Generate a prediction to unlock insights"}
          </span>
        </div>

        {forecastInsights.length ? (
            <div className="row g-3">
              {forecastInsights.map((item) => (
                <div className="col-md-6" key={item.label}>
                  <div className={`forecast-insight-card h-100 ${item.tone ? `tone-${item.tone}` : ""}`}>
                    <span className="forecast-insight-label">{item.label}</span>
                    <h6 className="forecast-insight-value">{item.value}</h6>
                    <p className="forecast-insight-helper mb-0">{item.helper}</p>
                  </div>
                </div>
            ))}
          </div>
        ) : (
          <p className="mb-0 text-muted">
            Run a prediction for any city to see temperature range, trend direction, and a quick planning note.
          </p>
        )}
      </div>
    </div>
  );
}

export default Prediction;
