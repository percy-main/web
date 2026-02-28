import { Button } from "@/components/ui/Button";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useState, type FC } from "react";
import QRCode from "react-qr-code";
import { match, P } from "ts-pattern";
import { authClient } from "../lib/auth/client";
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
    mutationFn: (password: string) => authClient.twoFactor.enable({ password }),
  });

  const disable2FA = useMutation({
    mutationFn: (password: string) =>
      authClient.twoFactor.disable({ password }),
  });

  const verifyTotp = useMutation({
    mutationFn: (code: string) => authClient.twoFactor.verifyTotp({ code }),
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
              <Button
                type="button"
                key="saved"
                onClick={reset}
              >
                I saved them!
              </Button>
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
                <Button
                  type="submit"
                  key="submit"
                >
                  Verify
                </Button>
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
                <Button
                  type="submit"
                  key="submit"
                >
                  Enable
                </Button>
                <Button
                  type="button"
                  key="cancel"
                  variant="outline"
                  onClick={reset}
                >
                  Cancel
                </Button>
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
            <Button
              type="button"
              key="enable"
              variant="outline"
              onClick={() => setIsEnabling(true)}
            >
              Enable
            </Button>
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
                <Button
                  type="submit"
                  key="submit"
                  variant="destructive"
                >
                  Disable
                </Button>
                <Button
                  type="button"
                  key="cancel"
                  variant="outline"
                  onClick={reset}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ),
        )
        .with({ user: { twoFactorEnabled: true } }, () => (
          <div>
            <Button
              type="button"
              key="disable"
              variant="outline"
              onClick={() => setIsDisabling(true)}
            >
              Disable
            </Button>
          </div>
        ))
        .otherwise(() => (
          <>Otherwise</>
        ))}
    </section>
  );
};
