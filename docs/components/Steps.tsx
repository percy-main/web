import { cn, useDoxla } from "doxla";

export default function Steps({ children }: { children: React.ReactNode }) {
  const { theme } = useDoxla();

  return (
    <div
      className={cn(
        "my-4 space-y-0 border-l-2 pl-6",
        theme === "dark" ? "border-gray-600" : "border-gray-300"
      )}
    >
      {children}
    </div>
  );
}
