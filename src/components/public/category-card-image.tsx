"use client";

import { ImageIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

type CategoryCardImageProps = {
  alt: string;
  src: string | null;
};

export function CategoryCardImage({ alt, src }: CategoryCardImageProps) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <ImageIcon
        aria-hidden
        className="text-slate-300"
        size={30}
      />
    );
  }

  return (
    <Image
      alt={alt}
      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
      fill
      onError={() => setHasError(true)}
      sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
      src={src}
      unoptimized
    />
  );
}
