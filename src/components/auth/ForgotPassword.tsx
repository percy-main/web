import { SimpleInput } from "@/components/form/SimpleInput";
import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth/client";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useState, type FC, type FormEvent } from "react";
import { match, P } from "ts-pattern";

export const ForgotPassword: FC = () => {
  const [email, setEmail] = useState("");

  const requestReset = useMutation({
    mutationFn: () =>
      authClient.requestPasswordReset({
        email,
        redirectTo: "/auth/reset-password",
      }),
  });

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      requestReset.mutate();
    },
    [requestReset],
  );

  const error = requestReset.error ?? requestReset.data?.error;

  return (
    <section>
      <h1 className="text-xl leading-tight font-bold tracking-tight text-gray-900 md:text-2xl dark:text-white">
        Forgotten your password?
      </h1>
      {match(requestReset)
        .with({ data: { data: P.not(P.nullish) } }, () => (
          <p>We've sent you an email with a link to reset your password.</p>
        ))
        .otherwise(() => (
          <form
            className="flex flex-col items-center justify-center space-y-4 md:space-y-6"
            onSubmit={handleSubmit}
          >
            <p>
              Enter your email and we'll send you a link to reset your password.
            </p>
            <SimpleInput
              type="text"
              id="email-forgotten"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />
            <Button
              type="submit"
              className="w-full"
            >
              Submit
            </Button>
            {error && (
              <p className="text-sm font-light text-red-800">{error.message}</p>
            )}
          </form>
        ))}
    </section>
  );
};
