import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { CHIPS, SANDWICH_BUDGET, SCORING, SLOT_COUNTS } from "@/lib/fantasy/scoring";

function formatPoints(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function BattingRules() {
  const s = SCORING.batting;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Batting</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead className="w-24 text-right">Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Per run scored</TableCell>
              <TableCell className="text-right font-medium">{formatPoints(s.perRun)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Per four hit</TableCell>
              <TableCell className="text-right font-medium">{formatPoints(s.perFour)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Per six hit</TableCell>
              <TableCell className="text-right font-medium">{formatPoints(s.perSix)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Half-century bonus (50-99 runs)</TableCell>
              <TableCell className="text-right font-medium">{formatPoints(s.fiftyBonus)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Century bonus (100+ runs)</TableCell>
              <TableCell className="text-right font-medium">{formatPoints(s.hundredBonus)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Duck penalty (0 runs, not out excluded)</TableCell>
              <TableCell className="text-right font-medium text-red-600">{formatPoints(s.duckPenalty)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p className="mt-2 text-sm text-gray-500">
          Half-century and century bonuses are mutually exclusive — a century earns the century bonus only.
        </p>
      </CardContent>
    </Card>
  );
}

function BowlingRules() {
  const s = SCORING.bowling;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bowling</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead className="w-24 text-right">Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Per wicket taken</TableCell>
              <TableCell className="text-right font-medium">{formatPoints(s.perWicket)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Per maiden over</TableCell>
              <TableCell className="text-right font-medium">{formatPoints(s.perMaiden)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>3-wicket haul bonus (3-4 wickets)</TableCell>
              <TableCell className="text-right font-medium">{formatPoints(s.threeWicketBonus)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>5-wicket haul bonus (5+ wickets)</TableCell>
              <TableCell className="text-right font-medium">{formatPoints(s.fiveWicketBonus)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Good economy bonus (under {s.economyBonusThreshold} RPO, min {s.economyMinOvers} overs)</TableCell>
              <TableCell className="text-right font-medium">{formatPoints(s.economyBonus)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Poor economy penalty (over {s.economyPenaltyThreshold} RPO, min {s.economyMinOvers} overs)</TableCell>
              <TableCell className="text-right font-medium text-red-600">{formatPoints(s.economyPenalty)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p className="mt-2 text-sm text-gray-500">
          3-wicket and 5-wicket bonuses are mutually exclusive. Economy bonuses require a minimum of {s.economyMinOvers} overs bowled.
        </p>
      </CardContent>
    </Card>
  );
}

function FieldingRules() {
  const s = SCORING.fielding;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fielding</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead className="w-24 text-right">Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Per catch (fielder)</TableCell>
              <TableCell className="text-right font-medium">{formatPoints(s.perCatch)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Per catch (wicketkeeper)</TableCell>
              <TableCell className="text-right font-medium">{formatPoints(s.perCatchKeeper)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Per run out</TableCell>
              <TableCell className="text-right font-medium">{formatPoints(s.perRunOut)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Per stumping</TableCell>
              <TableCell className="text-right font-medium">{formatPoints(s.perStumping)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p className="mt-2 text-sm text-gray-500">
          Wicketkeeper catches are worth fewer points since keepers get more catching opportunities.
        </p>
      </CardContent>
    </Card>
  );
}

function RoleSlotsRules() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Role Slots</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-sm">
          <div>
            <h4 className="font-medium">🏏 Batting slots ({SLOT_COUNTS.batting})</h4>
            <p className="text-gray-600">
              Score batting + fielding + team points only. Bowling points are excluded.
            </p>
          </div>
          <div>
            <h4 className="font-medium">🎳 Bowling slots ({SLOT_COUNTS.bowling})</h4>
            <p className="text-gray-600">
              Score bowling + fielding + team points only. Batting points are excluded.
            </p>
          </div>
          <div>
            <h4 className="font-medium">🏏🎳 All-Rounder slot ({SLOT_COUNTS.allrounder})</h4>
            <p className="text-gray-600">
              Scores ALL point categories (batting + bowling + fielding + team).
              The all-rounder <strong>cannot</strong> be made captain.
            </p>
          </div>
          <p className="text-gray-500">
            Reassigning players between slots is free and does not count as a transfer.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SandwichBudgetRules() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sandwich Budget</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-sm">
          <p className="text-gray-600">
            Each player has a sandwich cost (🥪) from 1 to 5, based on their previous season performance.
            Top performers cost more sandwiches.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cost</TableHead>
                <TableHead>Player Tier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>🥪🥪🥪🥪🥪</TableCell>
                <TableCell>Top 10% of scorers</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>🥪🥪🥪🥪</TableCell>
                <TableCell>Top 10-30%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>🥪🥪🥪</TableCell>
                <TableCell>Top 30-50%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>🥪🥪</TableCell>
                <TableCell>Top 50-70%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>🥪</TableCell>
                <TableCell>Bottom 30% / new players</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="text-gray-600">
            Your total squad cost must not exceed <strong>{SANDWICH_BUDGET} sandwiches</strong>.
            This ensures team diversity — you can&apos;t just pick all the best players.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function WicketkeeperRules() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Wicketkeeper</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-sm">
          <p className="text-gray-600">
            Designate exactly one player in your squad as wicketkeeper (WK).
            Scoring is based on the actual match role, not just the fantasy tag:
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scenario</TableHead>
                <TableHead className="text-right">Catches</TableHead>
                <TableHead className="text-right">Stumpings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Any player in WK slot</TableCell>
                <TableCell className="text-right font-medium">{formatPoints(SCORING.fielding.perCatchKeeper)}/catch</TableCell>
                <TableCell className="text-right font-medium">{formatPoints(SCORING.fielding.perStumping)}/stumping</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Non-keeper in non-WK slot</TableCell>
                <TableCell className="text-right font-medium">{formatPoints(SCORING.fielding.perCatch)}/catch</TableCell>
                <TableCell className="text-right text-gray-400">N/A</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-red-600">Actual keeper NOT in WK slot</TableCell>
                <TableCell className="text-right font-medium text-red-600">0</TableCell>
                <TableCell className="text-right font-medium text-red-600">0</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="text-gray-500">
            The WK slot uses a reduced catch rate ({SCORING.fielding.perCatchKeeper}pt vs {SCORING.fielding.perCatch}pt).
            If the actual match wicketkeeper is placed in a non-WK slot, they forfeit all catch and stumping points.
            You must place the real keeper in the WK slot to earn their dismissal points.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function GeneralRules() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team & General</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule</TableHead>
              <TableHead className="w-24 text-right">Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Win bonus (player&apos;s team wins)</TableCell>
              <TableCell className="text-right font-medium">{formatPoints(SCORING.team.winBonus)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Captain multiplier</TableCell>
              <TableCell className="text-right font-medium">2x</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p className="mt-2 text-sm text-gray-500">
          Your captain&apos;s points are doubled in your team score. The captain cannot be
          placed in the all-rounder slot. The captain multiplier does not affect the player leaderboard.
        </p>
      </CardContent>
    </Card>
  );
}

function ChipRules() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Chips</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-sm">
          <div>
            <h4 className="font-medium">Triple Captain</h4>
            <p className="text-gray-600">
              When activated, your captain&apos;s points are tripled ({CHIPS.triple_captain.captainMultiplier}x) instead of
              doubled (2x) for that gameweek. You get {CHIPS.triple_captain.usesPerSeason} uses per season.
            </p>
          </div>
          <div>
            <h4 className="font-medium">How to use</h4>
            <p className="text-gray-600">
              Activate a chip from the &quot;Chips&quot; section on the My Team page before the gameweek locks
              (Friday 23:59 UK time). You can deactivate it before the lock deadline if you change your mind.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TransferRules() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transfers & Deadlines</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-sm">
          <div>
            <h4 className="font-medium">Squad size</h4>
            <p className="text-gray-600">Pick 11 players for your squad, including one captain.</p>
          </div>
          <div>
            <h4 className="font-medium">Pre-season</h4>
            <p className="text-gray-600">Unlimited changes to your squad before Gameweek 1 starts.</p>
          </div>
          <div>
            <h4 className="font-medium">In-season transfers</h4>
            <p className="text-gray-600">Maximum 3 transfers per gameweek. Your first squad selection is always unlimited.</p>
          </div>
          <div>
            <h4 className="font-medium">Lock deadline</h4>
            <p className="text-gray-600">Teams lock at Friday 23:59 UK time. Editing reopens Monday 00:00 UK time.</p>
          </div>
          <div>
            <h4 className="font-medium">Eligible matches</h4>
            <p className="text-gray-600">Only league matches for 1st XI and 2nd XI count towards fantasy points.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Scoring rules content without page wrapper — used in the fantasy home tab */
export function ScoringRulesContent() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-gray-600">
        Points are awarded based on real match performances in Percy Main 1st XI and 2nd XI league matches.
      </p>
      <RoleSlotsRules />
      <SandwichBudgetRules />
      <WicketkeeperRules />
      <BattingRules />
      <BowlingRules />
      <FieldingRules />
      <GeneralRules />
      <ChipRules />
      <TransferRules />
    </div>
  );
}

/** Full scoring rules page with heading and back link */
export function ScoringRules() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1>Scoring Rules</h1>
        <a
          className="text-dark rounded border border-gray-800 px-4 py-2 text-sm hover:bg-gray-200"
          href="/fantasy"
        >
          Back to Fantasy
        </a>
      </div>
      <ScoringRulesContent />
    </div>
  );
}
