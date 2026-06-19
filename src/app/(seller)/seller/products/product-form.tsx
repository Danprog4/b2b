"use client";

import { useCallback, useRef, useState } from "react";

import { ProductImageFields } from "@/components/products/product-image-fields";
import type { ProductGalleryImage } from "@/components/products/product-image-fields";
import { ProductSubmitButton } from "./product-submit-button";

type Option = {
  id: string;
  name: string;
};

type ProductFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  product?: ProductFormProduct;
  categories: Option[];
  subcategories: Array<Option & { categoryName: string }>;
  submitText: string;
  moderationAlert?: {
    title: string;
    body: string;
  } | null;
};

type ProductFormProduct = {
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
  galleryImages?: ProductGalleryImage[];
  isPublished?: boolean;
};

const productUnitOptions = ["шт", "кг", "т", "м", "м2", "м3", "л", "упак"] as const;

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMoney(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed.toFixed(2) : value.trim();
}

function hasUploadedFile(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .some(
      (value): value is File =>
        value instanceof File && value.size > 0 && Boolean(value.name),
    );
}

function hasProductChanges(form: HTMLFormElement, product: ProductFormProduct) {
  const formData = new FormData(form);
  const initialGalleryImageIds =
    product.galleryImages?.map((image) => image.fileId ?? image.id) ?? [];
  const submittedGalleryImageIds = formData
    .getAll("existingGalleryImageFileIds")
    .filter((value): value is string => typeof value === "string");

  if (hasUploadedFile(formData, "mainImage") || hasUploadedFile(formData, "galleryImages")) {
    return true;
  }

  if (
    formData.get("galleryImagesState") === "1" &&
    submittedGalleryImageIds.join("\0") !== initialGalleryImageIds.join("\0")
  ) {
    return true;
  }

  return (
    getFormString(formData, "name") !== product.name.trim() ||
    getFormString(formData, "categoryId") !== product.categoryId ||
    getFormString(formData, "subcategoryId") !== (product.subcategoryId ?? "") ||
    normalizeMoney(getFormString(formData, "priceWithVat")) !==
      normalizeMoney(product.priceWithVat) ||
    getFormString(formData, "size") !== (product.size ?? "") ||
    getFormString(formData, "unit") !== product.unit ||
    getFormString(formData, "description") !== (product.description ?? "")
  );
}

export function SellerProductForm({
  action,
  product,
  categories,
  subcategories,
  submitText,
  moderationAlert,
}: ProductFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isDirty, setIsDirty] = useState(false);
  const isSubmitDisabled = Boolean(product && !isDirty);

  const refreshDirtyState = useCallback(() => {
    if (!product || !formRef.current) {
      return;
    }

    const nextIsDirty = hasProductChanges(formRef.current, product);
    setIsDirty((currentIsDirty) =>
      currentIsDirty === nextIsDirty ? currentIsDirty : nextIsDirty,
    );
  }, [product]);

  return (
    <form
      action={action}
      className="grid gap-5"
      ref={formRef}
      onChange={refreshDirtyState}
      onInput={refreshDirtyState}
      onSubmit={(event) => {
        if (product && !hasProductChanges(event.currentTarget, product)) {
          event.preventDefault();
          setIsDirty(false);
        }
      }}
    >
      {product ? <input name="productId" type="hidden" value={product.id} /> : null}

      {moderationAlert ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-red-900">
          <p className="text-sm font-black">{moderationAlert.title}</p>
          <p className="mt-1 text-sm font-semibold leading-6">
            {moderationAlert.body}
          </p>
        </div>
      ) : null}

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

      <div className="grid gap-4 md:grid-cols-3">
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
        <div className="grid gap-2 text-sm font-bold text-slate-700">
          НДС
          <div className="flex h-12 items-center rounded-lg border border-slate-200 bg-slate-50 px-4 font-normal text-slate-700">
            22%
          </div>
        </div>
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

      <ProductImageFields
        existingGalleryImageName="existingGalleryImageFileIds"
        galleryImages={product?.galleryImages}
        mainImageUrl={product?.mainImageUrl}
        productName={product?.name}
        onImageChange={refreshDirtyState}
      />

      {product?.isPublished ? (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
          После отправки текущая опубликованная версия останется в каталоге.
          Новые данные применятся только после модерации администратора.
        </div>
      ) : null}

      <ProductSubmitButton
        confirmMessage={
          product?.isPublished
            ? "Отправить изменения на модерацию? Текущая опубликованная версия останется в продаже до решения администратора."
            : undefined
        }
        disabled={isSubmitDisabled}
      >
        {submitText}
      </ProductSubmitButton>
    </form>
  );
}
