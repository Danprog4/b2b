const documentTypeLabelsSource = [
  ["payment_invoice", "Счет на оплату"],
  ["company_card", "Карточка компании"],
  ["charter", "Уставные документы"],
  ["inn_ogrn", "ИНН / ОГРН"],
  ["bank_details", "Банковские реквизиты"],
  ["seller_company_card", "Карточка компании продавца"],
  ["upd", "УПД"],
  ["invoice_factura", "Счет-фактура"],
  ["contract", "Договор"],
  ["specification", "Спецификация"],
  ["act", "Акт"],
  ["waybill", "Накладная"],
  ["certificate", "Сертификат"],
  ["passport", "Паспорт"],
  ["warranty", "Гарантийный документ"],
  ["manual", "Инструкция"],
  ["other", "Другой документ"],
] as const;

export const documentTypes = [
  ["payment_invoice", "Счет на оплату"],
  ["contract", "Договор"],
  ["upd", "УПД"],
  ["specification", "Спецификация"],
  ["act", "Акт"],
  ["company_card", "Карточка компании"],
  ["charter", "Уставные документы"],
  ["inn_ogrn", "ИНН / ОГРН"],
  ["seller_company_card", "Карточка компании продавца"],
  ["other", "Прочий документ"],
] as const;

export const orderDocumentTypes = [
  ["payment_invoice", "Счет на оплату"],
  ["contract", "Договор"],
  ["upd", "УПД"],
  ["specification", "Спецификация"],
  ["act", "Акт"],
  ["other", "Прочий документ"],
] as const;

export const buyerCompanyDocumentTypes = [
  ["company_card", "Карточка компании"],
  ["charter", "Уставные документы"],
  ["inn_ogrn", "ИНН / ОГРН"],
] as const;

export const sellerDocumentTypes = [
  ["seller_company_card", "Карточка компании продавца"],
] as const;

const documentTypeLabels = new Map<string, string>(documentTypeLabelsSource);

export function getDocumentTypeLabel(type: string) {
  return documentTypeLabels.get(type) ?? type;
}

export function getDocumentTargetLabel(target: string) {
  if (target === "order") {
    return "Заказ";
  }

  if (target === "buyer_company") {
    return "Компания покупателя";
  }

  if (target === "seller") {
    return "Продавец";
  }

  if (target === "contract") {
    return "Договор";
  }

  if (target === "chat") {
    return "Чат";
  }

  return target;
}

export function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} КБ`;
  }

  return `${(sizeBytes / 1024 / 1024).toFixed(1)} МБ`;
}
