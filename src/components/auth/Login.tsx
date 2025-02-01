import { useCallback, useEffect, useState, type FormEvent } from "react";
import { authClient } from "../../lib/auth/client";
import { SimpleInput } from "../form/SimpleInput";

export const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleAuthResponse = useCallback(
    (response?: { error?: { message?: string } | null } | null) => {
      if (response?.error) {
        setError(response?.error.message ?? "Failed to login");
      } else {
        window.location.href = "/members";
      }
    },
    [],
  );

  useEffect(() => {
    if (!PublicKeyCredential.isConditionalMediationAvailable?.()) {
      return;
    }

    void authClient.signIn.passkey({ autoFill: true }).then(handleAuthResponse);

    return;
  }, []);

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      try {
        void authClient.signIn
          .email({
            email,
            password,
          })
          .then(handleAuthResponse);
      } catch (error) {
        console.error(error);
        setError("Failed to login");
      }
    },
    [email, password],
  );

  return (
    <section>
      <div className="mx-auto flex flex-col items-center px-6 md:h-screen lg:py-0">
        <div className="w-full rounded-lg bg-white shadow-sm sm:max-w-md md:mt-0 md:p-0 dark:border dark:border-gray-700 dark:bg-gray-800">
          <div className="space-y-4 p-6 sm:p-8 md:space-y-6">
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
                <a
                  href="#"
                  className="text-primary-600 dark:text-primary-500 text-sm font-medium hover:underline"
                >
                  Forgot password?
                </a>
              </div>
              <button
                type="submit"
                className="focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800 w-full rounded-lg bg-blue-500 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700 focus:ring-4 focus:outline-hidden"
              >
                Sign in
              </button>
              {error && (
                <p className="text-sm font-light text-red-800">{error}</p>
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
          </div>
        </div>
      </div>
    </section>
  );
};
