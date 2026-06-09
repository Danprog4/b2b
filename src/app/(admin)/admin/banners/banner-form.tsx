"use client";

import { ArrowRight, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
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
    mobileTitle: string | null;
    headline: string | null;
    mobileHeadline: string | null;
    subheadline: string | null;
    mobileSubheadline: string | null;
    ctaText: string | null;
    mobileCtaText: string | null;
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
const bannerTextLimits = {
  title: 72,
  headline: 96,
  subheadline: 160,
  ctaText: 32,
  mobileTitle: 56,
  mobileHeadline: 72,
  mobileSubheadline: 120,
  mobileCtaText: 28,
  href: 320,
};
const demoBannerPreview = {
  title: "Стройматериалы для объектов",
  headline: "Цемент, металлопрокат и складские позиции от проверенных продавцов",
  subheadline:
    "Соберите закупку в корзине, получите счет Сити Маркета и ведите документы в личном кабинете.",
  ctaText: "Перейти в каталог",
};

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
    <div className="absolute inset-0 bg-slate-100">
      <div className="absolute right-8 top-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/70 text-slate-300 ring-1 ring-slate-200">
        <ImageIcon size={30} />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white/55 to-transparent" />
    </div>
  );
}

function TextCounter({ value, limit }: { value: string; limit: number }) {
  const isNearLimit = value.length > limit * 0.85;

  return (
    <span
      className={`text-xs font-semibold ${
        isNearLimit ? "text-amber-700" : "text-slate-400"
      }`}
    >
      {value.length}/{limit}
    </span>
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
  const hasImage = Boolean(imageUrl);
  const titleClass = hasImage
    ? "text-white drop-shadow-[0_2px_12px_rgba(2,6,23,0.45)]"
    : "text-slate-950";
  const headlineClass = hasImage ? "text-white/95" : "text-slate-900";
  const subheadlineClass = hasImage ? "text-white/80" : "text-slate-600";

  return (
    <div
      className={
        isMobile
          ? "relative mx-auto h-[400px] w-full max-w-[340px] overflow-hidden rounded-2xl bg-slate-100 shadow-sm ring-1 ring-slate-200"
          : "relative h-[460px] w-full overflow-hidden rounded-2xl bg-slate-100 shadow-sm ring-1 ring-slate-200"
      }
    >
      {imageUrl ? (
        <img alt={title} className="absolute inset-0 h-full w-full object-cover" src={imageUrl} />
      ) : (
        <PreviewPlaceholder />
      )}
      {hasImage ? (
        <>
          <div
            aria-hidden
            className={
              isMobile
                ? "absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent"
                : "absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/55 to-transparent"
            }
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[#1157ff]/10 mix-blend-multiply"
          />
        </>
      ) : null}
      <div
        className={
          isMobile
            ? "relative flex h-full items-stretch px-7 pb-14 pt-8"
            : "relative flex h-full items-center px-8 py-10 md:px-20 md:py-14"
        }
      >
        <div
          className={
            isMobile
              ? "flex h-full w-full flex-col"
              : "w-full max-w-[720px]"
          }
        >
          {!isMobile && headline ? (
            <span
              className={`mb-4 inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.16em] ${
                hasImage
                  ? "bg-white/15 text-white ring-1 ring-inset ring-white/25 backdrop-blur-sm"
                  : "bg-[#1157ff]/10 text-[#1157ff]"
              }`}
            >
              Сити Маркет
            </span>
          ) : null}
          <h3
            className={`${
              isMobile
                ? "line-clamp-3 text-3xl"
                : "line-clamp-3 text-5xl"
            } font-black leading-[1.05] tracking-tight ${titleClass}`}
          >
            {title || "Название баннера"}
          </h3>
          {headline ? (
            <p
              className={`mt-5 line-clamp-2 max-w-xl text-lg font-bold leading-7 ${headlineClass}`}
            >
              {headline}
            </p>
          ) : null}
          {subheadline ? (
            <p
              className={`mt-4 line-clamp-2 max-w-xl text-base leading-7 ${subheadlineClass}`}
            >
              {subheadline}
            </p>
          ) : null}
          {ctaText ? (
            <div className={isMobile ? "relative z-30 mt-auto flex pt-6" : "mt-8 flex"}>
              <span className="inline-flex items-center gap-2 rounded-xl bg-[#1157ff] px-6 py-3 text-base font-bold text-white shadow-lg shadow-[#1157ff]/25">
                {ctaText}
                <ArrowRight size={18} />
              </span>
            </div>
          ) : null}
        </div>
      </div>
      {!isMobile ? (
        <>
          <span className="absolute left-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-900 shadow-lg ring-1 ring-white/60 backdrop-blur">
            <ChevronLeft size={22} />
          </span>
          <span className="absolute right-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-900 shadow-lg ring-1 ring-white/60 backdrop-blur">
            <ChevronRight size={22} />
          </span>
        </>
      ) : null}
      <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2 rounded-full bg-slate-950/30 px-3 py-2 shadow-sm ring-1 ring-white/20 backdrop-blur">
        <span className="h-2.5 w-2.5 rounded-full bg-white/50" />
        <span className="h-2.5 w-7 rounded-full bg-white" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/50" />
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
  const [mobileTitle, setMobileTitle] = useState(banner?.mobileTitle ?? "");
  const [headline, setHeadline] = useState(banner?.headline ?? "");
  const [mobileHeadline, setMobileHeadline] = useState(
    banner?.mobileHeadline ?? "",
  );
  const [subheadline, setSubheadline] = useState(banner?.subheadline ?? "");
  const [mobileSubheadline, setMobileSubheadline] = useState(
    banner?.mobileSubheadline ?? "",
  );
  const [ctaText, setCtaText] = useState(banner?.ctaText ?? "");
  const [mobileCtaText, setMobileCtaText] = useState(
    banner?.mobileCtaText ?? "",
  );
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
  const previewTitle = title || demoBannerPreview.title;
  const previewHeadline = headline || demoBannerPreview.headline;
  const previewSubheadline = subheadline || demoBannerPreview.subheadline;
  const previewCtaText = ctaText || demoBannerPreview.ctaText;
  const previewMobileTitle = mobileTitle || previewTitle;
  const previewMobileHeadline = mobileHeadline || previewHeadline;
  const previewMobileSubheadline = mobileSubheadline || previewSubheadline;
  const previewMobileCtaText = mobileCtaText || previewCtaText;
  const previewDesktopImageUrl = desktopPreviewUrl;
  const previewMobileImageUrl = mobilePreviewUrl ?? desktopPreviewUrl;
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

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Desktop
            </p>
            <BannerPreview
              ctaText={previewCtaText}
              headline={previewHeadline}
              imageUrl={previewDesktopImageUrl}
              mode="desktop"
              subheadline={previewSubheadline}
              title={previewTitle}
            />
          </div>

          <div className="grid gap-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Mobile
            </p>
            <BannerPreview
              ctaText={previewMobileCtaText}
              headline={previewMobileHeadline}
              imageUrl={previewMobileImageUrl}
              mode="mobile"
              subheadline={previewMobileSubheadline}
              title={previewMobileTitle}
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
          <span className="flex items-center justify-between gap-3">
            Название
            <TextCounter limit={bannerTextLimits.title} value={title} />
          </span>
          <input
            className="h-11 rounded-lg border border-slate-200 px-3 font-normal text-slate-950"
            maxLength={bannerTextLimits.title}
            name="title"
            required
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
          />
        </label>

        <label className="grid gap-2 text-sm font-bold text-slate-700">
          <span className="flex items-center justify-between gap-3">
            Дополнительный заголовок
            <TextCounter limit={bannerTextLimits.headline} value={headline} />
          </span>
          <input
            className="h-11 rounded-lg border border-slate-200 px-3 font-normal text-slate-950"
            maxLength={bannerTextLimits.headline}
            name="headline"
            value={headline}
            onChange={(event) => setHeadline(event.currentTarget.value)}
          />
        </label>

        <label className="grid gap-2 text-sm font-bold text-slate-700">
          <span className="flex items-center justify-between gap-3">
            Подзаголовок
            <TextCounter limit={bannerTextLimits.subheadline} value={subheadline} />
          </span>
          <textarea
            className="min-h-28 rounded-lg border border-slate-200 px-3 py-2 font-normal text-slate-950"
            maxLength={bannerTextLimits.subheadline}
            name="subheadline"
            value={subheadline}
            onChange={(event) => setSubheadline(event.currentTarget.value)}
          />
        </label>

        <section className="grid gap-4 rounded-lg bg-slate-50 p-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">
              Текст для mobile
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Если поле пустое, используется основной текст баннера.
            </p>
          </div>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            <span className="flex items-center justify-between gap-3">
              Mobile-название
              <TextCounter limit={bannerTextLimits.mobileTitle} value={mobileTitle} />
            </span>
            <input
              className="h-11 rounded-lg border border-slate-200 px-3 font-normal text-slate-950"
              maxLength={bannerTextLimits.mobileTitle}
              name="mobileTitle"
              value={mobileTitle}
              onChange={(event) => setMobileTitle(event.currentTarget.value)}
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            <span className="flex items-center justify-between gap-3">
              Mobile-доп. заголовок
              <TextCounter
                limit={bannerTextLimits.mobileHeadline}
                value={mobileHeadline}
              />
            </span>
            <input
              className="h-11 rounded-lg border border-slate-200 px-3 font-normal text-slate-950"
              maxLength={bannerTextLimits.mobileHeadline}
              name="mobileHeadline"
              value={mobileHeadline}
              onChange={(event) => setMobileHeadline(event.currentTarget.value)}
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            <span className="flex items-center justify-between gap-3">
              Mobile-подзаголовок
              <TextCounter
                limit={bannerTextLimits.mobileSubheadline}
                value={mobileSubheadline}
              />
            </span>
            <textarea
              className="min-h-24 rounded-lg border border-slate-200 px-3 py-2 font-normal text-slate-950"
              maxLength={bannerTextLimits.mobileSubheadline}
              name="mobileSubheadline"
              value={mobileSubheadline}
              onChange={(event) => setMobileSubheadline(event.currentTarget.value)}
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            <span className="flex items-center justify-between gap-3">
              Mobile-CTA
              <TextCounter
                limit={bannerTextLimits.mobileCtaText}
                value={mobileCtaText}
              />
            </span>
            <input
              className="h-11 rounded-lg border border-slate-200 px-3 font-normal text-slate-950"
              maxLength={bannerTextLimits.mobileCtaText}
              name="mobileCtaText"
              value={mobileCtaText}
              onChange={(event) => setMobileCtaText(event.currentTarget.value)}
            />
          </label>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            <span className="flex items-center justify-between gap-3">
              CTA
              <TextCounter limit={bannerTextLimits.ctaText} value={ctaText} />
            </span>
            <input
              className="h-11 rounded-lg border border-slate-200 px-3 font-normal text-slate-950"
              maxLength={bannerTextLimits.ctaText}
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
                maxLength={bannerTextLimits.href}
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
