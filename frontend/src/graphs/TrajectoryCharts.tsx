import { useEffect, useRef } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend
} from "chart.js";

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);

interface Series {
  label: string;
  data: number[];
  color: string;
}

interface ChartProps {
  title: string;
  labels: number[];
  series: Series[];
}

function LineChart({ title, labels, series }: ChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels.map((v) => v.toFixed(0)),
        datasets: series.map((s) => ({
          label: s.label,
          data: s.data,
          borderColor: s.color,
          backgroundColor: s.color,
          pointRadius: 0,
          tension: 0.25
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: series.length > 1
          },
          title: {
            display: true,
            text: title,
            color: "#E2E8F0",
            font: { size: 14, family: "Space Grotesk" }
          }
        },
        scales: {
          x: {
            grid: { color: "rgba(226, 232, 240, 0.15)" },
            ticks: { color: "#CBD5F5" }
          },
          y: {
            grid: { color: "rgba(226, 232, 240, 0.15)" },
            ticks: { color: "#CBD5F5" }
          }
        }
      }
    });

    return () => chart.destroy();
  }, [labels, series, title]);

  return (
    <div className="h-56 rounded-xl bg-slate-900/70 border border-slate-700/70 p-3">
      <canvas ref={canvasRef} />
    </div>
  );
}

interface TrajectoryChartsProps {
  distance: number[];
  drop: number[];
  drift: number[];
  velocity: number[];
  energy: number[];
}

export function TrajectoryCharts({ distance, drop, drift, velocity, energy }: TrajectoryChartsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <LineChart
        title="Траектория (падение)"
        labels={distance}
        series={[{ label: "Drop (м)", data: drop, color: "#1E4E5E" }]}
      />
      <LineChart
        title="Ветровой снос"
        labels={distance}
        series={[{ label: "Drift (м)", data: drift, color: "#FF8A5B" }]}
      />
      <LineChart
        title="Скорость пули"
        labels={distance}
        series={[{ label: "Velocity (м/с)", data: velocity, color: "#93C5FD" }]}
      />
      <LineChart
        title="Энергия"
        labels={distance}
        series={[{ label: "Energy (Дж)", data: energy, color: "#8FE3C8" }]}
      />
    </div>
  );
}
