// Сумма прописью на русском (рубли + копейки) для PDF-счёта.

const ONES_MASC = [
  "",
  "один",
  "два",
  "три",
  "четыре",
  "пять",
  "шесть",
  "семь",
  "восемь",
  "девять",
];
const ONES_FEM = [
  "",
  "одна",
  "две",
  "три",
  "четыре",
  "пять",
  "шесть",
  "семь",
  "восемь",
  "девять",
];
const TEENS = [
  "десять",
  "одиннадцать",
  "двенадцать",
  "тринадцать",
  "четырнадцать",
  "пятнадцать",
  "шестнадцать",
  "семнадцать",
  "восемнадцать",
  "девятнадцать",
];
const TENS = [
  "",
  "",
  "двадцать",
  "тридцать",
  "сорок",
  "пятьдесят",
  "шестьдесят",
  "семьдесят",
  "восемьдесят",
  "девяносто",
];
const HUNDREDS = [
  "",
  "сто",
  "двести",
  "триста",
  "четыреста",
  "пятьсот",
  "шестьсот",
  "семьсот",
  "восемьсот",
  "девятьсот",
];

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function tripletToWords(num: number, feminine: boolean) {
  const ones = feminine ? ONES_FEM : ONES_MASC;
  const words: string[] = [];
  const h = Math.floor(num / 100);
  const t = Math.floor((num % 100) / 10);
  const o = num % 10;

  if (h > 0) words.push(HUNDREDS[h]);
  if (t === 1) {
    words.push(TEENS[o]);
  } else {
    if (t > 1) words.push(TENS[t]);
    if (o > 0) words.push(ones[o]);
  }

  return words;
}

function integerToWords(value: number) {
  if (value === 0) return "ноль";

  const groups: { value: number; feminine: boolean; forms: [string, string, string] }[] = [
    { value: 0, feminine: false, forms: ["", "", ""] }, // единицы (без названия)
    { value: 0, feminine: true, forms: ["тысяча", "тысячи", "тысяч"] },
    { value: 0, feminine: false, forms: ["миллион", "миллиона", "миллионов"] },
    { value: 0, feminine: false, forms: ["миллиард", "миллиарда", "миллиардов"] },
  ];

  let rest = value;
  for (let i = 0; i < groups.length && rest > 0; i += 1) {
    groups[i].value = rest % 1000;
    rest = Math.floor(rest / 1000);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const group = groups[i];
    if (group.value === 0) continue;
    parts.push(...tripletToWords(group.value, group.feminine));
    if (group.forms[0]) {
      parts.push(plural(group.value, ...group.forms));
    }
  }

  return parts.join(" ");
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * "Семьсот двадцать четыре тысячи пятьсот шестьдесят девять рублей 00 копеек"
 */
export function amountInWords(amount: number) {
  const rounded = Math.round(amount * 100) / 100;
  const rubles = Math.floor(rounded);
  const kopecks = Math.round((rounded - rubles) * 100);

  const rublesWords = integerToWords(rubles);
  const rublesNoun = plural(rubles, "рубль", "рубля", "рублей");
  const kopecksNoun = plural(kopecks, "копейка", "копейки", "копеек");
  const kopecksStr = String(kopecks).padStart(2, "0");

  return capitalize(`${rublesWords} ${rublesNoun} ${kopecksStr} ${kopecksNoun}`);
}

/** Краткая форма: "724 569 рублей 00 копеек" (число + склонение). */
export function amountShortWords(amount: number) {
  const rounded = Math.round(amount * 100) / 100;
  const rubles = Math.floor(rounded);
  const kopecks = Math.round((rounded - rubles) * 100);
  const grouped = new Intl.NumberFormat("ru-RU").format(rubles);
  const rublesNoun = plural(rubles, "рубль", "рубля", "рублей");
  const kopecksNoun = plural(kopecks, "копейка", "копейки", "копеек");
  return `${grouped} ${rublesNoun} ${String(kopecks).padStart(2, "0")} ${kopecksNoun}`;
}
