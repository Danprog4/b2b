"use client";

import { useMemo, useState, type FormEvent } from "react";

import { PasswordRequirements } from "@/components/auth/password-requirements";
import { SubmitButton } from "@/components/ui/submit-button";
import { changeBuyerPasswordAction } from "@/lib/account/profile-actions";
import { isPasswordPolicyValid } from "@/lib/auth/password-policy";

export function PasswordChangeForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submittedWithInvalidPassword, setSubmittedWithInvalidPassword] =
    useState(false);
  const [submittedWithMismatch, setSubmittedWithMismatch] = useState(false);

  const passwordsMismatch = useMemo(
    () =>
      newPassword.length > 0 &&
      confirmPassword.length > 0 &&
      newPassword !== confirmPassword,
    [newPassword, confirmPassword],
  );
  const showMismatch = passwordsMismatch || submittedWithMismatch;
  const showPasswordInvalid =
    submittedWithInvalidPassword && !isPasswordPolicyValid(newPassword);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    let shouldBlockSubmit = false;

    if (!isPasswordPolicyValid(newPassword)) {
      setSubmittedWithInvalidPassword(true);
      shouldBlockSubmit = true;
    }

    if (newPassword !== confirmPassword) {
      setSubmittedWithMismatch(true);
      shouldBlockSubmit = true;
    }

    if (shouldBlockSubmit) {
      event.preventDefault();
    }
  }

  return (
    <form
      action={changeBuyerPasswordAction}
      className="mt-6 grid gap-5"
      onSubmit={handleSubmit}
    >
      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Текущий пароль
        <input
          autoComplete="current-password"
          className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
          name="currentPassword"
          required
          type="password"
        />
      </label>

      <div className="grid items-start gap-4 md:grid-cols-2">
        <label className="grid content-start gap-2 text-sm font-bold text-slate-700">
          Новый пароль
          <input
            aria-describedby="profile-password-requirements"
            aria-invalid={showPasswordInvalid}
            autoComplete="new-password"
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            minLength={8}
            name="newPassword"
            onChange={(event) => {
              setNewPassword(event.currentTarget.value);
              setSubmittedWithInvalidPassword(false);
              setSubmittedWithMismatch(false);
            }}
            required
            type="password"
            value={newPassword}
          />
          <PasswordRequirements
            id="profile-password-requirements"
            password={newPassword}
            showInvalid={submittedWithInvalidPassword}
          />
        </label>
        <label className="grid content-start gap-2 text-sm font-bold text-slate-700">
          Повторите пароль
          <input
            aria-describedby={
              showMismatch ? "profile-password-confirm-error" : undefined
            }
            aria-invalid={showMismatch}
            autoComplete="new-password"
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            minLength={8}
            name="confirmPassword"
            onChange={(event) => {
              setConfirmPassword(event.currentTarget.value);
              setSubmittedWithMismatch(false);
            }}
            required
            type="password"
            value={confirmPassword}
          />
        </label>
      </div>

      {showMismatch ? (
        <p
          className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700"
          id="profile-password-confirm-error"
        >
          Пароли не совпадают.
        </p>
      ) : null}

      <SubmitButton
        className="h-12 justify-self-start rounded-lg bg-slate-900 px-6 font-bold text-white transition hover:bg-slate-800"
        pendingText="Меняем пароль"
      >
        Изменить пароль
      </SubmitButton>
    </form>
  );
}
