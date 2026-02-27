import { cn, useDoxla } from "doxla";

const roleColors = {
  admin: {
    light: "bg-blue-100 text-blue-800 border-blue-200",
    dark: "bg-blue-900/40 text-blue-300 border-blue-700",
  },
  "junior-manager": {
    light: "bg-green-100 text-green-800 border-green-200",
    dark: "bg-green-900/40 text-green-300 border-green-700",
  },
  user: {
    light: "bg-gray-100 text-gray-800 border-gray-200",
    dark: "bg-gray-800 text-gray-300 border-gray-600",
  },
};

export default function RoleBadge({
  role,
}: {
  role: "admin" | "junior-manager" | "user";
}) {
  const { theme } = useDoxla();
  const colors = roleColors[role] ?? roleColors.user;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        theme === "dark" ? colors.dark : colors.light
      )}
    >
      {role === "junior-manager" ? "Junior Manager" : role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}
