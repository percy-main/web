import type { Match } from "@/lib/util/url-match";
import { cva, type VariantProps } from "class-variance-authority";
import { twMerge } from "tailwind-merge";
import type { FC } from "react";

export type TMenuItem = {
  name: string;
  url: string;
  match: Match | Match[];
};

type Props = VariantProps<typeof style> & {
  item: TMenuItem;
  isActive: boolean;
};

const style = cva(
  [
    "p-3 py-2 text-dark transition hover:text-primary inline-block lg:block",
  ],
  {
    variants: {
      purpose: {
        cta: [
          "text-white",
          "hover:text-white",
          "bg-cta",
          "hover:bg-cta-dark",
          "focus:ring-4",
          "focus:ring-orange-200",
          "font-medium",
          "rounded-lg",
          "text-sm",
          "px-5",
          "py-2.5",
          "focus:outline-hidden",
        ],
        menu: [
          "uppercase",
          "tracking-wider",
          "text-sm",
          "font-medium",
          "border-b-2",
          "border-transparent",
        ],
      },
      width: {
        fixed: ["min-w-28", "text-center"],
        maxContent: ["max-w-max", "text-center"],
      },
    },
  },
);

export const MenuItem: FC<Props> = ({ item, isActive, purpose, width }) => {
  return (
    <a
      href={item.url}
      className={twMerge(
        style({ purpose, width }),
        isActive && purpose !== "cta" && "border-primary",
      )}
    >
      {item.name}
    </a>
  );
};
