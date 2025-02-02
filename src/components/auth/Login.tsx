import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type FC } from "react";
import { match } from "ts-pattern";
import { EmailPassword } from "./EmailPassword";
import { ForgotPassword } from "./ForgotPassword";
import { Recovery } from "./Recovery";
import { ResetPassword } from "./ResetPassword";
import { TwoFA } from "./TwoFA";

export type LoginPhase = "login" | "2fa" | "recovery" | "forgot" | "reset";

type Props = {
  initialPhase?: LoginPhase;
};

export const LoginPage: FC<Props> = ({ initialPhase = "login" }) => {
  const [phase, setPhase] = useState<LoginPhase>(initialPhase);

  return (
    <QueryClientProvider client={new QueryClient()}>
      <section>
        <div className="mx-auto flex flex-col items-center px-6 md:h-screen lg:py-0">
          <div className="w-full rounded-lg bg-white shadow-sm sm:max-w-md md:mt-0 md:p-0 dark:border dark:border-gray-700 dark:bg-gray-800">
            <div className="space-y-4 p-6 sm:p-8 md:space-y-6">
              {match(phase)
                .with("login", () => <EmailPassword setPhase={setPhase} />)
                .with("2fa", () => <TwoFA setPhase={setPhase} />)
                .with("recovery", () => <Recovery setPhase={setPhase} />)
                .with("forgot", () => <ForgotPassword />)
                .with("reset", () => <ResetPassword setPhase={setPhase} />)
                .exhaustive()}
            </div>
          </div>
        </div>
      </section>
    </QueryClientProvider>
  );
};
