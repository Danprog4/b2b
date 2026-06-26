import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

type RequestSentPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CompanyJoinRequestSentPage({
  searchParams,
}: RequestSentPageProps) {
  const params = (await searchParams) ?? {};
  const already = params.already === "1";
  const resubmitted = params.resubmitted === "1";
  const title = already
    ? "Заявка уже отправлена"
    : "Заявка на присоединение отправлена";
  const description = resubmitted
    ? "Мы отправили повторную заявку администратору компании. После подтверждения вы сможете войти в личный кабинет."
    : already
      ? "Администратор компании уже получил вашу заявку. После подтверждения доступ к личному кабинету откроется автоматически."
      : "Администратор компании получил вашу заявку. После подтверждения вы сможете войти в личный кабинет и оформлять заказы.";

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-5 py-10">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-100">
        <Link
          href="/"
          className="inline-flex text-2xl font-black text-[#1157ff]"
        >
          Сити Маркет
        </Link>

        <div className="mx-auto mt-8 flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 size={34} />
        </div>

        <h1 className="mt-6 text-3xl font-black text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>

        <Link
          href="/"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-lg bg-[#1157ff] px-6 font-bold text-white transition hover:bg-[#0b49e0]"
        >
          Вернуться на главную
        </Link>
      </div>
    </main>
  );
}
