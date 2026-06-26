import { readFile } from "node:fs/promises";
import path from "node:path";

import { CFB } from "xlsx";

import { formatMoscowDate } from "@/lib/datetime";
import { marketplaceSupplier } from "@/lib/invoices/supplier";

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const TEMPLATE_PATH = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "src",
  "lib",
  "contracts",
  "templates",
  "buyer-supply-contract.docx",
);

type ContractDocxInput = {
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

type ParagraphReplacement = {
  match: (text: string) => boolean;
  value: string;
  align?: "left";
};

export const buyerContractDocxMimeType = DOCX_MIME_TYPE;

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function xmlDecode(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function getParagraphText(paragraphXml: string) {
  const texts = paragraphXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g);
  return Array.from(texts, (match) => xmlDecode(match[1])).join("");
}

function ensurePreserveSpace(textOpenTag: string) {
  if (textOpenTag.includes("xml:space=")) {
    return textOpenTag;
  }

  return textOpenTag.replace("<w:t", '<w:t xml:space="preserve"');
}

function setParagraphText(paragraphXml: string, value: string) {
  let replacedFirstTextNode = false;

  return paragraphXml.replace(
    /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g,
    (match, openTag: string, _text: string, closeTag: string) => {
      if (replacedFirstTextNode) {
        return `${openTag}${closeTag}`;
      }

      replacedFirstTextNode = true;
      return `${ensurePreserveSpace(openTag)}${xmlEscape(value)}${closeTag}`;
    },
  );
}

function setParagraphAlignment(paragraphXml: string, alignment: "left" | undefined) {
  if (!alignment) {
    return paragraphXml;
  }

  if (/<w:jc\b/.test(paragraphXml)) {
    return paragraphXml.replace(/<w:jc\b[^/>]*\/>/, `<w:jc w:val="${alignment}"/>`);
  }

  if (paragraphXml.includes("</w:pPr>")) {
    return paragraphXml.replace("</w:pPr>", `<w:jc w:val="${alignment}"/></w:pPr>`);
  }

  return paragraphXml.replace("<w:p>", `<w:p><w:pPr><w:jc w:val="${alignment}"/></w:pPr>`);
}

function replaceParagraphs(documentXml: string, replacements: ParagraphReplacement[]) {
  const usedReplacements = new Set<number>();

  const updatedXml = documentXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    const text = getParagraphText(paragraphXml).replace(/\s+/g, " ").trim();

    for (let index = 0; index < replacements.length; index += 1) {
      if (usedReplacements.has(index)) {
        continue;
      }

      const replacement = replacements[index];
      if (!replacement.match(text)) {
        continue;
      }

      usedReplacements.add(index);
      return setParagraphAlignment(
        setParagraphText(paragraphXml, replacement.value),
        replacement.align,
      );
    }

    return paragraphXml;
  });

  if (usedReplacements.size !== replacements.length) {
    const missingCount = replacements.length - usedReplacements.size;
    throw new Error(`Contract DOCX template replacements failed: ${missingCount} not found.`);
  }

  return updatedXml;
}

function bankValue(
  bankDetails: Record<string, string> | null,
  key: "bankName" | "bik" | "checkingAccount" | "correspondentAccount",
) {
  return bankDetails?.[key]?.trim() || "";
}

function buyerIntro(input: ContractDocxInput) {
  if (input.buyerType === "ip") {
    return `Индивидуальный предприниматель ${input.buyerName}, ${input.buyerOgrn ? `ОГРНИП ${input.buyerOgrn}, ` : ""}именуемый в дальнейшем «Покупатель» с другой стороны, совместно в дальнейшем именуемые «Стороны», а по отдельности «Сторона», заключили настоящий Договор о нижеследующем:`;
  }

  const directorName = input.buyerDirectorName ?? "уполномоченного представителя";

  return `${input.buyerName}, в лице Генерального директора ${directorName}, действующего на основании Устава, именуемый в дальнейшем «Покупатель» с другой стороны, совместно в дальнейшем именуемые «Стороны», а по отдельности «Сторона», заключили настоящий Договор о нижеследующем:`;
}

function buyerSigner(input: ContractDocxInput) {
  if (input.buyerType === "ip") {
    return input.buyerName;
  }

  return input.buyerDirectorName ?? "Уполномоченный представитель";
}

function buyerOgrnLabel(input: ContractDocxInput) {
  if (!input.buyerOgrn) {
    return input.buyerType === "ip" ? "ОГРНИП" : "ОГРН";
  }

  return `${input.buyerType === "ip" ? "ОГРНИП" : "ОГРН"} ${input.buyerOgrn}`;
}

