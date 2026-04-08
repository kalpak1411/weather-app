import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

function WeatherMetricsChart({
  labels = [],
  temperatures = [],
  humidity = [],
  precipitation = [],
  visibleSeries = {},
  highlightedDate = "",
}) {
  const ref = useRef(null);
  const chart = useRef(null);

  useEffect(() => {
    if (chart.current) {
      chart.current.destroy();
    }

    const themeMode = document.documentElement.getAttribute("data-theme") || "light";
    const tickColor = themeMode === "dark" ? "#9fb0c6" : "#5e728c";
    const gridColor =
      themeMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(70, 98, 132, 0.12)";

    const chartLabels =
      labels.length === temperatures.length
        ? labels.map((label) =>
            new Date(label).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
            })
          )
        : temperatures.map((_, index) => `Day ${index + 1}`);
    const selectedDateLabel = highlightedDate
      ? new Date(highlightedDate).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
        })
      : "";
    const highlightRadius = chartLabels.map((label) => (label === selectedDateLabel ? 5 : 0));
    const highlightHoverRadius = chartLabels.map((label) => (label === selectedDateLabel ? 7 : 4));

    chart.current = new Chart(ref.current, {
      type: "line",
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: "Temperature",
            data: temperatures,
            borderColor: themeMode === "dark" ? "#7dd3fc" : "#2f6eb7",
            backgroundColor: themeMode === "dark" ? "#7dd3fc" : "#2f6eb7",
            pointRadius: highlightRadius,
            pointHoverRadius: highlightHoverRadius,
            borderWidth: 3,
            tension: 0.35,
            yAxisID: "y",
            hidden: visibleSeries.temperature === false,
          },
          {
            label: "Humidity",
            data: humidity,
            borderColor: themeMode === "dark" ? "#a78bfa" : "#6956d9",
            backgroundColor: themeMode === "dark" ? "#a78bfa" : "#6956d9",
            pointRadius: highlightRadius,
            pointHoverRadius: highlightHoverRadius,
            borderWidth: 2,
            tension: 0.35,
            borderDash: [6, 4],
            yAxisID: "y1",
            hidden: visibleSeries.humidity === false,
          },
          {
            label: "Rain",
            data: precipitation,
            borderColor: themeMode === "dark" ? "#38bdf8" : "#0ea5e9",
            backgroundColor: themeMode === "dark" ? "#38bdf8" : "#0ea5e9",
            pointRadius: highlightRadius,
            pointHoverRadius: highlightHoverRadius,
            borderWidth: 2,
            tension: 0.3,
            borderDash: [2, 5],
            yAxisID: "y2",
            hidden: visibleSeries.rain === false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            labels: {
              color: tickColor,
            },
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed.y;
                if (context.dataset.label === "Temperature") {
                  return `Temperature: ${value?.toFixed(1)} C`;
                }
                if (context.dataset.label === "Humidity") {
                  return `Humidity: ${value?.toFixed(0)}%`;
                }
                return `Rain: ${value?.toFixed(1)} mm`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: tickColor },
            grid: { color: gridColor },
          },
          y: {
            ticks: {
              color: tickColor,
              callback: (value) => `${value}°`,
            },
            grid: { color: gridColor },
          },
          y1: {
            position: "right",
            ticks: {
              color: tickColor,
              callback: (value) => `${value}%`,
            },
            grid: {
              drawOnChartArea: false,
            },
          },
          y2: {
            position: "right",
            display: visibleSeries.rain !== false,
            offset: true,
            ticks: {
              color: tickColor,
              callback: (value) => `${value} mm`,
            },
            grid: {
              drawOnChartArea: false,
            },
          },
        },
      },
    });
  }, [highlightedDate, humidity, labels, precipitation, temperatures, visibleSeries]);

  return <canvas ref={ref}></canvas>;
}

export default WeatherMetricsChart;
