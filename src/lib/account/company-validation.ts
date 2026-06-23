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

export function getCompanyMissingFields(company: CompanyForCheckoutValidation) {
  const missingFields: string[] = [];

  if (!hasValue(company.name)) {
    missingFields.push("Название организации");
  }

  if (!hasValue(company.inn)) {
    missingFields.push("ИНН");
  }

  if (company.type === "ooo" && !hasValue(company.kpp)) {
    missingFields.push("КПП");
  }

  if (!hasValue(company.ogrn)) {
    missingFields.push(company.type === "ip" ? "ОГРНИП" : "ОГРН");
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
  }

  if (!hasBankValue(company.bankDetails, "checkingAccount")) {
    missingFields.push("Расчетный счет");
  }

  if (!hasBankValue(company.bankDetails, "correspondentAccount")) {
    missingFields.push("Корреспондентский счет");
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
