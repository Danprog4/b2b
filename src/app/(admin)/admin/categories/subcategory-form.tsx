import { ImageIcon } from "lucide-react";

import { FileUploadField } from "@/components/ui/file-upload-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { clearSubcategoryImageAction } from "@/lib/admin/category-actions";

type CategoryOption = {
  id: string;
  name: string;
};

type SubcategoryFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  categories: CategoryOption[];
  subcategory?: {
    id: string;
    categoryId: string;
    name: string;
    slug: string;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
    imageUrl?: string | null;
  };
  submitText: string;
};

export function SubcategoryForm({
  action,
  categories,
  subcategory,
  submitText,
}: SubcategoryFormProps) {
  return (
    <form action={action} className="grid gap-5">
      {subcategory ? (
        <input name="subcategoryId" type="hidden" value={subcategory.id} />
      ) : null}
      {subcategory ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm">
          <span className="font-bold text-slate-500">Slug</span>
          <p className="mt-1 text-lg font-black text-slate-950">
            {subcategory.slug}
          </p>
        </div>
      ) : null}
      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Родительская категория
        <select
          name="categoryId"
          required
          className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
          defaultValue={subcategory?.categoryId ?? ""}
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
        Название
        <input
          name="name"
          required
          className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
          defaultValue={subcategory?.name ?? ""}
        />
      </label>
      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Описание
        <textarea
          name="description"
          rows={4}
          className="rounded-lg border border-slate-200 px-4 py-3 font-normal text-slate-950"
          defaultValue={subcategory?.description ?? ""}
        />
      </label>

      <section className="grid gap-4 rounded-xl bg-slate-50 p-4">
        <div>
          <h2 className="text-base font-black text-slate-950">Изображение</h2>
          <p className="mt-1 text-sm font-normal leading-6 text-slate-600">
            Используется в каталоге и навигации по подкатегориям.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <div className="flex h-32 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
            {subcategory?.imageUrl ? (
              <img
                alt={subcategory.name}
                className="h-full w-full object-cover"
                src={subcategory.imageUrl}
              />
            ) : (
              <ImageIcon className="text-slate-300" size={38} />
            )}
          </div>
          <div className="grid content-start gap-3">
            <FileUploadField
              accept="image/jpeg,image/png,image/webp"
              buttonText={
                subcategory?.imageUrl ? "Заменить изображение" : "Загрузить изображение"
              }
              name="image"
            />
            {subcategory?.imageUrl ? (
              <button
                className="inline-flex h-10 w-fit items-center justify-center rounded-lg bg-red-50 px-4 text-sm font-bold text-red-600 transition hover:bg-red-100"
                formAction={clearSubcategoryImageAction}
                type="submit"
              >
                Удалить изображение
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Порядок
          <input
            name="sortOrder"
            type="number"
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            defaultValue={subcategory?.sortOrder ?? 0}
          />
        </label>
        <label className="flex items-center gap-3 self-end rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-700">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={subcategory?.isActive ?? true}
          />
          Активна в каталоге
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
