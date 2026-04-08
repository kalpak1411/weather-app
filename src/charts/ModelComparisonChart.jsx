import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

function ModelComparisonChart({ models = [] }) {
  const ref = useRef(null);
  const chart = useRef(null);

  useEffect(() => {
    if (chart.current) {
      chart.current.destroy();
    }

    if (!models.length) {
      return undefined;
    }

    const themeMode = document.documentElement.getAttribute("data-theme") || "light";
    const tickColor = themeMode === "dark" ? "#9fb0c6" : "#5e728c";
    const gridColor =
      themeMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(70, 98, 132, 0.12)";

    chart.current = new Chart(ref.current, {
      type: "bar",
      data: {
        labels: models.map((item) => item.model),
        datasets: [
          {
            label: "R2 Score",
            data: models.map((item) => item.r2_score),
            backgroundColor: models.map((_, index) =>
              index === 0
                ? themeMode === "dark"
                  ? "rgba(125, 211, 252, 0.85)"
                  : "rgba(47, 110, 183, 0.88)"
                : themeMode === "dark"
                  ? "rgba(167, 139, 250, 0.7)"
                  : "rgba(105, 86, 217, 0.72)"
            ),
            borderRadius: 10,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: tickColor },
          },
        },
        scales: {
          x: {
            ticks: { color: tickColor },
            grid: { display: false },
          },
          y: {
            ticks: { color: tickColor },
            grid: { color: gridColor },
          },
        },
      },
    });

    return () => {
      if (chart.current) {
        chart.current.destroy();
      }
    };
  }, [models]);

  return <canvas ref={ref}></canvas>;
}

export default ModelComparisonChart;
