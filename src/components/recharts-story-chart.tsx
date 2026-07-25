import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

export default function RechartLineChart({
  data,
  accent,
}: {
  data: Array<{ q: string; v: number }>;
  accent: string;
}) {
  const chartData = data.map((pt) => ({ name: pt.q, value: typeof pt.v === "number" ? pt.v : parseFloat(pt.v) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#a1a1a1" }} />
        <YAxis tick={{ fontSize: 11, fill: "#a1a1a1" }} />
        <Line type="monotone" dataKey="value" stroke={accent} strokeWidth={2.5} dot={{ r: 3, fill: accent }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
