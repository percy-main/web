import type { Match } from "@/lib/util/url-match";
import { cva, type VariantProps } from "class-variance-authority";
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
    "p-3 py-2 text-[15px] text-dark transition hover:text-primary md:px-2 inline-block lg:block",
  ],
  {
    variants: {
      purpose: {
        cta: [
          "text-white",
          "hover:text-white",
          "bg-primary",
          "hover:bg-orange-600",
          "focus:ring-4",
          "focus:ring-orange-200",
          "font-medium",
          "rounded-lg",
          "text-sm",
          "px-5",
          "py-2.5",
          "focus:outline-hidden",
        ],
        menu: null,
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
    <>
      <a href={item.url} className={style({ purpose, width })}>
        {item.name}
      </a>
      {isActive && (
        <div className="right-2 left-2 h-0.5 bg-primary" />
      )}
    </>
  );
};
