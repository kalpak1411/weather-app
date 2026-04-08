import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

function PredictedChart({ data = [], labels = [], highlightedDate = "" }) {
  const ref = useRef(null);
  const chart = useRef(null);

  useEffect(() => {
    if (chart.current) chart.current.destroy();
    const themeMode = document.documentElement.getAttribute("data-theme") || "light";
    const tickColor = themeMode === "dark" ? "#9fb0c6" : "#5e728c";
    const gridColor =
      themeMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(70, 98, 132, 0.12)";
    const lineColor = themeMode === "dark" ? "#a78bfa" : "#6658dd";

    const chartLabels =
      labels.length === data.length
        ? labels.map((label) =>
            new Date(label).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
            })
          )
        : data.map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() + i + 1);
            return d.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
            });
          });
    const selectedDateLabel = highlightedDate
      ? new Date(highlightedDate).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
        })
      : "";
    const pointRadius = chartLabels.map((label) => (label === selectedDateLabel ? 6 : 0));
    const pointHoverRadius = chartLabels.map((label) => (label === selectedDateLabel ? 8 : 4));
    const pointBackgroundColor = chartLabels.map((label) =>
      label === selectedDateLabel ? (themeMode === "dark" ? "#facc15" : "#d97706") : lineColor
    );
    const pointBorderColor = chartLabels.map((label) =>
      label === selectedDateLabel ? (themeMode === "dark" ? "#fef3c7" : "#fff7ed") : lineColor
    );

    chart.current = new Chart(ref.current, {
      type: "line",
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: "Predicted",
            data,
            borderColor: lineColor,
            backgroundColor: lineColor,
            borderDash: [5, 5],
            tension: 0.4,
            pointRadius,
            pointHoverRadius,
            pointBackgroundColor,
            pointBorderColor,
            pointBorderWidth: 2,
            borderWidth: 3,
            fill: false,
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
              label: (context) => `Predicted: ${context.parsed.y?.toFixed(1)} C`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: tickColor },
            grid: { color: gridColor },
          },
          y: {
            ticks: { color: tickColor },
            grid: { color: gridColor },
          },
        },
      },
    });
  }, [data, highlightedDate, labels]);

  return <canvas ref={ref}></canvas>;
}

export default PredictedChart;
