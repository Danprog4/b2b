export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_POLICY_ERROR =
  "Пароль должен быть не короче 8 символов и содержать буквы и цифры.";

export const PASSWORD_REQUIREMENTS = [
  {
    id: "length",
    label: `Не менее ${PASSWORD_MIN_LENGTH} символов`,
    test: (password: string) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "letter",
    label: "Хотя бы одна буква",
    test: (password: string) => /\p{L}/u.test(password),
  },
  {
    id: "digit",
    label: "Хотя бы одна цифра",
    test: (password: string) => /\d/u.test(password),
  },
] as const;

export function getPasswordRequirementStatuses(password: string) {
  return PASSWORD_REQUIREMENTS.map((requirement) => ({
    id: requirement.id,
    label: requirement.label,
    met: requirement.test(password),
  }));
}

export function isPasswordPolicyValid(password: string) {
  return PASSWORD_REQUIREMENTS.every((requirement) =>
    requirement.test(password),
  );
}
