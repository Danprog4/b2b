"use client";

import { ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { FileUploadField } from "@/components/ui/file-upload-field";
import { ProductSubmitButton } from "./product-submit-button";

type Option = {
  id: string;
  name: string;
};

type ProductFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  product?: {
    id: string;
    name: string;
    categoryId: string;
    subcategoryId: string | null;
    priceWithVat: string;
    vatRate: string | null;
    size: string | null;
    unit: string;
    description: string | null;
    mainImageUrl?: string | null;
  };
  categories: Option[];
  subcategories: Array<Option & { categoryName: string }>;
  submitText: string;
};

const productUnitOptions = ["шт", "кг", "т", "м", "м2", "м3", "л", "упак"] as const;

export function SellerProductForm({
  action,
  product,
  categories,
  subcategories,
  submitText,
}: ProductFormProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const imageUrl = previewUrl ?? product?.mainImageUrl ?? null;

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <form action={action} className="grid gap-5">
      {product ? <input name="productId" type="hidden" value={product.id} /> : null}

      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Название товара
        <input
          className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
          defaultValue={product?.name ?? ""}
          name="name"
          placeholder="Например, Лист стальной 2 мм"
          required
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Категория
          <select
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            defaultValue={product?.categoryId ?? ""}
            name="categoryId"
            required
          >
            <option value="">Выберите категорию</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Подкатегория
          <select
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            defaultValue={product?.subcategoryId ?? ""}
            name="subcategoryId"
          >
            <option value="">Без подкатегории</option>
            {subcategories.map((subcategory) => (
              <option key={subcategory.id} value={subcategory.id}>
                {subcategory.categoryName} · {subcategory.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Цена с НДС
          <input
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            defaultValue={product?.priceWithVat ?? ""}
            inputMode="decimal"
            min="0"
            name="priceWithVat"
            required
            step="0.01"
            type="number"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          НДС, %
          <input
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            defaultValue={product?.vatRate ?? "22.00"}
            inputMode="decimal"
            min="0"
            name="vatRate"
            step="0.01"
            type="number"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Размер
          <input
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            defaultValue={product?.size ?? ""}
            name="size"
            placeholder="2 мм"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Единица
          <select
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            defaultValue={product?.unit ?? ""}
            name="unit"
            required
          >
            <option value="">Выберите единицу</option>
            {productUnitOptions.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Описание
        <textarea
          className="rounded-lg border border-slate-200 px-4 py-3 font-normal text-slate-950"
          defaultValue={product?.description ?? ""}
          name="description"
          rows={5}
        />
      </label>

      <section className="grid gap-4 rounded-xl bg-slate-50 p-4">
        <div className="grid gap-4 md:grid-cols-[180px_1fr]">
          <div className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
            {imageUrl ? (
              <img
                alt={product?.name ?? "Фото товара"}
                className="h-40 w-full object-cover"
                src={imageUrl}
              />
            ) : (
              <div className="flex h-40 items-center justify-center bg-slate-100 text-slate-300">
                <ImageIcon size={36} />
              </div>
            )}
          </div>
          <div className="grid content-start gap-3">
            <FileUploadField
              accept="image/jpeg,image/png,image/webp"
              buttonText={product?.mainImageUrl ? "Заменить фото" : "Загрузить фото"}
              name="mainImage"
              onFilesChange={(files) => {
                setPreviewUrl((currentUrl) => {
                  if (currentUrl) {
                    URL.revokeObjectURL(currentUrl);
                  }

                  const [file] = files;
                  return file ? URL.createObjectURL(file) : null;
                });
              }}
            />
          </div>
        </div>
      </section>

      {product ? (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
          После отправки текущая опубликованная версия останется в каталоге.
          Новые данные применятся только после модерации администратора.
        </div>
      ) : null}

      <ProductSubmitButton
        confirmMessage={
          product
            ? "Отправить изменения на модерацию? Текущая опубликованная версия останется в продаже до решения администратора."
            : undefined
        }
      >
        {submitText}
      </ProductSubmitButton>
    </form>
  );
}
