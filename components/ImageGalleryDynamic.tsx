"use client";

/**
 * Thin client-component wrapper that lazy-loads ImageGallery with ssr:false.
 * `ssr: false` is only allowed inside Client Components — NOT in Server
 * Components — so this file owns the dynamic() call.
 */

import dynamic from "next/dynamic";

function ImageGallerySkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="aspect-square w-full rounded-2xl bg-gray-100" />
      <div className="flex gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 w-20 shrink-0 rounded-xl bg-gray-100" />
        ))}
      </div>
    </div>
  );
}

const ImageGalleryDynamic = dynamic(
  () => import("@/components/ImageGallery"),
  {
    ssr: false,
    loading: () => <ImageGallerySkeleton />,
  }
);

export default ImageGalleryDynamic;
