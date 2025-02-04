import { useSession } from "@/lib/auth/client";
import { urlMatch } from "@/lib/util/url-match";
import type { FC } from "react";
import { MenuItem } from "../MenuItem";

type Props = {
  pathname: string;
};

export const AuthNav: FC<Props> = ({ pathname }) => {
  const session = useSession();

  const menuItem: MenuItem = session.data?.session
    ? {
        name: "My Account",
        url: "/members",
        match: "exact",
        style: "menu",
      }
    : {
        name: "Login",
        url: "/auth/login",
        match: "exact",
        style: "menu",
      };

  return <MenuItem item={menuItem} isActive={urlMatch(pathname, menuItem)} />;
};
