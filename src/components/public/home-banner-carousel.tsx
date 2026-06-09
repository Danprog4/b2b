"use client";

import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type HomeBanner = {
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
  imageUrl: string | null;
  mobileImageUrl: string | null;
};

type HomeBannerCarouselProps = {
  banners: HomeBanner[];
  isAuthenticated?: boolean;
};

function BannerAction({
  href,
  children,
  variant = "primary",
  tabIndex,
}: {
  href: string | null;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  tabIndex?: number;
}) {
  const base =
    "group/cta inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-base font-bold shadow-lg transition";
  const className =
    variant === "primary"
      ? `${base} bg-[#1157ff] text-white shadow-[#1157ff]/25 hover:bg-[#0b49e0]`
      : `${base} bg-white text-slate-900 ring-1 ring-slate-200 hover:ring-[#1157ff]`;
  const content = (
    <>
      {children}
      <ArrowRight
        className="transition-transform group-hover/cta:translate-x-0.5"
        size={18}
      />
    </>
  );

  if (!href) {
    return <span className={className}>{content}</span>;
  }

  if (/^https?:\/\//i.test(href)) {
    return (
      <a
        className={className}
        href={href}
        rel="noreferrer"
        tabIndex={tabIndex}
        target="_blank"
      >
        {content}
      </a>
    );
  }

  return (
    <Link className={className} href={href} tabIndex={tabIndex}>
      {content}
    </Link>
  );
}

function BannerContent({
  title,
  headline,
  subheadline,
  ctaText,
  href,
  tabIndex,
  className,
  tone = "onImage",
  eyebrow,
}: {
  title: string;
  headline: string | null;
  subheadline: string | null;
  ctaText: string | null;
  href: string | null;
  tabIndex?: number;
  className: string;
  tone?: "onImage" | "onLight";
  eyebrow?: string | null;
}) {
  const isOnImage = tone === "onImage";
  const titleClass = isOnImage
    ? "text-white drop-shadow-[0_2px_12px_rgba(2,6,23,0.45)]"
    : "text-slate-950";
  const headlineClass = isOnImage ? "text-white/95" : "text-slate-900";
  const subheadlineClass = isOnImage ? "text-white/80" : "text-slate-600";

  return (
    <div className={className}>
      {eyebrow ? (
        <span
          className={`mb-4 inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.16em] ${
            isOnImage
              ? "bg-white/15 text-white ring-1 ring-inset ring-white/25 backdrop-blur-sm"
              : "bg-[#1157ff]/10 text-[#1157ff]"
          }`}
        >
          {eyebrow}
        </span>
      ) : null}
      <h1
        className={`line-clamp-3 text-3xl font-black leading-[1.05] tracking-tight md:text-[3.25rem] ${titleClass}`}
      >
        {title}
      </h1>
      {headline ? (
        <p
          className={`mt-5 line-clamp-2 max-w-3xl text-lg font-bold leading-7 md:text-xl md:leading-8 ${headlineClass}`}
        >
          {headline}
        </p>
      ) : null}
      {subheadline ? (
        <p
          className={`mt-4 line-clamp-2 max-w-2xl text-base leading-7 md:text-lg md:leading-8 ${subheadlineClass}`}
        >
          {subheadline}
        </p>
      ) : null}
      {ctaText ? (
        <div className="mt-8 flex flex-wrap gap-3">
          <BannerAction href={href} tabIndex={tabIndex}>
            {ctaText}
          </BannerAction>
        </div>
      ) : null}
    </div>
  );
}

