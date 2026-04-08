import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

function ComparisonChart({ actual = [], predicted = [] }) {

  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {

    if (!chartRef.current) return;

    // destroy old chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext("2d");

    // ================= LABELS (UPDATED WITH DATE) =================
    const labels = predicted.map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i + 1);

      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short"
      });
    });

    // ================= CREATE CHART =================
    chartInstance.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Actual",
            data: actual,
            borderColor: "#4bc0c0",
            backgroundColor: "rgba(75,192,192,0.2)",
            tension: 0.4,
            fill: true
          },
          {
            label: "Predicted",
            data: predicted,
            borderColor: "#ff6384",
            borderDash: [6, 6],
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: "Date"
            }
          },
          y: {
            title: {
              display: true,
              text: "Temperature (°C)"
            }
          }
        }
      }
    });

  }, [actual, predicted]);

  return (
    <div style={{ height: "300px" }}>
      <canvas ref={chartRef}></canvas>
    </div>
  );
}

export default ComparisonChart;