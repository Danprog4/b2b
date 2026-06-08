import { and, desc, eq, ilike, or } from "drizzle-orm";
import { Search } from "lucide-react";
import Link from "next/link";

import { db } from "@/db";
import { auditEvents, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getParam(search: Awaited<SearchParams>, key: string) {
  const value = search[key];
  return typeof value === "string" ? value.trim() : "";
}

function stringifyMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "—";
  }

  return JSON.stringify(metadata, null, 2);
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requireUser(["admin"]);
  const search = (await searchParams) ?? {};
  const q = getParam(search, "q");
  const action = getParam(search, "action");
  const entityType = getParam(search, "entityType");
  const whereConditions = [];

  if (q) {
    whereConditions.push(
      or(
        ilike(auditEvents.action, `%${q}%`),
        ilike(auditEvents.entityType, `%${q}%`),
        ilike(users.email, `%${q}%`),
      ),
    );
  }

  if (action) {
    whereConditions.push(ilike(auditEvents.action, `%${action}%`));
  }

  if (entityType) {
    whereConditions.push(ilike(auditEvents.entityType, `%${entityType}%`));
  }

  const eventsQuery = db
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      entityType: auditEvents.entityType,
      entityId: auditEvents.entityId,
      metadata: auditEvents.metadata,
      createdAt: auditEvents.createdAt,
      actorEmail: users.email,
      actorName: users.name,
      actorRole: users.role,
    })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorId));
  const events =
    whereConditions.length > 0
      ? await eventsQuery
          .where(and(...whereConditions))
          .orderBy(desc(auditEvents.createdAt))
          .limit(200)
      : await eventsQuery.orderBy(desc(auditEvents.createdAt)).limit(200);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-[1480px]">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/">
            Главная
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/admin">
            Админ-панель
          </Link>
          <span>/</span>
          <span>Audit log</span>
        </div>

        <div>
          <Link className="text-sm font-bold text-[#1157ff]" href="/admin">
            ← Админ-панель
          </Link>
          <h1 className="mt-3 text-3xl font-black text-slate-950">
            Audit log
          </h1>
          <p className="mt-2 text-slate-600">
            Критические действия пользователей и администраторов: заказы,
            документы, товары, договоры, импорт, чат и настройки контента.
          </p>
        </div>

        <form className="mt-6 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:grid-cols-[1fr_220px_220px_auto]">
          <label className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
              defaultValue={q}
              name="q"
              placeholder="Поиск по действию, сущности или email"
            />
          </label>
          <input
            className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"
            defaultValue={action}
            name="action"
            placeholder="Действие"
          />
          <input
            className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"
            defaultValue={entityType}
            name="entityType"
            placeholder="Сущность"
          />
          <button className="h-11 rounded-lg bg-[#1157ff] px-5 text-sm font-bold text-white transition hover:bg-[#0b49e0]">
            Найти
          </button>
        </form>

        <section className="mt-5 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          {events.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center text-sm font-bold text-slate-500">
              Событий не найдено.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {events.map((event) => (
                <article className="p-4" key={event.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-black text-slate-950">
                        {event.action}
                      </h2>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {event.entityType}
                        {event.entityId ? ` · ${event.entityId}` : ""}
                      </p>
                    </div>
                    <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">
                      {formatDateTime(event.createdAt)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 text-sm lg:grid-cols-[260px_1fr]">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="font-black text-slate-700">Actor</p>
                      <p className="mt-1 text-slate-600">
                        {event.actorName || event.actorEmail || "Система"}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-400">
                        {event.actorRole ?? "system"}
                      </p>
                    </div>
                    <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                      {stringifyMetadata(event.metadata)}
                    </pre>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
