import { Card, CardContent } from "@/components/ui/Card";
import {
  CHAOS_RULE_LABELS,
  type ChaosRuleType,
} from "@/lib/fantasy/scoring";
import { useQuery } from "@tanstack/react-query";
import { actions } from "astro:actions";

export function ChaosWeekBanner() {
  const { data: chaosWeek } = useQuery({
    queryKey: ["fantasy", "chaosWeek"],
    queryFn: async () => {
      const result = await actions.fantasy.getChaosWeekPublic({});
      if (result.error) throw result.error;
      return result.data;
    },
  });

  if (!chaosWeek) return null;

  const ruleLabel =
    CHAOS_RULE_LABELS[chaosWeek.rule_type as ChaosRuleType] ??
    chaosWeek.rule_type;

  return (
    <Card className="border-amber-300 bg-amber-50">
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl" role="img" aria-label="Chaos">
            {"\u{1F525}"}
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-amber-900">
                CHAOS WEEK: {chaosWeek.name}
              </h3>
              <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
                {ruleLabel}
              </span>
            </div>
            <p className="mt-1 text-sm text-amber-800">
              {chaosWeek.description}
            </p>
            <p className="mt-1 text-xs text-amber-600">
              Gameweek {chaosWeek.gameweek_id}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
