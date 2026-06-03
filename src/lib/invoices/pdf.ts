import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, type PDFFont, type PDFPage, rgb, type RGB } from "pdf-lib";

type InvoicePdfItem = {
  productNameSnapshot: string;
  skuSnapshot: string;
  unitSnapshot: string;
  quantity: string;
  priceWithVat: string;
  vatAmount: string;
  lineTotal: string;
};

type InvoicePdfInput = {
  invoiceNumber: string;
  orderNumber: string;
  createdAt: Date;
  buyerName: string;
  buyerInn: string;
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
  for (const path of FONT_PATHS) {
    try {
      return await readFile(path);
    } catch {
      // Try the next known macOS font path.
    }
  }

  throw new Error("No Cyrillic-capable font found for invoice PDF generation.");
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function formatPdfCurrency(value: number | string) {
  const amount = typeof value === "string" ? Number(value) : value;

  return `${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0)} руб.`;
}

function drawTextLine({
  page,
  font,
  text,
  x,
  y,
  size = 10,
  color = rgb(0.08, 0.1, 0.18),
}: {
  page: PDFPage;
  font: PDFFont;
  text: string;
  x: number;
  y: number;
  size?: number;
  color?: RGB;
}) {
  page.drawText(text, { x, y, size, font, color });
}

function truncateText(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

export async function generateInvoicePdf(input: InvoicePdfInput) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const fontBytes = await readFirstAvailableFont();
  const font = await pdf.embedFont(fontBytes);

  const page = pdf.addPage([595, 842]);
  const marginX = 42;
  let y = 790;

  drawTextLine({
    page,
    font,
    text: "Сити Маркет",
    x: marginX,
    y,
    size: 22,
    color: rgb(0.07, 0.34, 1),
  });
  y -= 28;
  drawTextLine({
    page,
    font,
    text: "Поставщик: ООО «Сити Маркет»",
    x: marginX,
    y,
    size: 10,
  });
  y -= 16;
  drawTextLine({
    page,
    font,
    text: "Реквизиты поставщика будут уточнены заказчиком.",
    x: marginX,
    y,
    size: 10,
    color: rgb(0.38, 0.43, 0.52),
  });

  y -= 42;
  drawTextLine({
    page,
    font,
    text: `Счет на оплату № ${input.invoiceNumber} от ${formatDate(input.createdAt)}`,
    x: marginX,
    y,
    size: 18,
  });
  y -= 22;
  drawTextLine({
    page,
    font,
    text: `Заказ: ${input.orderNumber}`,
    x: marginX,
    y,
    size: 11,
  });

  y -= 30;
  drawTextLine({ page, font, text: `Покупатель: ${input.buyerName}`, x: marginX, y });
  y -= 16;
  drawTextLine({ page, font, text: `ИНН: ${input.buyerInn}`, x: marginX, y });
  if (input.buyerAddress) {
    y -= 16;
    drawTextLine({
      page,
      font,
      text: `Адрес: ${truncateText(input.buyerAddress, 95)}`,
      x: marginX,
      y,
    });
  }

  y -= 36;
  const columns = {
    name: marginX,
    qty: 330,
    price: 380,
    vat: 450,
    total: 510,
  };

  page.drawRectangle({
    x: marginX,
    y: y - 8,
    width: 512,
    height: 24,
    color: rgb(0.94, 0.96, 0.99),
  });
  drawTextLine({ page, font, text: "Товар", x: columns.name, y, size: 9 });
  drawTextLine({ page, font, text: "Кол.", x: columns.qty, y, size: 9 });
  drawTextLine({ page, font, text: "Цена", x: columns.price, y, size: 9 });
  drawTextLine({ page, font, text: "НДС", x: columns.vat, y, size: 9 });
  drawTextLine({ page, font, text: "Сумма", x: columns.total, y, size: 9 });

  y -= 26;
  input.items.forEach((item, index) => {
    drawTextLine({
      page,
      font,
      text: `${index + 1}. ${truncateText(item.productNameSnapshot, 48)}`,
      x: columns.name,
      y,
      size: 9,
    });
    y -= 13;
    drawTextLine({
      page,
      font,
      text: `${item.skuSnapshot}, ${item.unitSnapshot}`,
      x: columns.name + 12,
      y,
      size: 8,
      color: rgb(0.38, 0.43, 0.52),
    });
    drawTextLine({
      page,
      font,
      text: String(Number(item.quantity)),
      x: columns.qty,
      y: y + 13,
      size: 9,
    });
    drawTextLine({
      page,
      font,
      text: formatPdfCurrency(item.priceWithVat),
      x: columns.price,
      y: y + 13,
      size: 9,
    });
    drawTextLine({
      page,
      font,
      text: formatPdfCurrency(item.vatAmount),
      x: columns.vat,
      y: y + 13,
      size: 9,
    });
    drawTextLine({
      page,
      font,
      text: formatPdfCurrency(item.lineTotal),
      x: columns.total,
      y: y + 13,
      size: 9,
    });
    y -= 20;
  });

  y -= 12;
  page.drawLine({
    start: { x: marginX, y },
    end: { x: 553, y },
    thickness: 1,
    color: rgb(0.88, 0.91, 0.95),
  });
  y -= 24;
  drawTextLine({
    page,
    font,
    text: `Итого с НДС: ${formatPdfCurrency(input.totalAmount)}`,
    x: 360,
    y,
    size: 13,
  });
  y -= 18;
  drawTextLine({
    page,
    font,
    text: `В том числе НДС: ${formatPdfCurrency(input.vatAmount)}`,
    x: 360,
    y,
    size: 10,
    color: rgb(0.38, 0.43, 0.52),
  });

  return pdf.save();
}
