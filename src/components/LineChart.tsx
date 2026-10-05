import { fmtDate } from "@/lib/format";
import { fmtNum } from "@/lib/numbers";

export type ChartPoint = { date: string; value: number };

/** Gráfica de línea sencilla en SVG (sin librerías externas). */
export default function LineChart({
  points,
  unit,
}: {
  points: ChartPoint[];
  unit: string;
}) {
  if (points.length === 0) {
    return <p className="text-sm text-ink/50">Todavía no hay datos.</p>;
  }

  const W = 600;
  const H = 220;
  const padL = 48;
  const padR = 18;
  const padT = 22;
  const padB = 30;

  const vals = points.map((p) => p.value);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  min -= span * 0.15;
  max += span * 0.15;

  const times = points.map((p) => new Date(p.date).getTime());
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const tSpan = t1 - t0 || 1;

  const x = (i: number) =>
    points.length === 1
      ? (padL + (W - padR)) / 2
      : padL + ((times[i] - t0) / tSpan) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");

  const ticks = [min + (max - min) * 0.15, (min + max) / 2, max - (max - min) * 0.15];
  const last = points.length - 1;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`Evolución en ${unit}`}
    >
      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(t)}
            y2={y(t)}
            stroke="currentColor"
            strokeOpacity={0.1}
          />
          <text
            x={padL - 8}
            y={y(t) + 4}
            textAnchor="end"
            fontSize={11}
            fill="currentColor"
            fillOpacity={0.55}
          >
            {fmtNum(t, 1)}
          </text>
        </g>
      ))}

      <path
        d={path}
        fill="none"
        stroke="#2c5036"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={4} fill="#2c5036" />
      ))}

      <text
        x={x(last)}
        y={y(points[last].value) - 10}
        textAnchor="middle"
        fontSize={12}
        fontWeight={700}
        fill="#2c5036"
      >
        {fmtNum(points[last].value, 1)} {unit}
      </text>

      <text x={padL} y={H - 8} fontSize={11} fill="currentColor" fillOpacity={0.55}>
        {fmtDate(points[0].date)}
      </text>
      {points.length > 1 && (
        <text
          x={W - padR}
          y={H - 8}
          textAnchor="end"
          fontSize={11}
          fill="currentColor"
          fillOpacity={0.55}
        >
          {fmtDate(points[last].date)}
        </text>
      )}
    </svg>
  );
}
