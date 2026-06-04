"use client";

import { ImageIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { FileUploadField } from "@/components/ui/file-upload-field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { BannerLinkSuggestion } from "@/lib/admin/banner-link-suggestions";
import {
  createBannerAction,
  updateBannerAction,
} from "@/lib/admin/content-actions";

type BannerFormProps = {
  banner?: {
    id: string;
    title: string;
    headline: string | null;
    subheadline: string | null;
    ctaText: string | null;
    href: string | null;
    sortOrder: number;
    isActive: boolean;
    startsAt: Date | string | null;
    endsAt: Date | string | null;
    desktopImageUrl: string | null;
    mobileImageUrl: string | null;
  };
  defaultStartsAt?: string;
  defaultEndsAt?: string;
  linkSuggestions?: BannerLinkSuggestion[];
  occupiedOrders?: Array<{
    bannerId: string;
    sortOrder: number;
    title: string;
  }>;
};

const bannerOrderSlots = [1, 2, 3, 4];

function dateTimeLocalValue(value: Date | string | null) {
  if (!value) {
    return "";
  }

  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (item: number) => item.toString().padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-").concat(
    "T",
    [pad(date.getHours()), pad(date.getMinutes())].join(":"),
  );
}

function PreviewPlaceholder() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-slate-300">
      <ImageIcon size={34} />
    </div>
  );
}

