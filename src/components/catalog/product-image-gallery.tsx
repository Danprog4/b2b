"use client";

import { ChevronLeft, ChevronRight, ShoppingCart, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type ProductImage = {
  id: string;
  fileName: string;
  url: string | null;
};

export function ProductImageGallery({
  productName,
  mainImageUrl,
  images,
}: {
  productName: string;
  mainImageUrl: string | null;
  images: ProductImage[];
}) {
  const gallery = useMemo(() => {
    const allImages = mainImageUrl
      ? [{ id: "main", fileName: productName, url: mainImageUrl }, ...images]
      : images;
    const seen = new Set<string>();

    return allImages.filter((image) => {
      if (!image.url || seen.has(image.url)) {
        return false;
      }

      seen.add(image.url);
      return true;
    });
  }, [images, mainImageUrl, productName]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const activeImage = gallery[activeIndex];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const previousBodyStyles = {
      overflow: document.body.style.overflow,
      paddingRight: document.body.style.paddingRight,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousBodyStyles.overflow;
      document.body.style.paddingRight = previousBodyStyles.paddingRight;
      document.body.style.position = previousBodyStyles.position;
      document.body.style.top = previousBodyStyles.top;
      document.body.style.width = previousBodyStyles.width;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }

      if (event.key === "ArrowLeft") {
        setActiveIndex((index) => (index - 1 + gallery.length) % gallery.length);
      }

      if (event.key === "ArrowRight") {
        setActiveIndex((index) => (index + 1) % gallery.length);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gallery.length, isOpen]);

  function openImage(index: number) {
    setActiveIndex(index);
    setIsOpen(true);
  }

  if (gallery.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-slate-100">
        <ShoppingCart className="text-slate-300" size={72} />
      </div>
    );
  }

  return (
    <>
      <button
        className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-slate-100"
        type="button"
        onClick={() => openImage(activeIndex)}
      >
        {activeImage?.url ? (
          <img
            alt={activeImage.fileName}
            className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
            src={activeImage.url}
          />
        ) : (
          <ShoppingCart className="text-slate-300" size={72} />
        )}
      </button>

      {gallery.length > 1 ? (
        <div className="grid grid-cols-4 gap-3">
          {gallery.map((image, index) => (
            <button
              aria-label={`Открыть фото ${index + 1}`}
              className={`flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-slate-100 ring-1 transition ${
                index === activeIndex
                  ? "ring-[#1157ff]"
                  : "ring-slate-200 hover:ring-[#1157ff]"
              }`}
              key={`${image.id}-${image.url}`}
              type="button"
              onClick={() => openImage(index)}
            >
              {image.url ? (
                <img
                  alt={image.fileName}
                  className="h-full w-full object-cover"
                  src={image.url}
                />
              ) : (
                <ShoppingCart className="text-slate-300" size={26} />
              )}
            </button>
          ))}
        </div>
      ) : null}

      {isOpen && activeImage?.url ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm">
          <button
            aria-label="Закрыть просмотр"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            type="button"
            onClick={() => setIsOpen(false)}
          >
            <X size={22} />
          </button>
          {gallery.length > 1 ? (
            <>
              <button
                aria-label="Предыдущее фото"
                className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                type="button"
                onClick={() =>
                  setActiveIndex((index) => (index - 1 + gallery.length) % gallery.length)
                }
              >
                <ChevronLeft size={26} />
              </button>
              <button
                aria-label="Следующее фото"
                className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                type="button"
                onClick={() => setActiveIndex((index) => (index + 1) % gallery.length)}
              >
                <ChevronRight size={26} />
              </button>
            </>
          ) : null}
          <img
            alt={activeImage.fileName}
            className="max-h-[88vh] max-w-[88vw] animate-[zoomIn_180ms_ease-out] rounded-xl object-contain shadow-2xl"
            src={activeImage.url}
          />
        </div>
      ) : null}
    </>
  );
}
