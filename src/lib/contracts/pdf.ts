import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";

import { formatMoscowDate } from "@/lib/datetime";
import { marketplaceSupplier } from "@/lib/invoices/supplier";

type ContractPdfInput = {
  contractNumber: string;
  generatedAt: Date;
  buyerType: "ooo" | "ip";
  buyerName: string;
  buyerInn: string;
  buyerKpp: string | null;
  buyerOgrn: string | null;
  buyerDirectorName: string | null;
  buyerAddress: string | null;
  buyerContactEmail: string | null;
  buyerContactPhone: string | null;
  buyerBankDetails: Record<string, string> | null;
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

const PAGE_W = 595;
const PAGE_H = 842;
const LEFT = 54;
const RIGHT = 541;
const BLACK = rgb(0, 0, 0);
const MUTED = rgb(0.35, 0.4, 0.48);

async function readFirstAvailableFont() {
  for (const fontPath of FONT_PATHS) {
    try {
      return await readFile(fontPath);
    } catch {
      // Try the next known font path.
    }
  }

  throw new Error("No Cyrillic-capable font found for contract PDF generation.");
}

function text(page: PDFPage, font: PDFFont, value: string, x: number, y: number, size = 10) {
  page.drawText(value, { x, y, size, font, color: BLACK });
}

function bold(page: PDFPage, font: PDFFont, value: string, x: number, y: number, size = 10) {
  page.drawText(value, { x, y, size, font, color: BLACK });
  page.drawText(value, { x: x + 0.35, y, size, font, color: BLACK });
}

function center(page: PDFPage, font: PDFFont, value: string, y: number, size = 10) {
  const width = font.widthOfTextAtSize(value, size);
  text(page, font, value, (PAGE_W - width) / 2, y, size);
}

function wrap(font: PDFFont, value: string, size: number, maxWidth: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(line);
      line = word;
      continue;
    }

    line = next;
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

function companyDetails(input: ContractPdfInput) {
  return [
    input.buyerName,
    `ИНН ${input.buyerInn}`,
    input.buyerKpp ? `КПП ${input.buyerKpp}` : null,
    input.buyerOgrn ? `${input.buyerType === "ip" ? "ОГРНИП" : "ОГРН"} ${input.buyerOgrn}` : null,
    input.buyerAddress,
  ]
    .filter(Boolean)
    .join(", ");
}

function bankDetails(value: Record<string, string> | null) {
  if (!value) {
    return "Банковские реквизиты не указаны.";
  }

  return [
    value.bankName ? `Банк: ${value.bankName}` : null,
    value.bik ? `БИК: ${value.bik}` : null,
    value.checkingAccount ? `Р/с: ${value.checkingAccount}` : null,
    value.correspondentAccount ? `К/с: ${value.correspondentAccount}` : null,
  ]
    .filter(Boolean)
    .join(", ") || "Банковские реквизиты не указаны.";
}

export async function generateBuyerContractPdf(input: ContractPdfInput) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await readFirstAvailableFont());
  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = 790;

  const ensureSpace = (height: number) => {
    if (y - height >= 64) {
      return;
    }

    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = 790;
  };

  const paragraph = (value: string, size = 9.5, gap = 8) => {
    const lines = wrap(font, value, size, RIGHT - LEFT);
    ensureSpace(lines.length * (size + 3) + gap);
    for (const line of lines) {
      text(page, font, line, LEFT, y, size);
      y -= size + 3;
    }
    y -= gap;
  };

  const section = (title: string) => {
    ensureSpace(28);
    bold(page, font, title, LEFT, y, 12);
    y -= 20;
  };

  center(page, font, `ДОГОВОР № ${input.contractNumber}`, y, 15);
  y -= 22;
  center(page, font, "оказания услуг B2B-маркетплейса", y, 11);
  y -= 28;
  text(page, font, `г. Москва`, LEFT, y, 9.5);
  const dateText = formatMoscowDate(input.generatedAt);
  text(page, font, dateText, RIGHT - font.widthOfTextAtSize(dateText, 9.5), y, 9.5);
  y -= 28;

  paragraph(
    `${marketplaceSupplier.name} в лице уполномоченного представителя, действующее на основании внутренних документов, далее "Маркетплейс", с одной стороны, и ${companyDetails(input)}, далее "Покупатель", с другой стороны, совместно именуемые "Стороны", заключили настоящий договор о нижеследующем.`,
  );

  section("1. Предмет договора");
  paragraph(
    "Маркетплейс предоставляет Покупателю доступ к B2B-каталогу товаров и обеспечивает оформление заказов, формирование счетов, передачу статусов и документов в личном кабинете. Товары могут поставляться разными продавцами, при этом Покупатель взаимодействует с единым интерфейсом Сити Маркет.",
  );
  paragraph(
    "Конкретный ассортимент, количество, цена с НДС, сроки и состав заказа фиксируются в заказах, счетах и иных документах, сформированных в системе.",
  );

  section("2. Порядок оформления заказов");
  paragraph(
    "Заказ считается созданным после подтверждения Покупателем состава заказа в личном кабинете. Счет на оплату формируется автоматически. Доставка, условия получения и дополнительные документы согласуются с менеджером или администратором Сити Маркет.",
  );
  paragraph(
    "Оплата счета означает согласие Покупателя с составом заказа и применимыми условиями поставки. До оплаты или выдачи заказа Маркетплейс вправе уточнять состав заказа и формировать актуализированные документы.",
  );

  section("3. Цена и расчеты");
  paragraph(
    "Цены в системе указываются с НДС 22%, если в конкретном документе не указано иное. Итоговая сумма заказа и сумма НДС рассчитываются автоматически на основании выбранных предложений продавцов.",
  );
  paragraph(
    "Покупатель оплачивает единый счет Маркетплейса. Взаиморасчеты с продавцами осуществляются Маркетплейсом самостоятельно и не отображаются Покупателю.",
  );

  section("4. Документы и обмен информацией");
  paragraph(
    "Счета, договор, закрывающие и сопроводительные документы размещаются в личном кабинете Покупателя. Документы считаются полученными Покупателем с момента их публикации в личном кабинете или отправки на контактный email.",
  );
  paragraph(
    "Покупатель обязан поддерживать актуальность реквизитов компании. При изменении реквизитов Маркетплейс вправе переформировать договор и документы.",
  );

  section("5. Реквизиты сторон");
  paragraph(
    `Маркетплейс: ${marketplaceSupplier.name}, ИНН ${marketplaceSupplier.inn}, КПП ${marketplaceSupplier.kpp}, ${marketplaceSupplier.legalAddress}. ${marketplaceSupplier.bankName}, БИК ${marketplaceSupplier.bik}, р/с ${marketplaceSupplier.checkingAccount}, к/с ${marketplaceSupplier.correspondentAccount}.`,
    9,
  );
  paragraph(
    `Покупатель: ${companyDetails(input)}. ${bankDetails(input.buyerBankDetails)}. Контакты: ${input.buyerContactEmail ?? "email не указан"}${input.buyerContactPhone ? `, ${input.buyerContactPhone}` : ""}.`,
    9,
  );

  ensureSpace(88);
  y -= 10;
  bold(page, font, "Маркетплейс", LEFT, y, 10);
  bold(page, font, "Покупатель", 330, y, 10);
  y -= 34;
  page.drawLine({
    start: { x: LEFT, y },
    end: { x: 245, y },
    thickness: 0.7,
    color: BLACK,
  });
  page.drawLine({
    start: { x: 330, y },
    end: { x: RIGHT, y },
    thickness: 0.7,
    color: BLACK,
  });
  y -= 14;
  text(page, font, marketplaceSupplier.directorName, LEFT, y, 8.5);
  text(
    page,
    font,
    input.buyerDirectorName ??
      (input.buyerType === "ip" ? input.buyerName : "Уполномоченный представитель"),
    330,
    y,
    8.5,
  );

  const pages = pdf.getPages();
  pages.forEach((pdfPage, index) => {
    const footer = `Договор ${input.contractNumber} · страница ${index + 1} из ${pages.length}`;
    pdfPage.drawText(footer, {
      x: RIGHT - font.widthOfTextAtSize(footer, 7),
      y: 24,
      size: 7,
      font,
      color: MUTED,
    });
  });

  return pdf.save();
}
