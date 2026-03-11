import { z } from "astro/zod";

export const MEMBER_CATEGORIES = [
  "senior",
  "junior",
  "student",
  "bursary",
  "guest",
] as const;

export type MemberCategory = (typeof MEMBER_CATEGORIES)[number];

export const memberCategorySchema = z.enum(MEMBER_CATEGORIES);

export const MEMBER_CATEGORY_LABELS: Record<MemberCategory, string> = {
  senior: "Senior",
  junior: "Junior",
  student: "Student",
  bursary: "Bursary",
  guest: "Guest",
};

/**
 * Maps a membership type to the default member category.
 * Returns null if no default mapping exists.
 */
export function defaultCategoryForMembershipType(
  membershipType: string,
): MemberCategory | null {
  switch (membershipType) {
    case "senior_player":
    case "senior_women_player":
    case "social":
    case "concessionary":
      return "senior";
    case "junior":
      return "junior";
    default:
      return null;
  }
}
