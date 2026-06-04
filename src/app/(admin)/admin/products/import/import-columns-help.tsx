"use client";

import { HelpCircle, X } from "lucide-react";
import { useState } from "react";

const columnDescriptions = [
  ["sku", "Артикул товара. Можно оставить пустым: система назначит его автоматически. Если такой артикул уже есть, строка обновит offer найденного продавца или добавит новый offer к товару."],
  ["name", "Название товара. Обязательная колонка."],
  ["category", "Название категории. Обязательная колонка. Категория ищется по точному названию."],
  ["subcategory", "Название подкатегории внутри найденной категории. Необязательно."],
  ["seller", "Название продавца. Нужно указать seller или sellerInn, иначе строка не пройдет проверку."],
  ["sellerInn", "ИНН продавца. Приоритетный способ найти продавца. Нужно указать sellerInn или seller."],
  ["priceWithVat", "Цена товара с НДС. Обязательная колонка. Используйте число, например 12400 или 12400.50."],
  ["vatRate", "Ставка НДС в процентах. Если не указана, используется значение по умолчанию."],
  ["size", "Размер или краткая характеристика размера, например 2 мм. Необязательно."],
  ["unit", "Единица измерения, например шт, кг, м. Обязательная колонка."],
  ["description", "Описание товара. Необязательно."],
] as const;

export function ImportColumnsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        aria-label="Что значат колонки импорта"
        className="inline-flex size-9 items-center justify-center rounded-lg bg-white text-[#1157ff] shadow-sm ring-1 ring-slate-200 transition hover:bg-[#eaf1ff]"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        <HelpCircle size={18} />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="max-h-full w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
              <div>
                <h2 className="text-2xl font-black text-slate-950">
                  Колонки Excel-импорта
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Названия колонок нужно указывать как в списке. Обязательные поля:
                  name, category, seller или sellerInn, priceWithVat, unit.
                </p>
              </div>
              <button
                aria-label="Закрыть"
                className="rounded-lg bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                type="button"
                onClick={() => setIsOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5">
              <div className="grid gap-3">
                {columnDescriptions.map(([column, description]) => (
                  <div
                    className="grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[140px_1fr]"
                    key={column}
                  >
                    <code className="font-mono text-sm font-black text-[#1157ff]">
                      {column}
                    </code>
                    <p className="text-sm leading-6 text-slate-600">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
