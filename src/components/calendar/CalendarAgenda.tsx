import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/util/index";
import { format, isToday } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OutcomeBadge } from "./OutcomeBadge";

// ─── Types ───────────────────────────────────────────────────────────

export type CalendarItem = {
  id: string;
  type: "game" | "event";
  category: "1xi" | "2xi" | "mid" | "jun" | "event";
  when: string; // ISO date string
  home?: boolean;
  teamName?: string;
  oppositionClub?: string;
  oppositionTeam?: string;
  leagueName?: string;
  competitionName?: string;
  sponsorName?: string;
  sponsorCta?: boolean;
  outcome?: "W" | "L" | "D" | "T" | "A" | "C" | "N" | null;
  scoreDescription?: string;
  eventName?: string;
  eventDescription?: string;
};

type CalendarDay = {
  date: string;
  isExtra: boolean;
  itemCount: number;
};

export type Props = {
  items: CalendarItem[];
  year: string;
  month: string;
  monthNumber: number;
  previous?: string;
  next?: string;
  stats: { won: number; lost: number; upcoming: number };
  calendarDays: CalendarDay[];
};

type Filter = "all" | "1xi" | "2xi" | "mid" | "jun" | "event";

const TEAM_BORDER_CLASSES: Record<string, string> = {
  "1xi": "border-l-team-1xi",
  "2xi": "border-l-team-2xi",
  mid: "border-l-team-mid",
  jun: "border-l-team-jun",
};

const FILTER_LABELS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "1xi", label: "1st XI" },
  { key: "2xi", label: "2nd XI" },
  { key: "mid", label: "Midweek XI" },
  { key: "jun", label: "Juniors" },
  { key: "event", label: "Events" },
];

const FILTER_BORDER_INLINE: Record<string, string> = {
  "1xi": "#1B3D2F",
  "2xi": "#2563eb",
  mid: "#7c3aed",
  jun: "#d97706",
};

// ─── Mini Calendar ───────────────────────────────────────────────────

