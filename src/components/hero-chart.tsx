"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const QUARTERS = ["Q1-23", "Q2-23", "Q3-23", "Q4-23", "Q1-24", "Q2-24", "Q3-24", "Q4-24"];

export function HeroChart({
  data,
  unit,
  color = "#a78bfa",
}: {
  data: number[];
  unit: string;
  color?: string;
}) {
  const series = data.map((v, i) => ({
    q: QUARTERS[QUARTERS.length - data.length + i] ?? `T${i}`,
    v,
  }));

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="q"
            stroke="#52525b"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis
            stroke="#52525b"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v) => `${v}`}
          />
          <Tooltip
            cursor={{ stroke: "#3f3f46", strokeWidth: 1, strokeDasharray: "4 4" }}
            contentStyle={{
              background: "#0a0a0a",
              border: "1px solid #2a2a2a",
              borderRadius: 12,
              fontSize: 12,
              padding: "8px 12px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
            }}
            labelStyle={{ color: "#a1a1aa", marginBottom: 4 }}
            itemStyle={{ color: "#fafafa" }}
            formatter={(v: number) => [`${v}${unit}`, "Value"]}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2.5}
            fill="url(#heroFill)"
            animationDuration={1400}
            animationEasing="ease-out"
            dot={false}
            activeDot={{ r: 5, stroke: color, strokeWidth: 2, fill: "#0a0a0a" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
