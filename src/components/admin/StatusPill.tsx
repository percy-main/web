type Variant = "green" | "red" | "gray" | "blue" | "yellow";

const variantClasses: Record<Variant, string> = {
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-800",
  gray: "bg-gray-100 text-gray-800",
  blue: "bg-blue-100 text-blue-800",
  yellow: "bg-yellow-100 text-yellow-800",
};

export function StatusPill({
  variant,
  children,
}: {
  variant: Variant;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}

export function getMembershipTypeDisplay(type: string | null): {
  label: string;
  variant: Variant;
} {
  switch (type) {
    case "senior_player":
      return { label: "Senior Player", variant: "blue" };
    case "social":
      return { label: "Social", variant: "yellow" };
    case "junior":
      return { label: "Junior", variant: "green" };
    default:
      return { label: "-", variant: "gray" };
  }
}

export function getMembershipStatus(paidUntil: string | null): {
  label: string;
  variant: Variant;
} {
  if (!paidUntil) {
    return { label: "None", variant: "gray" };
  }
  const now = new Date();
  const until = new Date(paidUntil);
  if (until >= now) {
    return { label: "Active", variant: "green" };
  }
  return { label: "Expired", variant: "red" };
}
