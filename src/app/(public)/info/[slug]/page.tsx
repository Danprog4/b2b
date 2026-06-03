import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPublishedContentPage } from "@/lib/content/queries";

type InfoPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: InfoPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedContentPage(slug);

  if (!page) {
    return {
      title: "Страница не найдена | Сити Маркет",
    };
  }

  return {
    title: page.metaTitle || `${page.title} | Сити Маркет`,
    description: page.metaDescription || page.content?.slice(0, 160) || undefined,
  };
}

export default async function InfoPage({ params }: InfoPageProps) {
  const { slug } = await params;
  const page = await getPublishedContentPage(slug);

  if (!page) {
    notFound();
  }

  const paragraphs =
    page.content
      ?.split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean) ?? [];

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-5 py-6 text-slate-900">
      <div className="mx-auto max-w-[980px]">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/">
            Главная
          </Link>
          <span>/</span>
          <span>{page.title}</span>
        </div>

        <Link className="text-sm font-bold text-[#1157ff]" href="/">
          ← Главная
        </Link>

        <article className="mt-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 md:p-8">
          <h1 className="text-3xl font-black text-slate-950 md:text-4xl">
            {page.title}
          </h1>
          <div className="mt-7 grid gap-5 text-base leading-8 text-slate-700">
            {paragraphs.length > 0 ? (
              paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
            ) : (
              <p>Текст страницы будет добавлен позже.</p>
            )}
          </div>
        </article>
      </div>
    </main>
  );
}
