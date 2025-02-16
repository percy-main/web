import type { FC } from "react";
import { Passkeys } from "./Passkeys";
import { TwoFactor } from "./TwoFactor";

type Props = {
  user: {
    twoFactorEnabled: boolean | null | undefined;
  };
};

export const Security: FC<Props> = ({ user }) => (
  <section className="">
    <Passkeys />
    <TwoFactor user={user} />
  </section>
);
