import { desc, eq } from "drizzle-orm";
import Link from "next/link";

import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/db";
import { buyerCompanies, companyJoinRequests, users } from "@/db/schema";
import {
  approveCompanyJoinRequest,
  rejectCompanyJoinRequest,
} from "@/lib/admin/company-join-actions";

function formatDate(value: Date | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function statusLabel(status: string) {
  if (status === "pending") {
    return "На рассмотрении";
  }

  if (status === "approved") {
    return "Подтверждена";
  }

  if (status === "rejected") {
    return "Отклонена";
  }

  return status;
}

export default async function CompanyJoinRequestsPage() {
  const requests = await db
    .select({
      requestId: companyJoinRequests.id,
      status: companyJoinRequests.status,
      createdAt: companyJoinRequests.createdAt,
      reviewedAt: companyJoinRequests.reviewedAt,
      userName: users.name,
      userEmail: users.email,
      userPhone: users.phone,
      companyName: buyerCompanies.name,
      companyInn: buyerCompanies.inn,
    })
    .from(companyJoinRequests)
    .innerJoin(users, eq(companyJoinRequests.userId, users.id))
    .innerJoin(
      buyerCompanies,
      eq(companyJoinRequests.buyerCompanyId, buyerCompanies.id),
    )
    .orderBy(desc(companyJoinRequests.createdAt));

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-[1480px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link className="text-sm font-bold text-[#1157ff]" href="/admin">
              ← Админ-панель
            </Link>
            <h1 className="mt-3 text-3xl font-black text-slate-950">
              Заявки на присоединение
            </h1>
            <p className="mt-2 max-w-3xl text-slate-600">
              Пользователь с существующим ИНН не получает доступ к компании
              автоматически. Администратор должен подтвердить или отклонить
              заявку.
            </p>
          </div>
          <span className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">
            Всего: {requests.length}
          </span>
        </div>

        <div className="mt-8 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full min-w-[1000px] border-collapse text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">Пользователь</th>
                <th className="px-5 py-4">Компания</th>
                <th className="px-5 py-4">Статус</th>
                <th className="px-5 py-4">Создана</th>
                <th className="px-5 py-4">Рассмотрена</th>
                <th className="px-5 py-4">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {requests.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={6}>
                    Заявок пока нет.
                  </td>
                </tr>
              ) : null}

              {requests.map((request) => (
                <tr key={request.requestId} className="align-top">
                  <td className="px-5 py-4">
                    <div className="font-bold text-slate-950">
                      {request.userName || "Без имени"}
                    </div>
                    <div className="mt-1 text-slate-500">{request.userEmail}</div>
                    <div className="mt-1 text-slate-500">
                      {request.userPhone || "Телефон не указан"}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-bold text-slate-950">
                      {request.companyName}
                    </div>
                    <div className="mt-1 text-slate-500">ИНН {request.companyInn}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      {statusLabel(request.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {formatDate(request.createdAt)}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {formatDate(request.reviewedAt)}
                  </td>
                  <td className="px-5 py-4">
                    {request.status === "pending" ? (
                      <div className="flex flex-wrap gap-2">
                        <form action={approveCompanyJoinRequest}>
                          <input
                            name="requestId"
                            type="hidden"
                            value={request.requestId}
                          />
                          <SubmitButton
                            className="rounded-lg bg-[#1157ff] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
                            pendingText="Подтверждаем"
                          >
                            Подтвердить
                          </SubmitButton>
                        </form>
                        <form action={rejectCompanyJoinRequest}>
                          <input
                            name="requestId"
                            type="hidden"
                            value={request.requestId}
                          />
                          <SubmitButton
                            className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200 transition hover:text-red-600"
                            pendingText="Отклоняем"
                          >
                            Отклонить
                          </SubmitButton>
                        </form>
                      </div>
                    ) : (
                      <span className="text-slate-400">Нет действий</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
