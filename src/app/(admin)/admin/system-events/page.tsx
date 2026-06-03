import { and, desc, eq, ilike, or } from "drizzle-orm";
import { AlertTriangle, Info, Search } from "lucide-react";
import Link from "next/link";

import { db } from "@/db";
import { systemEvents } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";

const severityOptions = ["info", "warn", "error"] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getParam(search: Awaited<SearchParams>, key: string) {
  const value = search[key];
  return typeof value === "string" ? value.trim() : "";
}

function getSeverityLabel(severity: string) {
  if (severity === "error") {
    return "Ошибка";
  }

  if (severity === "warn") {
    return "Предупреждение";
  }

  if (severity === "info") {
    return "Информация";
  }

  return severity;
}

function getSeverityClassName(severity: string) {
  if (severity === "error") {
    return "bg-red-50 text-red-700";
  }

  if (severity === "warn") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-blue-50 text-[#1157ff]";
}

function stringifyMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "—";
  }

  return JSON.stringify(metadata, null, 2);
}

export default async function AdminSystemEventsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requireUser(["admin"]);
  const search = (await searchParams) ?? {};
  const q = getParam(search, "q");
  const severity = getParam(search, "severity");
  const type = getParam(search, "type");
  const whereConditions = [];

  if (q) {
    whereConditions.push(
      or(ilike(systemEvents.message, `%${q}%`), ilike(systemEvents.type, `%${q}%`)),
    );
  }

  if (type) {
    whereConditions.push(ilike(systemEvents.type, `%${type}%`));
  }

  if (severityOptions.includes(severity as (typeof severityOptions)[number])) {
    whereConditions.push(eq(systemEvents.severity, severity));
  }

  const eventsQuery = db.select().from(systemEvents);
  const events =
    whereConditions.length > 0
      ? await eventsQuery
          .where(and(...whereConditions))
          .orderBy(desc(systemEvents.createdAt))
          .limit(200)
      : await eventsQuery.orderBy(desc(systemEvents.createdAt)).limit(200);

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
          <span>Системные события</span>
        </div>

        <div>
          <Link className="text-sm font-bold text-[#1157ff]" href="/admin">
            ← Админ-панель
          </Link>
          <h1 className="mt-3 text-3xl font-black text-slate-950">
            Системные события
          </h1>
          <p className="mt-2 text-slate-600">
            Ошибки и технические события генерации счетов, email, Telegram,
            импорта и других внутренних операций.
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
              placeholder="Поиск по сообщению или типу"
            />
          </label>
          <input
            className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
            defaultValue={type}
            name="type"
            placeholder="Тип события"
          />
          <select
            className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-bold outline-none transition focus:border-[#1157ff]"
            defaultValue={severity}
            name="severity"
          >
            <option value="">Все уровни</option>
            {severityOptions.map((option) => (
              <option key={option} value={option}>
                {getSeverityLabel(option)}
              </option>
            ))}
          </select>
          <button className="h-11 rounded-lg bg-[#1157ff] px-5 text-sm font-bold text-white transition hover:bg-[#0b49e0]">
            Найти
          </button>
        </form>

        <section className="mt-6 grid gap-3">
          {events.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center rounded-xl bg-white text-sm font-bold text-slate-500 shadow-sm ring-1 ring-slate-200">
              Событий пока нет.
            </div>
          ) : null}

          {events.map((event) => (
            <article
              className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
              key={event.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex gap-3">
                  <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${getSeverityClassName(event.severity)}`}
                  >
                    {event.severity === "error" ? (
                      <AlertTriangle size={22} />
                    ) : (
                      <Info size={22} />
                    )}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${getSeverityClassName(event.severity)}`}
                      >
                        {getSeverityLabel(event.severity)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {event.type}
                      </span>
                    </div>
                    <h2 className="mt-3 text-lg font-black text-slate-950">
                      {event.message}
                    </h2>
                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      {formatDateTime(event.createdAt)}
                    </p>
                  </div>
                </div>
              </div>

              <pre className="mt-4 max-h-72 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                {stringifyMetadata(event.metadata)}
              </pre>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
