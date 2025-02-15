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
          "bg-blue-700",
          "hover:bg-blue-800",
          "focus:ring-4",
          "focus:ring-blue-300",
          "font-medium",
          "rounded-lg",
          "text-sm",
          "px-5",
          "py-2.5",
          "dark:bg-blue-600",
          "dark:hover:bg-blue-700",
          "focus:outline-hidden",
          "dark:focus:ring-blue-800",
        ],
        menu: null,
      },
      width: {
        fixed: ["min-w-32"],
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
        <div className="right-2 left-2 h-0.5 bg-linear-to-tl from-green-400 to-blue-400" />
      )}
    </>
  );
};
