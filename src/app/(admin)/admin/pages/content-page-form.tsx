import { SubmitButton } from "@/components/ui/submit-button";
import {
  createContentPageAction,
  updateContentPageAction,
} from "@/lib/admin/content-actions";

type ContentPageFormProps = {
  page?: {
    id: string;
    title: string;
    slug: string;
    content: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
    isPublished: boolean;
  };
};

export function ContentPageForm({ page }: ContentPageFormProps) {
  const isEdit = Boolean(page);

  return (
    <form
      action={isEdit ? updateContentPageAction : createContentPageAction}
      className="grid gap-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
    >
      {page ? <input name="pageId" type="hidden" value={page.id} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Заголовок
          <input
            className="h-11 rounded-lg border border-slate-200 px-3 font-normal text-slate-950"
            name="title"
            required
            defaultValue={page?.title ?? ""}
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          URL slug
          <input
            className="h-11 rounded-lg border border-slate-200 px-3 font-normal text-slate-950"
            name="slug"
            placeholder="faq"
            defaultValue={page?.slug ?? ""}
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Текст страницы
        <textarea
          className="min-h-[320px] rounded-lg border border-slate-200 px-3 py-2 font-normal leading-7 text-slate-950"
          name="content"
          defaultValue={page?.content ?? ""}
        />
      </label>

      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Meta title
        <input
          className="h-11 rounded-lg border border-slate-200 px-3 font-normal text-slate-950"
          name="metaTitle"
          defaultValue={page?.metaTitle ?? ""}
        />
      </label>

      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Meta description
        <textarea
          className="min-h-24 rounded-lg border border-slate-200 px-3 py-2 font-normal text-slate-950"
          name="metaDescription"
          defaultValue={page?.metaDescription ?? ""}
        />
      </label>

      <label className="inline-flex items-center gap-3 text-sm font-bold text-slate-700">
        <input
          className="h-5 w-5"
          name="isPublished"
          type="checkbox"
          defaultChecked={page?.isPublished ?? true}
        />
        Опубликована
      </label>

      <SubmitButton className="h-12 rounded-lg bg-[#1157ff] font-bold text-white transition hover:bg-[#0b49e0] disabled:bg-slate-300">
        Сохранить
      </SubmitButton>
    </form>
  );
}