function BannerPreview({
  mode,
  title,
  imageUrl,
  headline,
  subheadline,
  ctaText,
}: {
  mode: "desktop" | "mobile";
  title: string;
  imageUrl: string | null;
  headline: string;
  subheadline: string;
  ctaText: string;
}) {
  const isMobile = mode === "mobile";

  return (
    <div
      className={
        isMobile
          ? "relative mx-auto aspect-[9/14] w-full max-w-[260px] overflow-hidden rounded-[22px] bg-[#dff0ff] shadow-sm ring-1 ring-slate-200"
          : "relative aspect-[1480/420] w-full overflow-hidden rounded-2xl bg-[#dff0ff] shadow-sm ring-1 ring-slate-200"
      }
    >
      {imageUrl ? (
        <img alt={title} className="absolute inset-0 h-full w-full object-cover" src={imageUrl} />
      ) : (
        <PreviewPlaceholder />
      )}
      <div className="absolute inset-0 bg-white/45 backdrop-blur-[1px]" />
      <div className={isMobile ? "relative p-5" : "relative max-w-[62%] p-8"}>
        <h3
          className={
            isMobile
              ? "line-clamp-4 text-2xl font-black leading-tight text-slate-950"
              : "line-clamp-2 text-4xl font-black leading-tight text-slate-950"
          }
        >
          {title || "Название баннера"}
        </h3>
        {headline ? (
          <p
            className={
              isMobile
                ? "mt-3 line-clamp-3 text-base font-black leading-5 text-slate-900"
                : "mt-4 line-clamp-2 text-xl font-black leading-7 text-slate-900"
            }
          >
            {headline}
          </p>
        ) : null}
        {subheadline ? (
          <p
            className={
              isMobile
                ? "mt-3 line-clamp-4 text-sm leading-5 text-slate-600"
                : "mt-4 line-clamp-2 text-base leading-7 text-slate-600"
            }
          >
            {subheadline}
          </p>
        ) : null}
        {ctaText ? (
          <span
            className={
              isMobile
                ? "mt-5 inline-flex rounded-lg bg-[#1157ff] px-4 py-2.5 text-sm font-bold text-white"
                : "mt-6 inline-flex rounded-lg bg-[#1157ff] px-6 py-3 text-base font-bold text-white"
            }
          >
            {ctaText}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function BannerForm({
  banner,
  defaultStartsAt = "",
  defaultEndsAt = "",
  linkSuggestions = [],
  occupiedOrders = [],
}: BannerFormProps) {
  const isEdit = Boolean(banner);
  const initialSortOrder =
    banner?.sortOrder ??
    bannerOrderSlots.find(
      (slot) => !occupiedOrders.some((order) => order.sortOrder === slot),
    ) ??
    bannerOrderSlots[0];
  const [title, setTitle] = useState(banner?.title ?? "");
  const [headline, setHeadline] = useState(banner?.headline ?? "");
  const [subheadline, setSubheadline] = useState(banner?.subheadline ?? "");
  const [ctaText, setCtaText] = useState(banner?.ctaText ?? "");
  const [href, setHref] = useState(banner?.href ?? "");
  const [isHrefSuggestionsOpen, setIsHrefSuggestionsOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState(String(initialSortOrder));
  const [startsAt, setStartsAt] = useState(
    dateTimeLocalValue(banner?.startsAt ?? null) || defaultStartsAt,
  );
  const [endsAt, setEndsAt] = useState(
    dateTimeLocalValue(banner?.endsAt ?? null) || defaultEndsAt,
  );
  const [desktopUploadUrl, setDesktopUploadUrl] = useState<string | null>(null);
  const [mobileUploadUrl, setMobileUploadUrl] = useState<string | null>(null);

  const filteredGroupedSuggestions = useMemo(() => {
    const query = href.trim().toLowerCase();
    const filteredSuggestions =
      query === "/"
        ? linkSuggestions
        : linkSuggestions.filter((suggestion) =>
            suggestion.href.toLowerCase().startsWith(query),
          );
    const groups = new Map<string, BannerLinkSuggestion[]>();

    for (const suggestion of filteredSuggestions) {
      groups.set(suggestion.group, [
        ...(groups.get(suggestion.group) ?? []),
        suggestion,
      ]);
    }

    return Array.from(groups.entries());
  }, [href, linkSuggestions]);

  useEffect(() => {
    return () => {
      if (desktopUploadUrl) {
        URL.revokeObjectURL(desktopUploadUrl);
      }
    };
  }, [desktopUploadUrl]);

  useEffect(() => {
    return () => {
      if (mobileUploadUrl) {
        URL.revokeObjectURL(mobileUploadUrl);
      }
    };
  }, [mobileUploadUrl]);

  const desktopPreviewUrl = desktopUploadUrl ?? banner?.desktopImageUrl ?? null;
  const mobilePreviewUrl =
    mobileUploadUrl ?? banner?.mobileImageUrl ?? desktopPreviewUrl;
  const showHrefSuggestions =
    isHrefSuggestionsOpen &&
    href.startsWith("/") &&
    filteredGroupedSuggestions.length > 0;
  const occupiedOrderBySlot = new Map(
    occupiedOrders.map((order) => [order.sortOrder, order]),
  );

  return (
    <div className="grid gap-5">
      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950">
              Предпросмотр баннера
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Уменьшенный вид главного блока для desktop и mobile.
            </p>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Desktop
            </p>
            <BannerPreview
              ctaText={ctaText}
              headline={headline}
              imageUrl={desktopPreviewUrl}
              mode="desktop"
              subheadline={subheadline}
              title={title}
            />
          </div>

          <div className="grid gap-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Mobile
            </p>
            <BannerPreview
              ctaText={ctaText}
              headline={headline}
              imageUrl={mobilePreviewUrl}
              mode="mobile"
              subheadline={subheadline}
              title={title}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form
        action={isEdit ? updateBannerAction : createBannerAction}
        className="grid gap-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
      >
        {banner ? <input name="bannerId" type="hidden" value={banner.id} /> : null}

        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Название
          <input
            className="h-11 rounded-lg border border-slate-200 px-3 font-normal text-slate-950"
            name="title"
            required
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
          />
        </label>

        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Дополнительный заголовок
          <input
            className="h-11 rounded-lg border border-slate-200 px-3 font-normal text-slate-950"
            name="headline"
            value={headline}
            onChange={(event) => setHeadline(event.currentTarget.value)}
          />
        </label>

        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Подзаголовок
          <textarea
            className="min-h-28 rounded-lg border border-slate-200 px-3 py-2 font-normal text-slate-950"
            name="subheadline"
            value={subheadline}
            onChange={(event) => setSubheadline(event.currentTarget.value)}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            CTA
            <input
              className="h-11 rounded-lg border border-slate-200 px-3 font-normal text-slate-950"
              name="ctaText"
              placeholder="Перейти"
              value={ctaText}
              onChange={(event) => setCtaText(event.currentTarget.value)}
            />
          </label>
          <div className="relative grid gap-2 text-sm font-bold text-slate-700 md:col-span-2">
            <label className="grid gap-2">
              Ссылка
              <input
                className="h-11 rounded-lg border border-slate-200 px-3 font-normal text-slate-950"
                name="href"
                placeholder="/catalog или https://..."
                value={href}
                onBlur={() => setIsHrefSuggestionsOpen(false)}
                onChange={(event) => {
                  const nextHref = event.currentTarget.value;
                  setHref(nextHref);
                  setIsHrefSuggestionsOpen(nextHref.startsWith("/"));
                }}
                onFocus={(event) => {
                  setIsHrefSuggestionsOpen(event.currentTarget.value.startsWith("/"));
                }}
              />
            </label>
            {showHrefSuggestions ? (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 grid max-h-72 gap-3 overflow-y-auto rounded-lg bg-white p-3 shadow-xl ring-1 ring-slate-200">
                {filteredGroupedSuggestions.map(([group, suggestions]) => (
                  <div className="grid gap-2" key={group}>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                      {group}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {suggestions.map((suggestion) => (
                        <button
                          className="grid rounded-lg bg-white px-3 py-2 text-left text-sm transition hover:ring-2 hover:ring-[#1157ff]"
                          key={`${suggestion.group}-${suggestion.href}`}
                          type="button"
                          onClick={() => {
                            setHref(suggestion.href);
                            setIsHrefSuggestionsOpen(false);
                          }}
                          onMouseDown={(event) => event.preventDefault()}
                        >
                          <span className="truncate font-black text-slate-900">
                            {suggestion.label}
                          </span>
                          <span className="truncate font-mono text-xs font-bold text-[#1157ff]">
                            {suggestion.href}
                          </span>
                          {suggestion.description ? (
                            <span className="truncate text-xs font-semibold text-slate-500">
                              {suggestion.description}
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Порядок
            <select
              className="h-11 rounded-lg border border-slate-200 px-3 font-normal text-slate-950"
              name="sortOrder"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.currentTarget.value)}
            >
              {bannerOrderSlots.map((slot) => {
                const occupiedOrder = occupiedOrderBySlot.get(slot);
                const isOccupiedByAnother =
                  occupiedOrder && occupiedOrder.bannerId !== banner?.id;

                return (
                  <option
                    disabled={Boolean(isOccupiedByAnother)}
                    key={slot}
                    value={slot}
                  >
                    {slot}
                    {isOccupiedByAnother ? " (занят)" : ""}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Начало показа
            <input
              className="h-11 rounded-lg border border-slate-200 px-3 font-normal text-slate-950"
              name="startsAt"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.currentTarget.value)}
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Конец показа
            <input
              className="h-11 rounded-lg border border-slate-200 px-3 font-normal text-slate-950"
              name="endsAt"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.currentTarget.value)}
            />
          </label>
        </div>

        <label className="inline-flex items-center gap-3 text-sm font-bold text-slate-700">
          <input
            className="h-5 w-5"
            name="isActive"
            type="checkbox"
            defaultChecked={banner?.isActive ?? true}
          />
          Активен
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Desktop-изображение
            <FileUploadField
              accept="image/jpeg,image/png,image/webp"
              buttonText="Загрузить"
              initialFileLabel={banner?.desktopImageUrl ? "Desktop-файл выбран" : undefined}
              name="desktopImage"
              required={!isEdit}
              onFilesChange={(files) => {
                setDesktopUploadUrl(files[0] ? URL.createObjectURL(files[0]) : null);
              }}
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Mobile-изображение
            <FileUploadField
              accept="image/jpeg,image/png,image/webp"
              buttonText="Загрузить"
              initialFileLabel={banner?.mobileImageUrl ? "Mobile-файл выбран" : undefined}
              name="mobileImage"
              onFilesChange={(files) => {
                setMobileUploadUrl(files[0] ? URL.createObjectURL(files[0]) : null);
              }}
            />
          </label>
        </div>

        <SubmitButton className="h-12 rounded-lg bg-[#1157ff] font-bold text-white transition hover:bg-[#0b49e0] disabled:bg-slate-300">
          Сохранить
        </SubmitButton>
      </form>

      <aside className="grid content-start gap-4">
        <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">
            Файлы баннера
          </h2>
          <div className="grid gap-3 text-sm font-semibold text-slate-600">
            <div className="rounded-lg bg-slate-50 p-3">
              Desktop: {desktopPreviewUrl ? "изображение выбрано" : "не выбрано"}
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              Mobile: {mobilePreviewUrl ? "изображение выбрано" : "используется desktop"}
            </div>
          </div>
        </section>
      </aside>
      </div>
    </div>
  );
}
