"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Package } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// ImageGallery — client island for thumbnail switching.
// Kept as a small, isolated component to avoid hydrating the whole page.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  images: string[];
  title: string;
}

export default function ImageGallery({ images, title }: Props) {
  const validImages = images.filter(Boolean);
  const [active, setActive] = useState(0);

  const hasFallback = validImages.length === 0;

  const prev = () =>
    setActive((i) => (i === 0 ? validImages.length - 1 : i - 1));
  const next = () =>
    setActive((i) => (i === validImages.length - 1 ? 0 : i + 1));

  return (
    <div className="flex flex-col gap-4">
      {/* ── Main image ── */}
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
        {hasFallback ? (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-20 w-20 text-gray-200" strokeWidth={1} />
          </div>
        ) : (
          <>
            <Image
              src={validImages[active]}
              alt={`${title} — image ${active + 1}`}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-contain p-6 transition duration-300"
            />

            {/* Prev / next arrows — only shown when multiple images */}
            {validImages.length > 1 && (
              <>
                <button
                  onClick={prev}
                  aria-label="Previous image"
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur-sm transition hover:bg-white active:scale-95"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-700" />
                </button>
                <button
                  onClick={next}
                  aria-label="Next image"
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur-sm transition hover:bg-white active:scale-95"
                >
                  <ChevronRight className="h-4 w-4 text-gray-700" />
                </button>
              </>
            )}

            {/* Image counter pill */}
            {validImages.length > 1 && (
              <div className="absolute bottom-3 right-3 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                {active + 1} / {validImages.length}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Thumbnails ── */}
      {validImages.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
          {validImages.map((src, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition duration-200 ${
                active === i
                  ? "border-indigo-500 shadow-md"
                  : "border-gray-100 opacity-50 hover:opacity-80 hover:border-gray-300"
              }`}
            >
              <Image
                src={src}
                alt={`${title} thumbnail ${i + 1}`}
                fill
                sizes="80px"
                className="object-contain p-1.5"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