function buyerInnKpp(input: ContractDocxInput) {
  if (input.buyerType === "ip") {
    return `ИНН ${input.buyerInn}`;
  }

  return `ИНН ${input.buyerInn} / КПП ${input.buyerKpp ?? ""}`.trim();
}

function buildReplacements(input: ContractDocxInput): ParagraphReplacement[] {
  const generatedDate = formatMoscowDate(input.generatedAt);
  const buyerBankDetails = input.buyerBankDetails;

  return [
    {
      match: (text) => text.startsWith("ДОГОВОР ПОСТАВКИ"),
      value: `ДОГОВОР ПОСТАВКИ № ${input.contractNumber} от ${generatedDate}`,
    },
    {
      match: (text) => text.startsWith("Общество с ограниченной ответственностью «ЭКОМИКС»"),
      value: `${marketplaceSupplier.name}, в лице Генерального директора ${marketplaceSupplier.directorName}, действующего на основании Устава, именуемый в дальнейшем «Поставщик», с одной стороны, и ${buyerIntro(input)}`,
      align: "left",
    },
    {
      match: (text) => text.startsWith('ООО "ЭКОМИКС"ИНН'),
      value: `${marketplaceSupplier.name} ИНН ${marketplaceSupplier.inn}`,
    },
    {
      match: (text) => text.startsWith("КПП 772401001"),
      value: `КПП ${marketplaceSupplier.kpp}`,
    },
    {
      match: (text) => text.startsWith("ОГРН 1167746621811"),
      value: `ОГРН ${marketplaceSupplier.ogrn}`,
    },
    {
      match: (text) => text.startsWith("Юридический адрес: 117403"),
      value: `Юридический адрес: ${marketplaceSupplier.legalAddress}`,
    },
    {
      match: (text) => text === "ПАО Сбербанк",
      value: marketplaceSupplier.bankName,
    },
    {
      match: (text) => text === "БИК 044525225",
      value: `БИК ${marketplaceSupplier.bik}`,
    },
    {
      match: (text) => text.startsWith("к/с 30101"),
      value: `к/с ${marketplaceSupplier.correspondentAccount}`,
    },
    {
      match: (text) => text.startsWith("р/с 40702"),
      value: `р/с ${marketplaceSupplier.checkingAccount}`,
    },
    {
      match: (text) => text === "Акопджанян Армен Артакович",
      value: marketplaceSupplier.directorName,
    },
    {
      match: (text) => text.startsWith("ПОКУПАТЕЛЬООО"),
      value: `ПОКУПАТЕЛЬ ${input.buyerName}`,
    },
    {
      match: (text) => text.startsWith("Юр. адрес140005"),
      value: `Юр. адрес ${input.buyerAddress ?? ""}`,
    },
    {
      match: (text) => text.startsWith("ИНН5027302294"),
      value: buyerInnKpp(input),
    },
    {
      match: (text) => text.startsWith("ОГРН1215000131675"),
      value: buyerOgrnLabel(input),
    },
    {
      match: (text) => text.startsWith("Р/счет40702810340000023362"),
      value: `Р/счет ${bankValue(buyerBankDetails, "checkingAccount")}`,
    },
    {
      match: (text) => text === "ПАО Сбербанк",
      value: bankValue(buyerBankDetails, "bankName"),
    },
    {
      match: (text) => text.startsWith("Кор. счет30101810400000000225"),
      value: `Кор. счет ${bankValue(buyerBankDetails, "correspondentAccount")}`,
    },
    {
      match: (text) => text.startsWith("БИК044525225"),
      value: `БИК ${bankValue(buyerBankDetails, "bik")}`,
    },
    {
      match: (text) => text === "Манвелян Л.А.",
      value: buyerSigner(input),
    },
  ];
}

export async function generateBuyerContractDocx(input: ContractDocxInput) {
  const templateBytes = await readFile(TEMPLATE_PATH);
  const archive = CFB.read(templateBytes, { type: "buffer" });
  const documentFile = CFB.find(archive, "/word/document.xml");

  if (!documentFile?.content) {
    throw new Error("Contract DOCX template is missing word/document.xml.");
  }

  const documentXml = Buffer.from(documentFile.content).toString("utf8");
  documentFile.content = Buffer.from(
    replaceParagraphs(documentXml, buildReplacements(input)),
    "utf8",
  );

  const generatedBytes = CFB.write(archive, {
    type: "buffer",
    fileType: "zip",
    compression: true,
  });

  return Buffer.from(generatedBytes);
}
