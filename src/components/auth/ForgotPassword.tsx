import { SimpleInput } from "@/components/form/SimpleInput";
import { authClient } from "@/lib/auth/client";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useState, type FC, type FormEvent } from "react";
import { match, P } from "ts-pattern";

export const ForgotPassword: FC = () => {
  const [email, setEmail] = useState("");

  const forgetPassword = useMutation({
    mutationFn: () =>
      authClient.forgetPassword({
        email,
        redirectTo: "/auth/reset-password",
      }),
  });

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      forgetPassword.mutate();
    },
    [forgetPassword],
  );

  const error = forgetPassword.error ?? forgetPassword.data?.error;

  return (
    <section>
      <h1 className="text-xl leading-tight font-bold tracking-tight text-gray-900 md:text-2xl dark:text-white">
        Forgotten your password?
      </h1>
      {match(forgetPassword)
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
            <button
              type="submit"
              className="focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800 w-full rounded-lg bg-blue-500 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700 focus:ring-4 focus:outline-hidden"
            >
              Submit
            </button>
            {error && (
              <p className="text-sm font-light text-red-800">{error.message}</p>
            )}
          </form>
        ))}
    </section>
  );
};
