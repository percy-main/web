import { SimpleInput } from "@/components/form/SimpleInput";
import { authClient } from "@/lib/auth/client";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useState, type FC, type FormEvent } from "react";
import type { LoginPhase } from "./Login";

type Props = {
  setPhase: (phase: LoginPhase) => void;
};

export const Recovery: FC<Props> = ({ setPhase }) => {
  const [recoveryCode, setRecoveryCode] = useState("");

  const verifyBackupCode = useMutation({
    mutationFn: () =>
      authClient.twoFactor.verifyBackupCode(
        {
          code: recoveryCode,
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
      verifyBackupCode.mutate();
    },
    [verifyBackupCode],
  );

  const error = verifyBackupCode.error ?? verifyBackupCode.data?.error;

  return (
    <section>
      <h1 className="text-xl leading-tight font-bold tracking-tight text-gray-900 md:text-2xl dark:text-white">
        Use A Recovery Code
      </h1>
      <form
        className="flex flex-col items-center justify-center space-y-4 md:space-y-6"
        onSubmit={handleSubmit}
      >
        <SimpleInput
          type="text"
          id="recovery"
          label="Recovery Code"
          value={recoveryCode}
          onChange={(e) => setRecoveryCode(e.currentTarget.value)}
        />
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
