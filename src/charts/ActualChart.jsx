import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

function ActualChart({ data = [], labels = [], highlightedDate = "" }) {
  const ref = useRef(null);
  const chart = useRef(null);

  useEffect(() => {
    if (chart.current) chart.current.destroy();
    const themeMode = document.documentElement.getAttribute("data-theme") || "light";
    const tickColor = themeMode === "dark" ? "#9fb0c6" : "#5e728c";
    const gridColor =
      themeMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(70, 98, 132, 0.12)";
    const lineColor = themeMode === "dark" ? "#7dd3fc" : "#2f6eb7";

    const parsedLabels =
      labels.length === data.length
        ? labels.map((label) => new Date(label))
        : data.map((_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (data.length - i - 1));
            return date;
          });
    const chartLabels = parsedLabels.map((label) =>
      label.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      })
    );
    const selectedDateLabel = highlightedDate
      ? new Date(highlightedDate).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
        })
      : "";
    const pointRadius = chartLabels.map((label) => (label === selectedDateLabel ? 5 : 0));
    const pointHoverRadius = chartLabels.map((label) => (label === selectedDateLabel ? 7 : 4));
    const pointBackgroundColor = chartLabels.map((label) =>
      label === selectedDateLabel ? (themeMode === "dark" ? "#facc15" : "#d97706") : lineColor
    );

    chart.current = new Chart(ref.current, {
      type: "line",
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: "Actual",
            data,
            borderColor: lineColor,
            backgroundColor: lineColor,
            tension: 0.4,
            pointRadius,
            pointHoverRadius,
            pointBackgroundColor,
            pointBorderWidth: 0,
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
              label: (context) => `Actual: ${context.parsed.y?.toFixed(1)} C`,
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

export default ActualChart;
