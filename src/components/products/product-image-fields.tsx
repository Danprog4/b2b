"use client";

import { ImageIcon, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type ProductGalleryImage = {
  id: string;
  fileId?: string;
  url: string | null;
  fileName: string;
};

type GalleryUploadItem = {
  file: File;
  previewUrl: string;
};

type ProductImageFieldsProps = {
  productName?: string;
  mainImageUrl?: string | null;
  galleryImages?: ProductGalleryImage[];
  mainImageName?: string;
  galleryImageName?: string;
  existingGalleryImageName?: string;
  existingGalleryStateName?: string;
  maxGalleryImages?: number;
  clearMainImageAction?: (formData: FormData) => void | Promise<void>;
  removeExistingGalleryImageAction?: (
    imageId: string,
    formData: FormData,
  ) => void | Promise<void>;
  onImageChange?: () => void;
};

function syncInputFiles(input: HTMLInputElement | null, files: File[]) {
  if (!input) {
    return;
  }

  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
}

export function ProductImageFields({
  productName,
  mainImageUrl,
  galleryImages = [],
  mainImageName = "mainImage",
  galleryImageName = "galleryImages",
  existingGalleryImageName,
  existingGalleryStateName = "galleryImagesState",
  maxGalleryImages = 10,
  clearMainImageAction,
  removeExistingGalleryImageAction,
  onImageChange,
}: ProductImageFieldsProps) {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const mainPreviewUrlRef = useRef<string | null>(null);
  const galleryUploadsRef = useRef<GalleryUploadItem[]>([]);
  const [mainPreviewUrl, setMainPreviewUrl] = useState<string | null>(null);
  const [visibleGalleryImages, setVisibleGalleryImages] = useState(galleryImages);
  const [galleryUploads, setGalleryUploads] = useState<GalleryUploadItem[]>([]);
  const resolvedMainImageUrl = mainPreviewUrl ?? mainImageUrl ?? null;
  const visibleGalleryCount = visibleGalleryImages.length + galleryUploads.length;
  const canAddGalleryImages = visibleGalleryCount < maxGalleryImages;

  function notifyImageChange() {
    window.setTimeout(() => onImageChange?.(), 0);
  }

  function updateGalleryUploads(nextItems: GalleryUploadItem[]) {
    galleryUploadsRef.current = nextItems;
    setGalleryUploads(nextItems);
    syncInputFiles(
      galleryInputRef.current,
      nextItems.map((item) => item.file),
    );
    notifyImageChange();
  }

  useEffect(() => {
    return () => {
      if (mainPreviewUrlRef.current) {
        URL.revokeObjectURL(mainPreviewUrlRef.current);
      }

      galleryUploadsRef.current.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  return (
    <section className="grid gap-5 rounded-xl bg-slate-50 p-5">
      <div>
        <h2 className="text-xl font-black text-slate-950">Изображения</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          Главное фото показывается первым в каталоге и карточке товара.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(260px,380px)_1fr]">
        <div className="grid content-start gap-4">
          <div className="aspect-[4/3] overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
            {resolvedMainImageUrl ? (
              <img
                alt={productName ?? "Фото товара"}
                className="h-full w-full object-cover"
                src={resolvedMainImageUrl}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-slate-100 text-slate-300">
                <ImageIcon size={40} />
              </div>
            )}
          </div>

          <div className="grid gap-3">
            <input
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              id={`${mainImageName}-input`}
              name={mainImageName}
              type="file"
              onChange={(event) => {
                const [file] = Array.from(event.currentTarget.files ?? []);
                setMainPreviewUrl((currentUrl) => {
                  if (currentUrl) {
                    URL.revokeObjectURL(currentUrl);
                  }

                  const nextUrl = file ? URL.createObjectURL(file) : null;
                  mainPreviewUrlRef.current = nextUrl;
                  return nextUrl;
                });
                notifyImageChange();
              }}
            />
            <label
              className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#1157ff] px-5 text-base font-bold text-white transition hover:bg-[#0b49e0]"
              htmlFor={`${mainImageName}-input`}
            >
              <Upload size={18} />
              {mainImageUrl ? "Заменить главное фото" : "Загрузить главное фото"}
            </label>

            <input
              ref={galleryInputRef}
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={!canAddGalleryImages}
              id={`${galleryImageName}-input`}
              multiple
              name={galleryImageName}
              type="file"
              onChange={(event) => {
                const selectedFiles = Array.from(event.currentTarget.files ?? []);
                const availableSlots = Math.max(
                  0,
                  maxGalleryImages - visibleGalleryImages.length - galleryUploads.length,
                );
                const nextUploads = [
                  ...galleryUploads,
                  ...selectedFiles.slice(0, availableSlots).map((file) => ({
                    file,
                    previewUrl: URL.createObjectURL(file),
                  })),
                ];
                updateGalleryUploads(nextUploads);
              }}
            />
            <label
              aria-disabled={!canAddGalleryImages}
              className={
                canAddGalleryImages
                  ? "inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#1157ff] px-5 text-base font-bold text-white transition hover:bg-[#0b49e0]"
                  : "inline-flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-slate-300 px-5 text-base font-bold text-white"
              }
              htmlFor={`${galleryImageName}-input`}
            >
              <Upload size={18} />
              Добавить фото галереи
            </label>

            {mainImageUrl && clearMainImageAction ? (
              <button
                className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-red-50 px-5 text-base font-bold text-red-600 transition hover:bg-red-100"
                formAction={clearMainImageAction}
                type="submit"
              >
                Удалить главное фото
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid content-start gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-black uppercase text-slate-500">
              Галерея
            </h3>
            <span className="text-xs font-bold text-slate-400">
              {visibleGalleryCount}/{maxGalleryImages}
            </span>
          </div>

          {existingGalleryImageName ? (
            <>
              <input name={existingGalleryStateName} type="hidden" value="1" />
              {visibleGalleryImages.map((image) => (
                <input
                  key={image.id}
                  name={existingGalleryImageName}
                  type="hidden"
                  value={image.fileId ?? image.id}
                />
              ))}
            </>
          ) : null}

          {visibleGalleryCount > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,112px))] gap-3">
              {visibleGalleryImages.map((image) => (
                <div
                  className="relative aspect-square overflow-hidden rounded-lg bg-white ring-1 ring-slate-200"
                  key={image.id}
                >
                  {image.url ? (
                    <img
                      alt={image.fileName}
                      className="h-full w-full object-cover"
                      src={image.url}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-slate-100 text-slate-300">
                      <ImageIcon size={30} />
                    </div>
                  )}
                  {removeExistingGalleryImageAction ? (
                    <button
                      aria-label="Удалить фото"
                      className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50"
                      formAction={removeExistingGalleryImageAction.bind(null, image.id)}
                      type="submit"
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : (
                    <button
                      aria-label="Удалить фото"
                      className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50"
                      type="button"
                      onClick={() => {
                        setVisibleGalleryImages((currentImages) =>
                          currentImages.filter(
                            (currentImage) => currentImage.id !== image.id,
                          ),
                        );
                        notifyImageChange();
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}

              {galleryUploads.map((item, index) => (
                <div
                  className="relative aspect-square overflow-hidden rounded-lg bg-white ring-1 ring-slate-200"
                  key={item.previewUrl}
                >
                  <img
                    alt={`Новое фото галереи ${index + 1}`}
                    className="h-full w-full object-cover"
                    src={item.previewUrl}
                  />
                  <button
                    aria-label="Удалить фото"
                    className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50"
                    type="button"
                    onClick={() => {
                      const nextUploads = galleryUploads.filter(
                        (_, itemIndex) => itemIndex !== index,
                      );
                      URL.revokeObjectURL(item.previewUrl);
                      updateGalleryUploads(nextUploads);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-slate-300">
              <ImageIcon size={34} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
