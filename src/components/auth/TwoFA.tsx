import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { authClient } from "@/lib/auth/client";
import { useMutation } from "@tanstack/react-query";
import type { FC, FormEvent } from "react";
import { useCallback, useState } from "react";
import type { LoginPhase } from "./Login";

type Props = {
  setPhase: (phase: LoginPhase) => void;
};

export const TwoFA: FC<Props> = ({ setPhase }) => {
  const [otp, setOtp] = useState("");

  const signin = useMutation({
    mutationFn: () =>
      authClient.twoFactor.verifyTotp(
        {
          code: otp,
        },
        {
          onSuccess() {
            window.location.href = "/members";
          },
        },
      ),
  });

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      signin.mutate();
    },
    [signin],
  );

  const error = signin.error ?? signin.data?.error;

  return (
    <section>
      <h1 className="text-xl leading-tight font-bold tracking-tight text-gray-900 md:text-2xl dark:text-white">
        Two-factor Authentication Required
      </h1>
      <form
        className="flex flex-col items-center justify-center space-y-4 md:space-y-6"
        onSubmit={handleSubmit}
      >
        <InputOTP maxLength={6} value={otp} onChange={setOtp} required>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
        <button
          type="submit"
          className="focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800 w-full rounded-lg bg-blue-500 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700 focus:ring-4 focus:outline-hidden"
        >
          Submit
        </button>
        {error && (
          <p className="text-sm font-light text-red-800">{error.message}</p>
        )}
        <button
          type="button"
          onClick={() => setPhase("recovery")}
          className="focus:ring-primary-300 text-sm hover:underline"
        >
          Stuck? Use a recovery code.
        </button>
      </form>
    </section>
  );
};
