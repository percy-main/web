import { useSession } from "@/lib/auth/client";
import { urlMatch } from "@/lib/util/url-match";
import type { FC } from "react";
import { type TMenuItem, MenuItem } from "../MenuItem";

type Props = {
  pathname: string;
};

export const AuthNav: FC<Props> = ({ pathname }) => {
  const session = useSession();

  if (session.isPending) {
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

  return (
    <MenuItem
      item={menuItem}
      purpose="menu"
      width="fixed"
      isActive={urlMatch(pathname, menuItem)}
    />
  );
};
