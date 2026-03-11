import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useQuery } from "@tanstack/react-query";
import { actions } from "astro:actions";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Props {
  teamId: number;
  ownerName: string;
}

export function SeasonTimeline({ teamId, ownerName }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["fantasy", "seasonTimeline", teamId],
    queryFn: async () => {
      const res = await actions.fantasy.getSeasonTimeline({ teamId });
      if (res.error) throw res.error;
      return res.data;
    },
  });

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading timeline...</p>;
  }

  if (!data || data.timeline.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-gray-500">No season data yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ownerName}&apos;s Season Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data.timeline.map((t) => ({
                name: `GW${t.gameweek}`,
                weekly: t.weeklyPoints,
                cumulative: t.cumulativePoints,
              }))}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="cumulative"
                name="Cumulative"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="weekly"
                name="Weekly"
                stroke="#9ca3af"
                strokeWidth={1}
                strokeDasharray="4 4"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex gap-6 text-sm">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-blue-600" /> Cumulative points
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-gray-400" /> Weekly points
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
