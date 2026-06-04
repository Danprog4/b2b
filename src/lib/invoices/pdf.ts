import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, type PDFFont, type PDFPage, rgb, type RGB } from "pdf-lib";

import { amountInWords, amountShortWords } from "@/lib/invoices/amount-in-words";
import { marketplaceSupplier } from "@/lib/invoices/supplier";

type InvoicePdfItem = {
  productNameSnapshot: string;
  skuSnapshot: string;
  unitSnapshot: string;
  quantity: string;
  priceWithVat: string;
  vatRate: string;
  vatAmount: string;
  lineTotal: string;
};

type InvoicePdfInput = {
  invoiceNumber: string;
  orderNumber: string;
  createdAt: Date;
  buyerName: string;
  buyerInn: string;
  buyerKpp: string | null;
  buyerOgrn: string | null;
  buyerAddress: string | null;
  totalAmount: string;
  vatAmount: string;
  items: InvoicePdfItem[];
};

const FONT_PATHS = [
  path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "public",
    "fonts",
    "Geist-Regular.ttf",
  ),
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/Library/Fonts/Arial Unicode.ttf",
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
];

async function readFirstAvailableFont() {
  for (const fontPath of FONT_PATHS) {
    try {
      return await readFile(fontPath);
    } catch {
      // Try the next known font path.
    }
  }
  throw new Error("No Cyrillic-capable font found for invoice PDF generation.");
}

const BLACK = rgb(0, 0, 0);

const PAGE_W = 595;
const PAGE_H = 842;
const LEFT = 40;
const RIGHT = 555;

function formatDateLong(value: Date) {
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);

  return formatted.replace(/\s*г\.$/, "");
}

function formatDateShort(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function money(value: number | string) {
  const amount = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatQuantity(value: string) {
  const num = Number(value);
  return Number.isInteger(num)
    ? String(num)
    : new Intl.NumberFormat("ru-RU").format(num);
}

function invoiceNumberForFooter(input: InvoicePdfInput) {
  return `Счет на оплату № ${input.invoiceNumber} от ${formatDateShort(
    input.createdAt,
  )} страница 1 из 1`;
}

function uppercaseDetails(value: string) {
  return value.replace(/\s+/g, " ").trim().toUpperCase();
}

function drawText(
  page: PDFPage,
  font: PDFFont,
  value: string,
  x: number,
  y: number,
  size: number,
  color: RGB = BLACK,
) {
  page.drawText(value, { x, y, size, font, color });
}

function drawBoldText(
  page: PDFPage,
  font: PDFFont,
  value: string,
  x: number,
  y: number,
  size: number,
) {
  page.drawText(value, { x, y, size, font, color: BLACK });
  page.drawText(value, { x: x + 0.34, y, size, font, color: BLACK });
}

function drawRightText(
  page: PDFPage,
  font: PDFFont,
  value: string,
  xRight: number,
  y: number,
  size: number,
  bold = false,
) {
  const x = xRight - font.widthOfTextAtSize(value, size);
  if (bold) {
    drawBoldText(page, font, value, x, y, size);
    return;
  }
  drawText(page, font, value, x, y, size);
}

function drawCenteredText(
  page: PDFPage,
  font: PDFFont,
  value: string,
  xLeft: number,
  xRight: number,
  y: number,
  size: number,
) {
  const x = xLeft + (xRight - xLeft - font.widthOfTextAtSize(value, size)) / 2;
  drawText(page, font, value, x, y, size);
}

function drawLine(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness = 0.8,
) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness,
    color: BLACK,
  });
}

function drawRect(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  thickness = 0.8,
) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderWidth: thickness,
    borderColor: BLACK,
  });
}

function wrapText(font: PDFFont, value: string, size: number, maxWidth: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
      continue;
    }
    current = candidate;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

