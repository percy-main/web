import { cn, useDoxla } from "doxla";

export default function AdminTab({
  name,
  children,
}: {
  name: string;
  children?: React.ReactNode;
}) {
  const { theme } = useDoxla();

  return (
    <div
      className={cn(
        "my-4 rounded-lg border p-4",
        theme === "dark"
          ? "border-indigo-700 bg-indigo-950/30"
          : "border-indigo-200 bg-indigo-50"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
            theme === "dark"
              ? "bg-indigo-800 text-indigo-200"
              : "bg-indigo-200 text-indigo-800"
          )}
        >
          Admin Tab
        </span>
        <span
          className={cn(
            "text-sm font-medium",
            theme === "dark" ? "text-indigo-300" : "text-indigo-700"
          )}
        >
          {name}
        </span>
      </div>
      {children && (
        <div
          className={cn(
            "mt-2 text-sm",
            theme === "dark" ? "text-indigo-200/80" : "text-indigo-700/80"
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
