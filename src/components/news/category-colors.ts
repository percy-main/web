/**
 * Maps tag title keywords to color objects for category-based styling.
 * Uses the same palette as the calendar team colors in tailwind.config.
 */

type CategoryColor = {
  text: string;
  bg: string;
  dot: string;
};

const categoryMap: Record<string, CategoryColor> = {
  cricket: { text: "#1B3D2F", bg: "#E8F0EC", dot: "#1B3D2F" },
  "1st xi": { text: "#1B3D2F", bg: "#E8F0EC", dot: "#1B3D2F" },
  "2nd xi": { text: "#2563eb", bg: "#dbeafe", dot: "#2563eb" },
  senior: { text: "#1B3D2F", bg: "#E8F0EC", dot: "#1B3D2F" },
  running: { text: "#2563eb", bg: "#dbeafe", dot: "#2563eb" },
  football: { text: "#7c3aed", bg: "#ede9fe", dot: "#7c3aed" },
  boxing: { text: "#d97706", bg: "#fef3c7", dot: "#d97706" },
  charity: { text: "#dc2626", bg: "#fee2e2", dot: "#dc2626" },
  refugee: { text: "#dc2626", bg: "#fee2e2", dot: "#dc2626" },
  junior: { text: "#d97706", bg: "#fef3c7", dot: "#d97706" },
  women: { text: "#7c3aed", bg: "#ede9fe", dot: "#7c3aed" },
};

const defaultColor: CategoryColor = {
  text: "#1B3D2F",
  bg: "#E8F0EC",
  dot: "#1B3D2F",
};

export function getCategoryColor(tagTitle: string): CategoryColor {
  const lower = tagTitle.toLowerCase();
  for (const [keyword, color] of Object.entries(categoryMap)) {
    if (lower.includes(keyword)) {
      return color;
    }
  }
  return defaultColor;
}
