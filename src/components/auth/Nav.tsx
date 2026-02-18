import { useSession } from "@/lib/auth/client";
import { urlMatch } from "@/lib/util/url-match";
import type { FC } from "react";
import { type TMenuItem, MenuItem } from "../MenuItem";

type Props = {
  pathname: string;
  variant?: "nav" | "utility";
};

export const AuthNav: FC<Props> = ({ pathname, variant = "nav" }) => {
  const session = useSession();

  if (session.isPending) {
    if (variant === "utility") {
      return <span className="text-sm text-white/70">...</span>;
    }
    return (
      <MenuItem
        item={{
          name: "",
          url: "#",
          match: "never",
        }}
        purpose="menu"
        width="fixed"
        isActive={false}
      />
    );
  }

  const menuItem: TMenuItem = session.data?.session
    ? {
        name: "My Account",
        url: "/members",
        match: "exact",
      }
    : {
        name: "Login",
        url: "/auth/login",
        match: "exact",
      };

  if (variant === "utility") {
    return (
      <a
        href={menuItem.url}
        className="text-sm text-white/90 transition hover:text-white"
      >
        {menuItem.name}
      </a>
    );
  }

  return (
    <MenuItem
      item={menuItem}
      purpose="menu"
      width="fixed"
      isActive={urlMatch(pathname, menuItem)}
    />
  );
};
