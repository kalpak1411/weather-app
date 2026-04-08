import React from "react";
import {
  Line
} from "react-chartjs-2";

import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend
);

function TempChart({ labels, data }) {

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: "Temperature",
        data: data,
        borderColor: "#4bc0c0",
        backgroundColor: "rgba(75,192,192,0.2)",
        tension: 0.4,
        fill: true
      }
    ]
  };

  return <Line data={chartData} />;
}

export default TempChart;