function BannerSlide({
  banner,
  isActive,
}: {
  banner: HomeBanner;
  isActive: boolean;
}) {
  const imageUrl = banner.imageUrl;
  const mobileImageUrl = banner.mobileImageUrl ?? imageUrl;
  const hasImage = Boolean(imageUrl || mobileImageUrl);
  const actionTabIndex = isActive ? undefined : -1;
  const mobileTitle = banner.mobileTitle || banner.title;
  const mobileHeadline = banner.mobileHeadline || banner.headline;
  const mobileSubheadline = banner.mobileSubheadline || banner.subheadline;
  const mobileCtaText = banner.mobileCtaText || banner.ctaText;

  return (
    <div
      aria-hidden={!isActive}
      className={`absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none ${
        isActive
          ? "z-10 opacity-100"
          : "z-0 pointer-events-none opacity-0"
      }`}
    >
      {hasImage ? (
        <picture>
          {mobileImageUrl ? (
            <source media="(max-width: 767px)" srcSet={mobileImageUrl} />
          ) : null}
          <img
            alt={banner.title}
            className="absolute inset-0 h-full w-full object-cover"
            src={imageUrl ?? mobileImageUrl ?? ""}
          />
        </picture>
      ) : null}

      {hasImage ? (
        <>
          {/* Mobile: bottom-up scrim. Desktop: left-to-right scrim. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent md:bg-gradient-to-r md:from-slate-950/85 md:via-slate-950/55 md:via-40% md:to-transparent"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[#1157ff]/10 mix-blend-multiply"
          />
        </>
      ) : null}

      <div className="relative flex h-full items-end px-7 py-9 md:items-center md:px-24 md:py-16 xl:px-32">
        <div
          className={`w-full transition-opacity delay-75 duration-500 ease-out motion-reduce:transition-none ${
            isActive ? "opacity-100" : "opacity-0"
          }`}
        >
          <BannerContent
            className="hidden max-w-[820px] md:block"
            ctaText={banner.ctaText}
            eyebrow={banner.headline ? "Сити Маркет" : null}
            headline={banner.headline}
            href={banner.href}
            subheadline={banner.subheadline}
            tabIndex={actionTabIndex}
            title={banner.title}
            tone={hasImage ? "onImage" : "onLight"}
          />
          <BannerContent
            className="block max-w-full md:hidden"
            ctaText={mobileCtaText}
            headline={mobileHeadline}
            href={banner.href}
            subheadline={mobileSubheadline}
            tabIndex={actionTabIndex}
            title={mobileTitle}
            tone={hasImage ? "onImage" : "onLight"}
          />
        </div>
      </div>
    </div>
  );
}

export function HomeBannerCarousel({
  banners,
  isAuthenticated = false,
}: HomeBannerCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const hasSlides = banners.length > 0;

  useEffect(() => {
    if (banners.length < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % banners.length);
    }, 7000);

    return () => window.clearInterval(timer);
  }, [banners.length]);

  if (!hasSlides) {
    return (
      <div className="relative min-h-[360px] overflow-hidden rounded-[28px] bg-gradient-to-br from-[#eaf2ff] via-[#dfeaff] to-[#f4f8ff] px-8 py-10 shadow-sm ring-1 ring-slate-200/70 md:min-h-[460px] md:px-24 md:py-16 xl:px-32">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#1157ff]/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 right-24 h-72 w-72 rounded-full bg-sky-300/25 blur-3xl"
        />
        <div className="relative max-w-2xl">
          <p className="mb-3 inline-flex items-center rounded-full bg-[#1157ff]/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#1157ff]">
            B2B закупки
          </p>
          <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-slate-950 md:text-6xl">
            Закупайте товары для бизнеса через единое окно
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
            Каталог, корзина, счет на оплату, документы и чат с оператором в
            одном личном кабинете.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <BannerAction href="/catalog">Перейти в каталог</BannerAction>
            {!isAuthenticated ? (
              <BannerAction href="/register" variant="secondary">
                Зарегистрировать компанию
              </BannerAction>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[360px] overflow-hidden rounded-[28px] bg-[#dff0ff] shadow-sm ring-1 ring-slate-200/70 md:h-[460px]">
      {banners.map((banner, index) => (
        <BannerSlide
          banner={banner}
          isActive={index === activeIndex}
          key={banner.id}
        />
      ))}

      {banners.length > 1 ? (
        <>
          <button
            aria-label="Предыдущий баннер"
            className="absolute left-5 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-900 shadow-lg ring-1 ring-white/60 backdrop-blur transition hover:scale-105 hover:bg-white md:flex"
            type="button"
            onClick={() =>
              setActiveIndex((index) => (index - 1 + banners.length) % banners.length)
            }
          >
            <ChevronLeft size={22} />
          </button>
          <button
            aria-label="Следующий баннер"
            className="absolute right-5 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-900 shadow-lg ring-1 ring-white/60 backdrop-blur transition hover:scale-105 hover:bg-white md:flex"
            type="button"
            onClick={() => setActiveIndex((index) => (index + 1) % banners.length)}
          >
            <ChevronRight size={22} />
          </button>
          <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2 rounded-full bg-slate-950/30 px-3 py-2 shadow-sm ring-1 ring-white/20 backdrop-blur">
            {banners.map((banner, index) => (
              <button
                aria-label={`Открыть баннер ${index + 1}`}
                className={`h-2.5 rounded-full transition-all ${
                  index === activeIndex
                    ? "w-7 bg-white"
                    : "w-2.5 bg-white/50 hover:bg-white/70"
                }`}
                key={banner.id}
                type="button"
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
