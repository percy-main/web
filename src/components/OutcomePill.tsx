import type { Result } from "@/collections/game";
import { cn } from "@/lib/util";

type Props = {
  outcome: Result["outcome"];
};

export function OutcomePill({ outcome }: Props) {
  if (!outcome) return null;

  const label =
    outcome === "W"
      ? "W"
      : outcome === "L"
        ? "L"
        : outcome === "D"
          ? "D"
          : outcome === "T"
            ? "T"
            : outcome === "A"
              ? "A"
              : outcome === "C"
                ? "C"
                : "NR";

  const colorClass =
    outcome === "W"
      ? "bg-green-600 text-white"
      : outcome === "L"
        ? "bg-red-600 text-white"
        : "bg-gray-400 text-white";

  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold leading-none",
        colorClass,
      )}
      title={
        outcome === "W"
          ? "Won"
          : outcome === "L"
            ? "Lost"
            : outcome === "D"
              ? "Draw"
              : outcome === "T"
                ? "Tied"
                : outcome === "A"
                  ? "Abandoned"
                  : outcome === "C"
                    ? "Cancelled"
                    : "No Result"
      }
    >
      {label}
    </span>
  );
}
