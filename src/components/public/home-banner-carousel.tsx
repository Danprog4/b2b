"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type HomeBanner = {
  id: string;
  title: string;
  headline: string | null;
  subheadline: string | null;
  ctaText: string | null;
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
  const className =
    variant === "primary"
      ? "rounded-lg bg-[#1157ff] px-6 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[#0b49e0]"
      : "rounded-lg bg-white px-6 py-3 text-base font-bold text-slate-900 shadow-sm ring-1 ring-slate-200 transition hover:ring-[#1157ff]";

  if (!href) {
    return <span className={className}>{children}</span>;
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
        {children}
      </a>
    );
  }

  return (
    <Link className={className} href={href} tabIndex={tabIndex}>
      {children}
    </Link>
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

  return (
    <div
      aria-hidden={!isActive}
      className={`absolute inset-0 transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none ${
        isActive
          ? "z-10 translate-x-0 opacity-100"
          : "z-0 pointer-events-none translate-x-4 opacity-0"
      }`}
    >
      {hasImage ? (
        <picture>
          {mobileImageUrl ? (
            <source media="(max-width: 767px)" srcSet={mobileImageUrl} />
          ) : null}
          <img
            alt={banner.title}
            className={`absolute inset-0 h-full w-full object-cover transition-transform duration-[1400ms] ease-out motion-reduce:transition-none ${
              isActive ? "scale-100" : "scale-105"
            }`}
            src={imageUrl ?? mobileImageUrl ?? ""}
          />
        </picture>
      ) : null}

      <div
        className={`relative flex h-full items-center px-8 py-10 md:px-20 md:py-14 ${
          hasImage ? "bg-white/70 backdrop-blur-[1px]" : ""
        }`}
      >
        <div
          className={`w-full max-w-[720px] transition-[opacity,transform] delay-100 duration-700 ease-out motion-reduce:transition-none ${
            isActive ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <h1 className="line-clamp-3 text-3xl font-black leading-tight text-slate-950 md:text-5xl">
            {banner.title}
          </h1>
          {banner.headline ? (
            <p className="mt-5 line-clamp-2 max-w-xl text-lg font-black leading-7 text-slate-900">
              {banner.headline}
            </p>
          ) : null}
          {banner.subheadline ? (
            <p className="mt-5 line-clamp-2 max-w-xl text-base leading-7 text-slate-600">
              {banner.subheadline}
            </p>
          ) : null}
          {banner.ctaText ? (
            <div className="mt-8 flex flex-wrap gap-3">
              <BannerAction href={banner.href} tabIndex={actionTabIndex}>
                {banner.ctaText}
              </BannerAction>
            </div>
          ) : null}
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
      <div className="relative overflow-hidden rounded-2xl bg-[#dff0ff] px-8 py-10 shadow-sm md:px-12 md:py-14">
        <div className="max-w-2xl">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-[#1157ff]">
            B2B закупки
          </p>
          <h1 className="text-4xl font-black leading-tight text-slate-950 md:text-6xl">
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
    <div className="relative h-[420px] overflow-hidden rounded-2xl bg-[#dff0ff] shadow-sm">
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
            className="absolute left-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-sm transition hover:bg-white md:flex"
            type="button"
            onClick={() =>
              setActiveIndex((index) => (index - 1 + banners.length) % banners.length)
            }
          >
            <ChevronLeft size={22} />
          </button>
          <button
            aria-label="Следующий баннер"
            className="absolute right-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-sm transition hover:bg-white md:flex"
            type="button"
            onClick={() => setActiveIndex((index) => (index + 1) % banners.length)}
          >
            <ChevronRight size={22} />
          </button>
          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2 rounded-full bg-white/80 px-3 py-2 shadow-sm">
            {banners.map((banner, index) => (
              <button
                aria-label={`Открыть баннер ${index + 1}`}
                className={`h-2.5 rounded-full transition ${
                  index === activeIndex ? "w-7 bg-[#1157ff]" : "w-2.5 bg-slate-300"
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
