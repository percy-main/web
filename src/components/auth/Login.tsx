import { SimpleInput } from "@/components/form/SimpleInput";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { authClient } from "@/lib/auth/client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { match } from "ts-pattern";

export const LoginPage = () => {
  const [phase, setPhase] = useState<"login" | "2fa" | "recovery">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [otp, setOtp] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");

  useEffect(() => {
    if (!PublicKeyCredential.isConditionalMediationAvailable?.()) {
      return;
    }

    void authClient.signIn.passkey(
      { autoFill: true },
      {
        onSuccess() {
          window.location.href = "/members";
        },
        onError(error) {
          setError(error.error.message);
        },
      },
    );

    return;
  }, []);

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      void authClient.signIn.email(
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
          onError(error) {
            setError(error.error.message);
          },
        },
      );
    },
    [email, password],
  );

  const handleOtp = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      void authClient.twoFactor.verifyTotp(
        {
          code: otp,
        },
        {
          onSuccess() {
            window.location.href = "/members";
          },
          onError(error) {
            setError(error.error.message);
          },
        },
      );
    },
    [otp],
  );

  const handleRecovery = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      void authClient.twoFactor.verifyBackupCode(
        {
          code: recoveryCode,
        },
        {
          onSuccess() {
            window.location.href = "/members";
          },
          onError(error) {
            setError(error.error.message);
          },
        },
      );
    },
    [recoveryCode],
  );

  return (
    <section>
      <div className="mx-auto flex flex-col items-center px-6 md:h-screen lg:py-0">
        <div className="w-full rounded-lg bg-white shadow-sm sm:max-w-md md:mt-0 md:p-0 dark:border dark:border-gray-700 dark:bg-gray-800">
          <div className="space-y-4 p-6 sm:p-8 md:space-y-6">
            {match(phase)
              .with("login", () => (
                <>
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
                </>
              ))
              .with("2fa", () => (
                <>
                  <h1 className="text-xl leading-tight font-bold tracking-tight text-gray-900 md:text-2xl dark:text-white">
                    Two-factor Authentication Required
                  </h1>
                  <form
                    className="flex flex-col items-center justify-center space-y-4 md:space-y-6"
                    onSubmit={handleOtp}
                  >
                    <InputOTP
                      maxLength={6}
                      value={otp}
                      onChange={setOtp}
                      required
                    >
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
                      <p className="text-sm font-light text-red-800">{error}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => setPhase("recovery")}
                      className="focus:ring-primary-300 text-sm hover:underline"
                    >
                      Stuck? Use a recovery code.
                    </button>
                  </form>
                </>
              ))
              .with("recovery", () => (
                <>
                  <h1 className="text-xl leading-tight font-bold tracking-tight text-gray-900 md:text-2xl dark:text-white">
                    Use A Recovery Code
                  </h1>
                  <form
                    className="flex flex-col items-center justify-center space-y-4 md:space-y-6"
                    onSubmit={handleRecovery}
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
                      <p className="text-sm font-light text-red-800">{error}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => setPhase("recovery")}
                      className="focus:ring-primary-300 text-sm hover:underline"
                    >
                      Stuck? Use a recovery code.
                    </button>
                  </form>
                </>
              ))
              .exhaustive()}
          </div>
        </div>
      </div>
    </section>
  );
};
