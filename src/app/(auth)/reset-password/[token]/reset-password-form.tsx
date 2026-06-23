"use client";

import { useMemo, useState, type FormEvent } from "react";

import { PasswordRequirements } from "@/components/auth/password-requirements";
import { SubmitButton } from "@/components/ui/submit-button";
import { resetPasswordAction } from "@/lib/auth/password-reset-actions";
import { isPasswordPolicyValid } from "@/lib/auth/password-policy";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submittedWithInvalidPassword, setSubmittedWithInvalidPassword] =
    useState(false);
  const [submittedWithMismatch, setSubmittedWithMismatch] = useState(false);

  const passwordsMismatch = useMemo(
    () =>
      password.length > 0 &&
      passwordConfirm.length > 0 &&
      password !== passwordConfirm,
    [password, passwordConfirm],
  );
  const showMismatch = passwordsMismatch || submittedWithMismatch;
  const showPasswordInvalid =
    submittedWithInvalidPassword && !isPasswordPolicyValid(password);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    let shouldBlockSubmit = false;

    if (!isPasswordPolicyValid(password)) {
      setSubmittedWithInvalidPassword(true);
      shouldBlockSubmit = true;
    }

    if (password !== passwordConfirm) {
      setSubmittedWithMismatch(true);
      shouldBlockSubmit = true;
    }

    if (shouldBlockSubmit) {
      event.preventDefault();
    }
  }

  return (
    <form
      action={resetPasswordAction}
      className="mt-6 grid gap-4"
      onSubmit={handleSubmit}
    >
      <input name="token" type="hidden" value={token} />
      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Новый пароль
        <input
          aria-describedby="reset-password-requirements"
          aria-invalid={showPasswordInvalid}
          autoComplete="new-password"
          className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
          minLength={8}
          name="password"
          onChange={(event) => {
            setPassword(event.currentTarget.value);
            setSubmittedWithInvalidPassword(false);
            setSubmittedWithMismatch(false);
          }}
          placeholder="Не менее 8 символов"
          required
          type="password"
          value={password}
        />
        <PasswordRequirements
          id="reset-password-requirements"
          password={password}
          showInvalid={submittedWithInvalidPassword}
        />
      </label>
      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Повторите пароль
        <input
          aria-describedby={showMismatch ? "password-confirm-error" : undefined}
          aria-invalid={showMismatch}
          autoComplete="new-password"
          className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
          minLength={8}
          name="passwordConfirm"
          onChange={(event) => {
            setPasswordConfirm(event.currentTarget.value);
            setSubmittedWithMismatch(false);
          }}
          placeholder="Повторите новый пароль"
          required
          type="password"
          value={passwordConfirm}
        />
      </label>
      {showMismatch ? (
        <p
          className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700"
          id="password-confirm-error"
        >
          Пароли не совпадают.
        </p>
      ) : null}
      <SubmitButton
        className="mt-2 h-12 rounded-lg bg-[#1157ff] font-bold text-white transition hover:bg-[#0b49e0]"
        pendingText="Сохраняем"
      >
        Сменить пароль
      </SubmitButton>
    </form>
  );
}
