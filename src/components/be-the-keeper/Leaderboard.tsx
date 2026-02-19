import { useQuery } from "@tanstack/react-query";
import { actions } from "astro:actions";

const medals = ["🥇", "🥈", "🥉"];

export default function Leaderboard() {
  const query = useQuery({
    queryKey: ["leaderboard", "be-the-keeper"],
    queryFn: () => actions.leaderboard.get({ game: "be-the-keeper", limit: 25 }),
  });

  const entries = query.data?.data?.entries;

  if (query.isLoading) {
    return <p className="py-12 text-center text-gray-400">Loading scores...</p>;
  }

  if (!entries || entries.length === 0) {
    return (
      <p className="rounded-lg bg-gray-50 p-8 text-center text-gray-500">
        No scores yet.{" "}
        <a href="/game/be-the-keeper" className="text-green-800 underline">
          Be the first!
        </a>
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-[#1B3D2F] text-white">
            <th className="px-4 py-3 font-semibold">#</th>
            <th className="px-4 py-3 font-semibold">Name</th>
            <th className="px-4 py-3 text-right font-semibold">Score</th>
            <th className="hidden px-4 py-3 text-right font-semibold sm:table-cell">Level</th>
            <th className="hidden px-4 py-3 text-right font-semibold sm:table-cell">Catches</th>
            <th className="hidden px-4 py-3 text-right font-semibold md:table-cell">Best Streak</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((row, i) => (
            <tr
              key={i}
              className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"} ${i < 3 ? "font-semibold" : ""}`}
            >
              <td className="px-4 py-3">{medals[i] ?? i + 1}</td>
              <td className="px-4 py-3">{row.name}</td>
              <td className="px-4 py-3 text-right tabular-nums">{row.score}</td>
              <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{row.level}</td>
              <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{row.catches}</td>
              <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">{row.bestStreak}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