function MiniCalendar({
  calendarDays,
  selectedDay,
  onDayClick,
  monthNumber,
  year,
}: {
  calendarDays: CalendarDay[];
  selectedDay: number | null;
  onDayClick: (day: number) => void;
  monthNumber: number;
  year: string;
}) {
  const dayHeaders = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold text-dark">
          {format(new Date(parseInt(year), monthNumber), "MMMM yyyy")}
        </span>
      </div>

      <div className="mb-1 grid grid-cols-7 text-center">
        {dayHeaders.map((d, i) => (
          <div
            key={i}
            className="py-1 text-[11px] font-semibold uppercase tracking-wider text-text/40"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 text-center">
        {calendarDays.map((day, i) => {
          const dateObj = new Date(day.date);
          const dayNum = dateObj.getDate();
          const isSelected =
            !day.isExtra && selectedDay === dayNum;
          const hasFixtures = !day.isExtra && day.itemCount > 0;
          const hasMultiple = !day.isExtra && day.itemCount > 1;
          const isTodayDay = !day.isExtra && isToday(dateObj);
          const isInteractive = !day.isExtra && hasFixtures;

          const classes = cn(
            "relative rounded py-1.5 text-xs transition-colors",
            day.isExtra && "text-text/25",
            !day.isExtra && !hasFixtures && "text-text/70",
            isInteractive &&
              "cursor-pointer font-semibold text-dark hover:bg-primary-light/10",
            isSelected && "!bg-primary !text-white",
            isTodayDay && !isSelected && "ring-1 ring-primary/40",
          );

          const dot = hasFixtures && (
            <span
              className={cn(
                "mx-auto mt-0.5 block rounded-full",
                isSelected ? "bg-white" : "bg-primary",
                hasMultiple ? "h-[5px] w-2 rounded-sm" : "h-[5px] w-[5px]",
              )}
            />
          );

          if (isInteractive) {
            return (
              <button
                key={i}
                type="button"
                onClick={() => onDayClick(dayNum)}
                className={classes}
              >
                {dayNum}
                {dot}
              </button>
            );
          }

          return (
            <span key={i} className={classes}>
              {dayNum}
            </span>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-3">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="text-[11px] text-text/50">Fixture</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-2 rounded-sm bg-primary" />
          <span className="text-[11px] text-text/50">Multiple</span>
        </div>
      </div>
    </div>
  );
}

// ─── Month Summary ───────────────────────────────────────────────────

function MonthSummary({
  stats,
}: {
  stats: Props["stats"];
}) {
  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h4
        className="mb-2 text-xs font-bold uppercase tracking-wider text-text/40"
        style={{ fontFamily: "var(--font-primary), sans-serif" }}
      >
        Month Summary
      </h4>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-win-bg p-2 text-center">
          <div className="text-lg font-bold text-win">{stats.won}</div>
          <div className="text-[10px] font-semibold uppercase text-win/70">
            Won
          </div>
        </div>
        <div className="rounded-lg bg-loss-bg p-2 text-center">
          <div className="text-lg font-bold text-loss">{stats.lost}</div>
          <div className="text-[10px] font-semibold uppercase text-loss/70">
            Lost
          </div>
        </div>
        <div className="rounded-lg bg-gray-100 p-2 text-center">
          <div className="text-lg font-bold text-text/70">
            {stats.upcoming}
          </div>
          <div className="text-[10px] font-semibold uppercase text-text/40">
            Upcoming
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Filter Pills ────────────────────────────────────────────────────

function FilterPills({
  active,
  onChange,
}: {
  active: Filter;
  onChange: (f: Filter) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap justify-center gap-2 sm:justify-start">
      {FILTER_LABELS.map(({ key, label }) => {
        const isActive = active === key;
        const isEvent = key === "event";

        if (key === "all") {
          return (
            <Button
              key={key}
              variant="ghost"
              onClick={() => onChange(key)}
              className={cn(
                "rounded-full",
                isActive
                  ? "bg-primary font-bold text-white shadow-md hover:bg-primary-light hover:text-white"
                  : "border-2 border-primary/20 text-primary hover:border-primary/40 hover:bg-transparent",
              )}
            >
              {label}
            </Button>
          );
        }

        if (isEvent) {
          return (
            <Button
              key={key}
              variant={isActive ? "cta" : "outline"}
              onClick={() => onChange(key)}
              className={cn(
                "rounded-full",
                isActive
                  ? "border-2 border-cta font-bold"
                  : "border-2 border-cta/30 text-cta hover:border-cta/50 hover:bg-transparent",
              )}
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {label}
            </Button>
          );
        }

        const borderColor = FILTER_BORDER_INLINE[key];

        return (
          <Button
            key={key}
            variant="ghost"
            onClick={() => onChange(key)}
            className={cn(
              "rounded-full",
              isActive
                ? "bg-primary font-bold text-white shadow-md hover:bg-primary-light hover:text-white"
                : "border-2 border-primary/20 text-primary hover:border-primary/40 hover:bg-transparent",
            )}
            style={
              !isActive && borderColor
                ? { borderLeftWidth: "4px", borderLeftColor: borderColor }
                : undefined
            }
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}

// ─── Fixture Card ────────────────────────────────────────────────────

function FixtureCard({ item }: { item: CalendarItem }) {
  const when = new Date(item.when);
  const time = format(when, "HH:mm");
  const borderClass = TEAM_BORDER_CLASSES[item.category] ?? "";
  const hasResultStripe = item.outcome === "W" || item.outcome === "L";

  return (
    <a
      href={`/calendar/event/${item.id}`}
      className={cn(
        "group relative mb-2 flex items-center gap-3 overflow-hidden rounded-lg border-l-4 bg-white p-3 shadow-sm transition-all hover:translate-x-1 hover:shadow-md sm:gap-4 sm:p-4",
        borderClass,
      )}
    >
      {/* Result stripe (right edge) */}
      {hasResultStripe && (
        <span
          className={cn(
            "absolute top-0 right-0 bottom-0 w-[3px]",
            item.outcome === "W" ? "bg-win" : "bg-loss",
          )}
        />
      )}

      {/* Home/Away + Time */}
      <div className="flex shrink-0 flex-col items-center gap-1">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md text-xs font-extrabold",
            item.home
              ? "bg-home-bg text-home"
              : "bg-away-bg text-away",
          )}
        >
          {item.home ? "H" : "A"}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-text/40">
          {time}
        </span>
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
          <span className="text-sm font-bold text-dark sm:text-base">
            {item.teamName}
          </span>
          <span className="text-sm text-text/50">vs.</span>
          <span className="text-sm font-semibold text-dark sm:text-base">
            {item.oppositionClub} {item.oppositionTeam}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-text/50">
            {item.leagueName ?? item.competitionName}
          </span>
          {item.sponsorName && (
            <>
              <span className="mx-1 h-1 w-1 rounded-full bg-text/20" />
              <span className="text-xs font-medium text-cta">
                Sponsored by {item.sponsorName}
              </span>
            </>
          )}
          {item.sponsorCta && (
            <>
              <span className="mx-1 h-1 w-1 rounded-full bg-text/20" />
              <span className="text-xs font-medium text-cta">
                Sponsor this match &rarr;
              </span>
            </>
          )}
        </div>
      </div>

      {/* Result badge */}
      {item.outcome && (
        <OutcomeBadge
          outcome={item.outcome}
          scoreDescription={item.scoreDescription}
        />
      )}

      {/* Arrow */}
      <svg
        className="h-5 w-5 shrink-0 text-text/20"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M9 5l7 7-7 7" />
      </svg>
    </a>
  );
}

// ─── Event Card ──────────────────────────────────────────────────────

function EventCard({ item }: { item: CalendarItem }) {
  const when = new Date(item.when);
  const time = format(when, "HH:mm");

  return (
    <a
      href={`/calendar/event/${item.id}`}
      className="group mb-2 flex items-center gap-3 rounded-lg border-2 border-dashed border-cta/30 bg-cta/5 p-3 transition-all hover:translate-x-1 hover:shadow-md sm:gap-4 sm:p-4"
      style={{ borderLeftStyle: "dashed" }}
    >
      {/* Calendar icon + time */}
      <div className="flex shrink-0 flex-col items-center gap-1">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-cta/10 text-cta">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-text/40">
          {time}
        </span>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-cta/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cta">
            Event
          </span>
          <span className="text-sm font-bold text-dark sm:text-base">
            {item.eventName}
          </span>
        </div>
        {item.eventDescription && (
          <div className="mt-0.5">
            <span className="text-xs text-text/50">
              {item.eventDescription}
            </span>
          </div>
        )}
      </div>

      {/* Arrow */}
      <svg
        className="h-5 w-5 shrink-0 text-text/20"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M9 5l7 7-7 7" />
      </svg>
    </a>
  );
}

// ─── Date Group ──────────────────────────────────────────────────────

function DateGroup({
  dateStr,
  items,
}: {
  dateStr: string;
  items: CalendarItem[];
}) {
  const date = new Date(dateStr);
  const heading = format(date, "EEEE d MMMM");

  return (
    <div className="mb-6" id={`agenda-day-${date.getDate()}`}>
      <div className="mb-3">
        <h3 className="mb-0 text-base font-bold text-dark sm:text-lg">
          {heading}
        </h3>
      </div>
      {items.map((item) =>
        item.type === "event" ? (
          <EventCard key={item.id} item={item} />
        ) : (
          <FixtureCard key={item.id} item={item} />
        ),
      )}
    </div>
  );
}

// ─── Past / Upcoming Divider ─────────────────────────────────────────

function PastUpcomingDivider() {
  return (
    <div className="relative my-8 flex items-center">
      <div className="flex-1 border-t-2 border-dashed border-primary/20" />
      <span className="mx-4 shrink-0 rounded-full bg-primary px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">
        Upcoming Events
      </span>
      <div className="flex-1 border-t-2 border-dashed border-primary/20" />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export function CalendarAgenda({
  items,
  year,
  month,
  monthNumber,
  previous,
  next,
  stats,
  calendarDays,
}: Props) {
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const agendaRef = useRef<HTMLDivElement>(null);

  // Read initial filter from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const team = params.get("team");
    if (
      team &&
      ["all", "1xi", "2xi", "mid", "jun", "event"].includes(team)
    ) {
      setActiveFilter(team as Filter);
    }
  }, []);

  const handleFilterChange = useCallback(
    (f: Filter) => {
      setActiveFilter(f);
      const url = new URL(window.location.href);
      if (f === "all") {
        url.searchParams.delete("team");
      } else {
        url.searchParams.set("team", f);
      }
      window.history.replaceState({}, "", url.toString());
    },
    [],
  );

  const handleDayClick = useCallback((day: number) => {
    setSelectedDay(day);
    const el = document.getElementById(`agenda-day-${day}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Filter items
  const filteredItems = useMemo(() => {
    if (activeFilter === "all") return items;
    return items.filter((item) => item.category === activeFilter);
  }, [items, activeFilter]);

  // Group by date (using a Map to merge items on the same day regardless of sort order)
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of filteredItems) {
      const dateStr = item.when.split("T")[0];
      const existing = map.get(dateStr);
      if (existing) {
        existing.push(item);
      } else {
        map.set(dateStr, [item]);
      }
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateStr, items]) => ({ dateStr, items }));
  }, [filteredItems]);

  // Find divider position: between last past and first future
  const dividerIndex = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let lastPastIdx = -1;
    for (let i = 0; i < grouped.length; i++) {
      const d = new Date(grouped[i].dateStr);
      if (d < today) lastPastIdx = i;
    }
    // Insert divider after lastPastIdx if there are future items after
    if (lastPastIdx >= 0 && lastPastIdx < grouped.length - 1) {
      return lastPastIdx;
    }
    return -1;
  }, [grouped]);



  const totalFixtures = items.filter((i) => i.type === "game").length;
  const totalResults = items.filter((i) => i.outcome).length;

  return (
    <div>
      {/* Month Navigation Header */}
      <div className="mb-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-4 sm:gap-8">
          {previous ? (
            <a
              href={previous}
              className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-primary/20 text-primary transition-colors hover:bg-primary hover:text-white"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </a>
          ) : (
            <div className="h-10 w-10" />
          )}
          <div>
            <h1
              className="mb-0 text-2xl font-bold text-dark sm:text-3xl"
              style={{ fontFamily: "var(--font-secondary), serif" }}
            >
              {month} {year}
            </h1>
            <p className="text-sm text-text/60">
              {totalFixtures} fixture{totalFixtures !== 1 ? "s" : ""}
              {totalResults > 0 && (
                <>
                  {" "}
                  &middot; {totalResults} result
                  {totalResults !== 1 ? "s" : ""}
                </>
              )}
            </p>
          </div>
          {next ? (
            <a
              href={next}
              className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-primary/20 text-primary transition-colors hover:bg-primary hover:text-white"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path d="M9 5l7 7-7 7" />
              </svg>
            </a>
          ) : (
            <div className="h-10 w-10" />
          )}
        </div>

        {/* Today button */}
        <a
          href={`/calendar/${new Date().getFullYear()}/${format(new Date(), "MMMM").toLowerCase()}`}
          className="hidden items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-light sm:flex"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Today
        </a>
      </div>

      {/* Filter Pills */}
      <FilterPills active={activeFilter} onChange={handleFilterChange} />

      {/* Main Content: Sidebar + Agenda */}
      <div className="flex gap-6 lg:gap-8">
        {/* Left Sidebar: Mini Calendar (desktop only) */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-4 space-y-4">
            <MiniCalendar
              calendarDays={calendarDays}
              selectedDay={selectedDay}
              onDayClick={handleDayClick}
              monthNumber={monthNumber}
              year={year}
            />
            {(stats.won > 0 || stats.lost > 0 || stats.upcoming > 0) && (
              <MonthSummary stats={stats} />
            )}
          </div>
        </aside>

        {/* Main Agenda */}
        <div className="min-w-0 flex-1" ref={agendaRef}>
          {grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg bg-white p-8 text-center shadow-sm">
              <svg
                className="mb-3 h-12 w-12 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="font-medium text-gray-600">
                {activeFilter === "all"
                  ? `No events scheduled for ${month}`
                  : `No ${FILTER_LABELS.find((f) => f.key === activeFilter)?.label ?? ""} fixtures for ${month}`}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Check nearby months or{" "}
                <a
                  href="mailto:trustees@percymain.org"
                  className="text-primary hover:underline"
                >
                  contact the club
                </a>
              </p>
            </div>
          ) : (
            grouped.map((group, i) => (
              <div key={group.dateStr}>
                {dividerIndex >= 0 && dividerIndex === i - 1 && <PastUpcomingDivider />}
                <DateGroup dateStr={group.dateStr} items={group.items} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
