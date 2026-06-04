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
}: {
  href: string | null;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
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
      <a className={className} href={href} rel="noreferrer" target="_blank">
        {children}
      </a>
    );
  }

  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}

export function HomeBannerCarousel({
  banners,
  isAuthenticated = false,
}: HomeBannerCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const hasSlides = banners.length > 0;
  const activeBanner = banners[activeIndex];

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

  const imageUrl = activeBanner.imageUrl;
  const mobileImageUrl = activeBanner.mobileImageUrl ?? imageUrl;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#dff0ff] shadow-sm">
      {imageUrl || mobileImageUrl ? (
        <picture>
          {mobileImageUrl ? (
            <source media="(max-width: 767px)" srcSet={mobileImageUrl} />
          ) : null}
          <img
            alt={activeBanner.title}
            className="absolute inset-0 h-full w-full object-cover"
            src={imageUrl ?? mobileImageUrl ?? ""}
          />
        </picture>
      ) : null}

      <div
        className={`relative min-h-[360px] px-8 py-10 md:min-h-[420px] md:px-12 md:py-14 ${
          imageUrl || mobileImageUrl ? "bg-white/70 backdrop-blur-[1px]" : ""
        }`}
      >
        <div className="max-w-2xl">
          <h1 className="text-4xl font-black leading-tight text-slate-950 md:text-6xl">
            {activeBanner.title}
          </h1>
          {activeBanner.headline ? (
            <p className="mt-5 max-w-xl text-xl font-black leading-7 text-slate-900">
              {activeBanner.headline}
            </p>
          ) : null}
          {activeBanner.subheadline ? (
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              {activeBanner.subheadline}
            </p>
          ) : null}
          {activeBanner.ctaText ? (
            <div className="mt-8 flex flex-wrap gap-3">
              <BannerAction href={activeBanner.href}>{activeBanner.ctaText}</BannerAction>
            </div>
          ) : null}
        </div>
      </div>

      {banners.length > 1 ? (
        <>
          <button
            aria-label="Предыдущий баннер"
            className="absolute left-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-sm transition hover:bg-white md:flex"
            type="button"
            onClick={() =>
              setActiveIndex((index) => (index - 1 + banners.length) % banners.length)
            }
          >
            <ChevronLeft size={22} />
          </button>
          <button
            aria-label="Следующий баннер"
            className="absolute right-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-sm transition hover:bg-white md:flex"
            type="button"
            onClick={() => setActiveIndex((index) => (index + 1) % banners.length)}
          >
            <ChevronRight size={22} />
          </button>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-white/80 px-3 py-2 shadow-sm">
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
