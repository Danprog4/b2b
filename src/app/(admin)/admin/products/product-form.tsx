import { ProductImageFields } from "@/components/products/product-image-fields";
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
          required
          className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
          defaultValue={product?.sellerId ?? ""}
        >
          <option value="">Выберите продавца</option>
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

      <ProductImageFields
        clearMainImageAction={clearProductMainImageAction}
        galleryImages={product?.galleryImages}
        mainImageUrl={product?.mainImageUrl}
        productName={product?.name}
        removeExistingGalleryImageAction={removeProductGalleryImageAction}
      />

      <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-700">
        <label className="flex items-center gap-3">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={product?.isActive ?? true}
          />
          Активен в каталоге
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
