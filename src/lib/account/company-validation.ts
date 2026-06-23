type BankDetails = Record<string, string> | null | undefined;

export type CompanyForCheckoutValidation = {
  type: "ooo" | "ip";
  name: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  directorName: string | null;
  legalAddress: string | null;
  bankDetails: BankDetails;
  contactEmail: string | null;
  contactPhone: string | null;
};

function hasValue(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function hasBankValue(bankDetails: BankDetails, key: string) {
  const value = bankDetails?.[key];
  return typeof value === "string" && value.trim().length > 0;
}

function getBankValue(bankDetails: BankDetails, key: string) {
  const value = bankDetails?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function hasDigitLength(value: string | null | undefined, length: number) {
  return new RegExp(`^\\d{${length}}$`).test(value?.trim() ?? "");
}

export function getCompanyMissingFields(company: CompanyForCheckoutValidation) {
  const missingFields: string[] = [];

  if (!hasValue(company.name)) {
    missingFields.push("Название организации");
  }

  if (!hasValue(company.inn)) {
    missingFields.push("ИНН");
  } else if (!hasDigitLength(company.inn, company.type === "ip" ? 12 : 10)) {
    missingFields.push(
      company.type === "ip" ? "ИНН ИП — 12 цифр" : "ИНН — 10 цифр",
    );
  }

  if (company.type === "ooo" && !hasValue(company.kpp)) {
    missingFields.push("КПП");
  } else if (company.type === "ooo" && !hasDigitLength(company.kpp, 9)) {
    missingFields.push("КПП — 9 цифр");
  }

  if (!hasValue(company.ogrn)) {
    missingFields.push(company.type === "ip" ? "ОГРНИП" : "ОГРН");
  } else if (!hasDigitLength(company.ogrn, company.type === "ip" ? 15 : 13)) {
    missingFields.push(
      company.type === "ip" ? "ОГРНИП — 15 цифр" : "ОГРН — 13 цифр",
    );
  }

  if (company.type === "ooo" && !hasValue(company.directorName)) {
    missingFields.push("Руководитель");
  }

  if (!hasValue(company.legalAddress)) {
    missingFields.push("Юридический адрес");
  }

  if (!hasBankValue(company.bankDetails, "bankName")) {
    missingFields.push("Банк");
  }

  if (!hasBankValue(company.bankDetails, "bik")) {
    missingFields.push("БИК");
  } else if (!hasDigitLength(getBankValue(company.bankDetails, "bik"), 9)) {
    missingFields.push("БИК — 9 цифр");
  }

  if (!hasBankValue(company.bankDetails, "checkingAccount")) {
    missingFields.push("Расчетный счет");
  } else if (
    !hasDigitLength(getBankValue(company.bankDetails, "checkingAccount"), 20)
  ) {
    missingFields.push("Расчетный счет — 20 цифр");
  }

  if (!hasBankValue(company.bankDetails, "correspondentAccount")) {
    missingFields.push("Корреспондентский счет");
  } else if (
    !hasDigitLength(getBankValue(company.bankDetails, "correspondentAccount"), 20)
  ) {
    missingFields.push("Корреспондентский счет — 20 цифр");
  }

  if (!hasValue(company.contactEmail)) {
    missingFields.push("Email компании");
  }

  if (!hasValue(company.contactPhone)) {
    missingFields.push("Телефон компании");
  }

  return missingFields;
}

export function isCompanyReadyForCheckout(company: CompanyForCheckoutValidation) {
  return getCompanyMissingFields(company).length === 0;
}
