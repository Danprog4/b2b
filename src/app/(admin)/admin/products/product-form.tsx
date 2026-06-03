import { ImageIcon, X } from "lucide-react";

import { FileUploadField } from "@/components/ui/file-upload-field";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  clearProductMainImageAction,
  removeProductGalleryImageAction,
} from "@/lib/admin/product-actions";

type Option = {
  id: string;
  name: string;
  description?: string | null;
};

type ProductFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  product?: {
    id: string;
    sku: string;
    name: string;
    categoryId: string;
    subcategoryId: string | null;
    sellerId: string | null;
    priceWithVat: string;
    vatRate: string | null;
    size: string | null;
    unit: string;
    description: string | null;
    isPopular: boolean;
    isActive: boolean;
    mainImageUrl?: string | null;
    galleryImages?: Array<{
      id: string;
      url: string | null;
      fileName: string;
    }>;
  };
  categories: Option[];
  subcategories: Array<Option & { categoryName: string }>;
  sellers: Option[];
  submitText: string;
};

export function ProductForm({
  action,
  product,
  categories,
  subcategories,
  sellers,
  submitText,
}: ProductFormProps) {
  return (
    <form action={action} className="grid gap-5">
      {product ? <input name="productId" type="hidden" value={product.id} /> : null}

      {product ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm">
          <span className="font-bold text-slate-500">Артикул</span>
          <p className="mt-1 text-lg font-black text-slate-950">{product.sku}</p>
        </div>
      ) : null}

      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Название товара
        <input
          name="name"
          required
          className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
          defaultValue={product?.name ?? ""}
          placeholder="Например, Лист стальной 2 мм"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Категория
          <select
            name="categoryId"
            required
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            defaultValue={product?.categoryId ?? ""}
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
            name="subcategoryId"
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            defaultValue={product?.subcategoryId ?? ""}
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

      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Продавец
        <select
          name="sellerId"
          className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
          defaultValue={product?.sellerId ?? ""}
        >
          <option value="">Не привязан</option>
          {sellers.map((seller) => (
            <option key={seller.id} value={seller.id}>
              {seller.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 md:grid-cols-4">
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Цена с НДС
          <input
            name="priceWithVat"
            required
            inputMode="decimal"
            min="0"
            step="0.01"
            type="number"
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            defaultValue={product?.priceWithVat ?? ""}
            placeholder="12400"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          НДС, %
          <input
            name="vatRate"
            inputMode="decimal"
            min="0"
            step="0.01"
            type="number"
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            defaultValue={product?.vatRate ?? "22.00"}
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Размер
          <input
            name="size"
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            defaultValue={product?.size ?? ""}
            placeholder="2 мм"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Единица
          <input
            name="unit"
            required
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            defaultValue={product?.unit ?? ""}
            placeholder="шт"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Описание
        <textarea
          name="description"
          rows={5}
          className="rounded-lg border border-slate-200 px-4 py-3 font-normal text-slate-950"
          defaultValue={product?.description ?? ""}
        />
      </label>

      <section className="grid gap-4 rounded-xl bg-slate-50 p-4">
        <div>
          <h2 className="text-base font-black text-slate-950">Изображения</h2>
          <p className="mt-1 text-sm font-normal leading-6 text-slate-600">
            Главное фото показывается в каталоге и первым на карточке товара.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
            {product?.mainImageUrl ? (
              <img
                alt={product.name}
                className="h-52 w-full object-cover"
                src={product.mainImageUrl}
              />
            ) : (
              <div className="flex h-52 items-center justify-center bg-slate-100 text-slate-300">
                <ImageIcon size={44} />
              </div>
            )}
          </div>

          <div className="grid content-start gap-3">
            <FileUploadField
              accept="image/jpeg,image/png,image/webp"
              buttonText={product?.mainImageUrl ? "Заменить главное фото" : "Загрузить главное фото"}
              name="mainImage"
            />
            {product?.mainImageUrl ? (
              <button
                className="inline-flex h-10 w-fit items-center justify-center rounded-lg bg-red-50 px-4 text-sm font-bold text-red-600 transition hover:bg-red-100"
                formAction={clearProductMainImageAction}
                type="submit"
              >
                Удалить главное фото
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3">
          <FileUploadField
            accept="image/jpeg,image/png,image/webp"
            buttonText="Загрузить фото галереи"
            multiple
            name="galleryImages"
          />

          {product?.galleryImages && product.galleryImages.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {product.galleryImages.map((image) => (
                <div
                  className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200"
                  key={image.id}
                >
                  {image.url ? (
                    <img
                      alt={image.fileName}
                      className="h-36 w-full object-cover"
                      src={image.url}
                    />
                  ) : (
                    <div className="flex h-36 items-center justify-center bg-slate-100 text-slate-300">
                      <ImageIcon size={34} />
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 p-3">
                    <span className="min-w-0 truncate text-xs font-bold text-slate-500">
                      {image.fileName}
                    </span>
                    <button
                      aria-label="Удалить фото"
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100"
                      formAction={removeProductGalleryImageAction}
                      name="productImageId"
                      type="submit"
                      value={image.id}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-700 md:grid-cols-2">
        <label className="flex items-center gap-3">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={product?.isActive ?? true}
          />
          Активен в каталоге
        </label>
        <label className="flex items-center gap-3">
          <input name="isPopular" type="checkbox" defaultChecked={product?.isPopular} />
          Популярный товар
        </label>
      </div>

      <SubmitButton
        className="h-12 justify-self-start rounded-lg bg-[#1157ff] px-6 font-bold text-white transition hover:bg-[#0b49e0]"
        pendingText="Сохраняем"
      >
        {submitText}
      </SubmitButton>
    </form>
  );
}
