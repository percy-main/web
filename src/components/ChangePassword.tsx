import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { authClient } from "../lib/auth/client";
import { SimpleInput } from "./form/SimpleInput";

const MIN_PASSWORD_LENGTH = 8;

export const ChangePassword = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState("");
  const [success, setSuccess] = useState(false);

  const changePassword = useMutation({
    mutationFn: (params: { currentPassword: string; newPassword: string }) =>
      authClient.changePassword({
        currentPassword: params.currentPassword,
        newPassword: params.newPassword,
        revokeOtherSessions: true,
      }),
    onSuccess: (result) => {
      if (!result.error) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setValidationError("");
        setSuccess(true);
      } else {
        setSuccess(false);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    setValidationError("");

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setValidationError(
        `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setValidationError("New passwords do not match.");
      return;
    }

    changePassword.mutate({ currentPassword, newPassword });
  };

  return (
    <section>
      <h2 className="text-h4">Change Password</h2>
      {success && (
        <p className="mb-4 text-sm text-green-700">
          Your password has been changed successfully.
        </p>
      )}
      <form onSubmit={handleSubmit}>
        <SimpleInput
          id="current-password"
          type="password"
          label="Current Password"
          value={currentPassword}
          onChange={(e) => {
            setCurrentPassword(e.currentTarget.value);
            setSuccess(false);
            setValidationError("");
          }}
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="current-password"
        />
        <SimpleInput
          id="new-password"
          type="password"
          label="New Password"
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.currentTarget.value);
            setSuccess(false);
            setValidationError("");
          }}
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
        />
        <SimpleInput
          id="confirm-password"
          type="password"
          label="Confirm New Password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.currentTarget.value);
            setSuccess(false);
            setValidationError("");
          }}
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
        />
        {validationError && (
          <p className="mb-4 text-sm text-red-600">{validationError}</p>
        )}
        {changePassword.data?.error && (
          <p className="mb-4 text-sm text-red-600">
            {changePassword.data.error.message}
          </p>
        )}
        <button
          type="submit"
          disabled={changePassword.isPending}
          className="text-dark cursor-pointer justify-self-start rounded border-1 border-gray-800 px-4 py-2 text-sm hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {changePassword.isPending ? "Changing..." : "Change Password"}
        </button>
      </form>
    </section>
  );
};