export async function generateInvoicePdf(input: InvoicePdfInput) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontBytes = await readFirstAvailableFont();
  const font = await pdf.embedFont(fontBytes);

  const page = pdf.addPage([PAGE_W, PAGE_H]);

  const s = marketplaceSupplier;
  const warning =
    "Внимание! Оплата данного счета означает согласие с условиями поставки товара. Уведомление об оплате обязательно, в противном случае не гарантируется наличие товара на складе. Товар отпускается по факту прихода денег на р/с Поставщика, самовывозом, при наличии доверенности и паспорта.";

  wrapText(font, warning, 8.2, 500).forEach((line, index) => {
    drawCenteredText(page, font, line, LEFT, RIGHT, 812 - index * 9.5, 8.2);
  });

  const bank = {
    top: 772,
    firstBottom: 736,
    innBottom: 723,
    bottom: 685,
    left: LEFT,
    right: RIGHT,
    middle: 345,
    value: 396,
    kpp: 185,
  };

  drawRect(page, bank.left, bank.bottom, bank.right - bank.left, bank.top - bank.bottom);
  drawLine(page, bank.middle, bank.top, bank.middle, bank.bottom);
  drawLine(page, bank.value, bank.top, bank.value, bank.bottom);
  drawLine(page, bank.left, bank.firstBottom, bank.right, bank.firstBottom);
  drawLine(page, bank.left, bank.innBottom, bank.value, bank.innBottom);
  drawLine(page, bank.kpp, bank.firstBottom, bank.kpp, bank.innBottom);

  drawText(page, font, s.bankName, bank.left + 3, bank.top - 11, 8.8);
  drawText(page, font, "Банк получателя", bank.left + 3, bank.firstBottom + 2, 5.8);
  drawText(page, font, "БИК", bank.middle + 3, bank.top - 11, 8.8);
  drawText(page, font, s.bik, bank.value + 3, bank.top - 11, 8.8);
  drawText(page, font, "Сч. №", bank.middle + 3, bank.top - 24, 8.8);
  drawText(page, font, s.correspondentAccount, bank.value + 3, bank.top - 24, 8.8);

  drawText(page, font, "ИНН", bank.left + 3, bank.firstBottom - 11, 8.8);
  drawText(page, font, s.inn, bank.left + 31, bank.firstBottom - 11, 8.8);
  drawText(page, font, "КПП", bank.kpp + 4, bank.firstBottom - 11, 8.8);
  drawText(page, font, s.kpp, bank.kpp + 35, bank.firstBottom - 11, 8.8);
  drawText(page, font, "Сч. №", bank.middle + 3, bank.firstBottom - 11, 8.8);
  drawText(page, font, s.checkingAccount, bank.value + 3, bank.firstBottom - 11, 8.8);

  drawText(page, font, s.name, bank.left + 3, bank.innBottom - 12, 8.8);
  drawText(page, font, "Получатель", bank.left + 3, bank.bottom + 2, 5.8);

  drawBoldText(
    page,
    font,
    `Счет на оплату № ${input.invoiceNumber} от ${formatDateLong(
      input.createdAt,
    )} г.`,
    LEFT,
    657,
    15.2,
  );
  drawLine(page, LEFT, 648, RIGHT, 648, 1.5);

  const supplierLine = uppercaseDetails(
    [
    s.name,
    `ИНН ${s.inn}`,
    s.kpp ? `КПП ${s.kpp}` : null,
    s.ogrn ? `ОГРН ${s.ogrn}` : null,
    s.legalAddress,
    ]
      .filter(Boolean)
      .join(", "),
  );
  const buyerLine = uppercaseDetails(
    [
    input.buyerName,
    `ИНН ${input.buyerInn}`,
    input.buyerKpp ? `КПП ${input.buyerKpp}` : null,
    input.buyerOgrn ? `ОГРН ${input.buyerOgrn}` : null,
    input.buyerAddress,
    ]
      .filter(Boolean)
      .join(", "),
  );

  const drawParty = (label: string, value: string, y: number) => {
    drawText(page, font, label, LEFT, y, 8.8);
    const lines = wrapText(font, value, 8.8, 355);
    lines.slice(0, 2).forEach((line, index) => {
      drawBoldText(page, font, line, 112, y - index * 10, 8.8);
    });
  };

  drawParty("Поставщик:", supplierLine, 632);
  drawParty("Покупатель:", buyerLine, 603);

  const col = {
    num: LEFT,
    name: 64,
    qty: 323,
    unit: 374,
    price: 423,
    sum: 489,
    end: RIGHT,
  };
  const tableTop = 588;
  const headerBottom = 558;
  const rowHeight = 14;

  drawRect(page, LEFT, headerBottom, RIGHT - LEFT, tableTop - headerBottom, 1);
  for (const x of [col.name, col.qty, col.unit, col.price, col.sum]) {
    drawLine(page, x, tableTop, x, headerBottom);
  }
  drawCenteredText(page, font, "№", col.num, col.name, 570, 8.8);
  drawBoldText(page, font, "Наименование товара, работ, услуг", 110, 570, 8.8);
  drawCenteredText(page, font, "Коли-", col.qty, col.unit, 576, 8.8);
  drawCenteredText(page, font, "чество", col.qty, col.unit, 566, 8.8);
  drawCenteredText(page, font, "Ед. изм.", col.unit, col.price, 570, 8.8);
  drawCenteredText(page, font, "Цена", col.price, col.sum, 570, 8.8);
  drawCenteredText(page, font, "Сумма", col.sum, col.end, 570, 8.8);

  let rowTop = headerBottom;
  input.items.forEach((item, index) => {
    const rowBottom = rowTop - rowHeight;
    drawRect(page, LEFT, rowBottom, RIGHT - LEFT, rowHeight, 1);
    for (const x of [col.name, col.qty, col.unit, col.price, col.sum]) {
      drawLine(page, x, rowTop, x, rowBottom);
    }
    drawCenteredText(page, font, String(index + 1), col.num, col.name, rowBottom + 3.5, 8.8);
    const name = item.productNameSnapshot.replace(/\s+/g, " ").trim();
    drawText(page, font, name, col.name + 2, rowBottom + 3.5, 8.2);
    drawCenteredText(
      page,
      font,
      formatQuantity(item.quantity),
      col.qty,
      col.unit,
      rowBottom + 3.5,
      8.8,
    );
    drawCenteredText(page, font, item.unitSnapshot, col.unit, col.price, rowBottom + 3.5, 8.8);
    drawRightText(page, font, money(item.priceWithVat), col.sum - 3, rowBottom + 3.5, 8.8);
    drawRightText(page, font, money(item.lineTotal), col.end - 3, rowBottom + 3.5, 8.8);
    rowTop = rowBottom;
  });

  const rates = new Set(input.items.map((i) => Number(i.vatRate)));
  const vatRate = rates.size === 1 ? [...rates][0] : 22;
  const totalRows = [
    ["Итого:", money(input.totalAmount)],
    [`В том числе НДС (${vatRate}%):`, money(input.vatAmount)],
    ["Всего к оплате:", money(input.totalAmount)],
  ];
  totalRows.forEach(([label, value], index) => {
    const top = rowTop - index * rowHeight;
    const bottom = top - rowHeight;
    drawRightText(page, font, label, col.sum - 3, bottom + 3.5, 8.8, true);
    drawRect(page, col.sum, bottom, col.end - col.sum, rowHeight, 1);
    drawRightText(page, font, value, col.end - 3, bottom + 3.5, 8.8, true);
  });

  const total = Number(input.totalAmount);
  const totalTextY = rowTop - totalRows.length * rowHeight - 1;
  drawText(
    page,
    font,
    `Всего наименований ${input.items.length}, на сумму ${amountShortWords(total)}`,
    LEFT,
    totalTextY,
    8.8,
  );
  drawBoldText(page, font, amountInWords(total), LEFT, totalTextY - 13, 8.8);
  drawLine(page, LEFT, totalTextY - 18, RIGHT, totalTextY - 18, 1.5);

  const signatureY = totalTextY - 48;
  drawBoldText(page, font, "Руководитель", LEFT, signatureY, 8.8);
  drawLine(page, 137, signatureY - 2, 270, signatureY - 2, 0.6);
  drawBoldText(page, font, s.directorName, 282, signatureY, 8.8);

  drawBoldText(page, font, "Главный бухгалтер", LEFT, signatureY - 39, 8.8);
  drawLine(page, 137, signatureY - 41, 270, signatureY - 41, 0.6);
  drawBoldText(page, font, s.accountantName, 282, signatureY - 39, 8.8);

  drawRightText(page, font, invoiceNumberForFooter(input), RIGHT, 14, 5.8);

  return pdf.save();
}
