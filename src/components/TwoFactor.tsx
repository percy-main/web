import { useMutation } from "@tanstack/react-query";
import { useCallback, useState, type FC } from "react";
import QRCode from "react-qr-code";
import { match, P } from "ts-pattern";
import { reactClient } from "../lib/auth/client";
import { SimpleInput } from "./form/SimpleInput";

type Props = {
  user: {
    twoFactorEnabled: boolean | null | undefined;
  };
};

export const TwoFactor: FC<Props> = ({ user }) => {
  const [isEnabling, setIsEnabling] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [password, setPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");

  const enable2FA = useMutation({
    mutationFn: (password: string) =>
      reactClient.twoFactor.enable({ password }),
  });

  const disable2FA = useMutation({
    mutationFn: (password: string) =>
      reactClient.twoFactor.disable({ password }),
  });

  const verifyTotp = useMutation({
    mutationFn: (code: string) => reactClient.twoFactor.verifyTotp({ code }),
    onSuccess: () => {
      setVerifyCode("");
    },
  });

  const reset = useCallback(() => {
    setIsEnabling(false);
    setIsDisabling(false);
    setPassword("");
  }, []);

  return (
    <section>
      <h2 className="text-h4">Two-Factor Authentication</h2>

      {match({
        enable2FA,
        disable2FA,
        verifyTotp,
        user,
        isEnabling,
        isDisabling,
      })
        .with(
          {
            isEnabling: true,
            verifyTotp: {
              data: { data: P.not(P.nullish), error: P.nullish },
            },
            enable2FA: {
              data: { data: P.not(P.nullish) },
            },
          },
          ({
            enable2FA: {
              data: {
                data: { backupCodes },
              },
            },
          }) => (
            <div>
              <p>Two-Factor Authentication is enabled</p>
              <p>Recovery codes - save these somewhere safe!</p>
              <pre>{backupCodes.join("\r\n")}</pre>
              <button
                type="button"
                key="saved"
                onClick={reset}
                className="text-dark cursor-pointer justify-self-start rounded border-1 border-gray-800 bg-green-200 px-4 py-2 text-sm hover:bg-green-400"
              >
                I saved them!
              </button>
            </div>
          ),
        )
        .with(
          {
            isEnabling: true,
            enable2FA: {
              data: { data: P.not(P.nullish) },
            },
          },
          ({
            enable2FA: {
              data: {
                data: { totpURI },
              },
            },
            verifyTotp,
          }) => (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verifyTotp.mutate(verifyCode);
              }}
            >
              <div className="mb-4">
                <QRCode value={totpURI} />
              </div>
              <SimpleInput
                id="code"
                type="text"
                label="Scan the QR code, and enter a code from your authenticator app"
                value={verifyCode}
                onChange={(e) => {
                  setVerifyCode(e.currentTarget.value);
                }}
                required
              />
              {verifyTotp.data?.error && <p>{verifyTotp.data.error.message}</p>}
              <div className="flex flex-row gap-4">
                <button
                  type="submit"
                  key="submit"
                  className="text-dark cursor-pointer justify-self-start rounded border-1 border-gray-800 bg-green-200 px-4 py-2 text-sm hover:bg-green-400"
                >
                  Verify
                </button>
              </div>
            </form>
          ),
        )
        .with(
          {
            isEnabling: true,
            user: { twoFactorEnabled: P.union(false, P.nullish) },
            enable2FA: P.union(
              { data: P.nullish },
              { data: { error: P.not(P.nullish) } },
            ),
          },
          ({ enable2FA }) => (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enable2FA.mutate(password);
              }}
            >
              <SimpleInput
                id="password"
                type="password"
                minLength={8}
                label="Enter your password to enable 2FA"
                value={password}
                onChange={(e) => {
                  setPassword(e.currentTarget.value);
                }}
                required
              />
              {enable2FA?.data?.error && <p>{enable2FA.data.error.message}</p>}
              <div className="flex flex-row gap-4">
                <button
                  type="submit"
                  key="submit"
                  className="text-dark cursor-pointer justify-self-start rounded border-1 border-gray-800 bg-green-200 px-4 py-2 text-sm hover:bg-green-400"
                >
                  Enable
                </button>
                <button
                  type="button"
                  key="cancel"
                  onClick={reset}
                  className="text-dark cursor-pointer justify-self-start rounded border-1 border-red-800 px-4 py-2 text-sm hover:bg-red-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          ),
        )
        .with(
          {
            isEnabling: false,
            user: { twoFactorEnabled: P.union(false, P.nullish) },
          },
          () => (
            <button
              type="button"
              key="enable"
              onClick={() => setIsEnabling(true)}
              className="text-dark cursor-pointer justify-self-start rounded border-1 border-gray-800 px-4 py-2 text-sm hover:bg-gray-200"
            >
              Enable
            </button>
          ),
        )

        .with(
          {
            isDisabling: true,
          },
          ({ disable2FA }) => (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                disable2FA.mutate(password);
              }}
            >
              <SimpleInput
                id="password"
                type="password"
                minLength={8}
                label="Enter your password to disable 2FA"
                value={password}
                onChange={(e) => {
                  setPassword(e.currentTarget.value);
                }}
                required
              />
              {disable2FA?.data?.error && (
                <p>{disable2FA.data.error.message}</p>
              )}
              <div className="flex flex-row gap-4">
                <button
                  type="submit"
                  key="submit"
                  className="text-dark cursor-pointer justify-self-start rounded border-1 border-gray-800 bg-green-200 px-4 py-2 text-sm hover:bg-green-400"
                >
                  Disable
                </button>
                <button
                  type="button"
                  key="cancel"
                  onClick={reset}
                  className="text-dark cursor-pointer justify-self-start rounded border-1 border-red-800 px-4 py-2 text-sm hover:bg-red-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          ),
        )
        .with({ user: { twoFactorEnabled: true } }, () => (
          <div>
            <button
              type="button"
              key="disable"
              onClick={() => setIsDisabling(true)}
              className="text-dark cursor-pointer justify-self-start rounded border-1 border-gray-800 px-4 py-2 text-sm hover:bg-gray-200"
            >
              Disable
            </button>
          </div>
        ))
        .otherwise(() => (
          <>Otherwise</>
        ))}
    </section>
  );
};
