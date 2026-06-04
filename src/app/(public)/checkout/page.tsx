import { AlertTriangle, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/db";
import { buyerCompanies } from "@/db/schema";
import { getCompanyDocumentReadiness } from "@/lib/account/company-documents";
import { getCompanyMissingFields } from "@/lib/account/company-validation";
import { createOrderAction } from "@/lib/orders/actions";
import { requireUser } from "@/lib/auth/session";
import { getCurrentCart } from "@/lib/cart/queries";
import { formatCurrency } from "@/lib/utils";
import { eq } from "drizzle-orm";

type CheckoutPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Оформление заказа — Сити Маркет",
  description:
    "Оформление B2B-заказа в Сити Маркет с проверкой реквизитов компании и обязательных документов.",
};

const errorMessages: Record<string, string> = {
  company: "К аккаунту не привязана компания. Оформление заказа недоступно.",
  company_details: "Заполните обязательные данные компании перед оформлением.",
  company_documents:
    "Загрузите документы компании, чтобы менеджер мог быстрее обработать заказ.",
  company_blocked: "Компания заблокирована. Оформление заказа недоступно.",
};

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const user = await requireUser(["buyer"]);
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : undefined;
  const [cart, company, documentReadiness] = await Promise.all([
    getCurrentCart(),
    user.buyerCompanyId
      ? db
          .select({
            type: buyerCompanies.type,
            name: buyerCompanies.name,
            inn: buyerCompanies.inn,
            kpp: buyerCompanies.kpp,
            ogrn: buyerCompanies.ogrn,
            directorName: buyerCompanies.directorName,
            legalAddress: buyerCompanies.legalAddress,
            bankDetails: buyerCompanies.bankDetails,
            contactEmail: buyerCompanies.contactEmail,
            contactPhone: buyerCompanies.contactPhone,
            status: buyerCompanies.status,
          })
          .from(buyerCompanies)
          .where(eq(buyerCompanies.id, user.buyerCompanyId))
          .limit(1)
      : Promise.resolve([]),
    user.buyerCompanyId
      ? getCompanyDocumentReadiness(user.buyerCompanyId)
      : Promise.resolve(null),
  ]);
  const companyMissingFields = company[0]
    ? getCompanyMissingFields(company[0])
    : ["Компания"];
  const isCompanyReady = companyMissingFields.length === 0;
  const isCompanyBlocked = company[0]?.status === "blocked";
  const missingCompanyDocuments = documentReadiness?.missingTypes ?? [];
  const areCompanyDocumentsReady = documentReadiness?.isReady ?? false;

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-5 py-6 text-slate-900">
      <div className="mx-auto max-w-[1280px]">
        <Link href="/cart" className="text-sm font-bold text-[#1157ff]">
          ← Вернуться в корзину
        </Link>
        <h1 className="mt-3 text-3xl font-black text-slate-950">
          Оформление заказа
        </h1>
        <p className="mt-2 text-slate-600">
          Заказ уйдет в обработку, а счет на оплату будет сформирован
          автоматически.
        </p>
        <p className="mt-2 text-sm font-semibold text-slate-600">
          Доставка и условия получения заказа согласовываются с менеджером после
          оформления заказа.
        </p>

        {error ? (
          <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {errorMessages[error] ?? "Не удалось оформить заказ."}
          </div>
        ) : null}

        {cart.lines.length === 0 ? (
          <section className="mt-8 flex min-h-[360px] items-center justify-center rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-100">
            <div>
              <ShoppingCart className="mx-auto text-slate-300" size={56} />
              <h2 className="mt-5 text-2xl font-black text-slate-950">
                Корзина пуста
              </h2>
              <p className="mt-2 text-slate-600">
                Добавьте товары перед оформлением заказа.
              </p>
              <Link
                className="mt-6 inline-flex rounded-lg bg-[#1157ff] px-5 py-3 font-bold text-white"
                href="/catalog"
              >
                Перейти в каталог
              </Link>
            </div>
          </section>
        ) : (
          <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_360px]">
            <section className="self-start overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
              <div className="divide-y divide-slate-100">
                {cart.lines.map((line) => (
                  <article
                    key={line.id}
                    className="grid items-start gap-4 p-5 md:grid-cols-[80px_1fr_auto]"
                  >
                    <div className="flex aspect-square items-center justify-center rounded-lg bg-slate-100">
                      <ShoppingCart className="text-slate-300" size={30} />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-950">
                        {line.name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {line.sku} · {line.categoryName} · {line.unit}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        НДС {Number(line.vatRate ?? 22)}%:{" "}
                        {formatCurrency(line.vatAmount)}
                      </p>
                      {!line.isActive ? (
                        <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
                          <AlertTriangle size={16} />
                          Товар больше недоступен
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black">
                        {formatCurrency(line.lineTotal)}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-500">
                        {Number(line.quantity)} × {formatCurrency(line.priceWithVat)}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="self-start rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <h2 className="text-xl font-black text-slate-950">Итого</h2>
              <div className="mt-5 grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Количество</span>
                  <span className="font-bold">{cart.count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Сумма с НДС</span>
                  <span className="font-black">{formatCurrency(cart.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Итоговая сумма НДС</span>
                  <span className="font-bold">{formatCurrency(cart.vatTotal)}</span>
                </div>
              </div>

              {!isCompanyReady ? (
                <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-black">
                    Заполните реквизиты компании перед заказом
                  </p>
                  <ul className="mt-3 list-disc space-y-1 pl-5">
                    {companyMissingFields.map((field) => (
                      <li key={field}>{field}</li>
                    ))}
                  </ul>
                  <Link
                    className="mt-4 inline-flex rounded-lg bg-[#1157ff] px-4 py-3 font-bold text-white"
                    href="/account/company?next=/checkout"
                  >
                    Заполнить данные
                  </Link>
                </div>
              ) : null}

              {isCompanyBlocked ? (
                <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                  <p className="font-black">Компания заблокирована</p>
                  <p className="mt-2">
                    Оформление заказа недоступно до разблокировки компании
                    администратором.
                  </p>
                </div>
              ) : null}

              {!areCompanyDocumentsReady ? (
                <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-black">
                    Документы компании помогут быстрее обработать заказ
                  </p>
                  <ul className="mt-3 list-disc space-y-1 pl-5">
                    {missingCompanyDocuments.map((document) => (
                      <li key={document.type}>{document.label}</li>
                    ))}
                  </ul>
                  <Link
                    className="mt-4 inline-flex rounded-lg bg-[#1157ff] px-4 py-3 font-bold text-white"
                    href="/account/documents"
                  >
                    Перейти к документам
                  </Link>
                </div>
              ) : null}

              <form action={createOrderAction} className="mt-6 grid gap-4">
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  Комментарий к заказу
                  <textarea
                    className="min-h-24 rounded-lg border border-slate-200 px-3 py-2 font-normal text-slate-950"
                    name="comment"
                    placeholder="Например, детали по доставке или внутренний номер закупки"
                  />
                </label>
                <SubmitButton
                  className="h-12 rounded-lg bg-[#1157ff] font-bold text-white transition hover:bg-[#0b49e0] disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={
                    !isCompanyReady ||
                    isCompanyBlocked ||
                    cart.lines.some((line) => !line.isActive)
                  }
                  pendingText="Создаем заказ"
                >
                  Подтвердить заказ
                </SubmitButton>
              </form>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
