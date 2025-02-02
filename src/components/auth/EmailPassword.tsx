import { SimpleInput } from "@/components/form/SimpleInput";
import { authClient } from "@/lib/auth/client";
import { useMutation } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useState,
  type FC,
  type FormEvent,
} from "react";
import type { LoginPhase } from "./Login";

type Props = {
  setPhase: (phase: LoginPhase) => void;
};

export const EmailPassword: FC<Props> = ({ setPhase }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!PublicKeyCredential?.isConditionalMediationAvailable?.()) {
      return;
    }

    void authClient.signIn.passkey(
      { autoFill: true },
      {
        onSuccess() {
          window.location.href = "/members";
        },
      },
    );

    return;
  }, []);

  const signin = useMutation({
    mutationFn: () =>
      authClient.signIn.email(
        {
          email,
          password,
        },
        {
          onSuccess(response) {
            if ("twoFactorRedirect" in response.data) {
              setPhase("2fa");
              return;
            }
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
        Sign in to your account
      </h1>
      <form
        className="space-y-4 md:space-y-6"
        id="signin-form"
        onSubmit={handleSubmit}
      >
        <SimpleInput
          id="email"
          type="email"
          label="Email"
          value={email}
          onChange={(e) => {
            setEmail(e.currentTarget.value);
          }}
          required
          autoComplete="email webauthn"
        />
        <SimpleInput
          id="password"
          type="password"
          label="Password"
          value={password}
          onChange={(e) => {
            setPassword(e.currentTarget.value);
          }}
          required
          autoComplete="password web-authn"
        />
        <div className="flex items-center justify-end">
          <button
            onClick={() => setPhase("forgot")}
            type="button"
            className="text-primary-600 dark:text-primary-500 text-sm font-medium hover:underline"
          >
            Forgot password?
          </button>
        </div>
        <button
          type="submit"
          className="focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800 w-full rounded-lg bg-blue-500 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700 focus:ring-4 focus:outline-hidden"
        >
          Sign in
        </button>
        {error && (
          <p className="text-sm font-light text-red-800">{error.message}</p>
        )}
        <p className="text-sm font-light text-gray-500 dark:text-gray-400">
          Don't have an account yet?{" "}
          <a
            href="/membership/join"
            className="text-primary-600 dark:text-primary-500 font-medium hover:underline"
          >
            Sign up
          </a>
        </p>
      </form>
    </section>
  );
};
