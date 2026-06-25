"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function getDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getPeriodHref(days: number) {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);
  const params = new URLSearchParams({
    from: getDateInputValue(startDate),
    to: getDateInputValue(endDate),
  });

  return `/admin?${params.toString()}`;
}

export function PeriodPicker({
  endDateValue,
  periodLabel,
  startDateValue,
}: {
  endDateValue: string;
  periodLabel: string;
  startDateValue: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-expanded={isOpen}
        className="flex h-8 cursor-pointer items-center rounded-lg bg-slate-100 px-3 text-xs font-black uppercase tracking-wide text-slate-500 transition hover:bg-slate-200 hover:text-[#1157ff]"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        {periodLabel}
      </button>
      <div
        className={`absolute right-0 top-10 z-20 w-80 origin-top-right rounded-lg bg-white p-4 shadow-xl ring-1 ring-slate-200 transition duration-150 ${
          isOpen
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1 scale-95 opacity-0"
        }`}
      >
        <div className="grid grid-cols-3 gap-2">
          {[7, 14, 30].map((days) => (
            <Link
              className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-100 text-sm font-black text-slate-700 transition hover:bg-[#1157ff] hover:text-white"
              href={getPeriodHref(days)}
              key={days}
              onClick={() => setIsOpen(false)}
            >
              {days} дней
            </Link>
          ))}
        </div>

        <form className="mt-4 grid gap-3" method="get">
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Дата от
            <input
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
              defaultValue={startDateValue}
              name="from"
              type="date"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Дата до
            <input
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
              defaultValue={endDateValue}
              name="to"
              type="date"
            />
          </label>
          <button
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1157ff] px-4 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
            onClick={() => setIsOpen(false)}
            type="submit"
          >
            Применить
          </button>
        </form>
      </div>
    </div>
  );
}
