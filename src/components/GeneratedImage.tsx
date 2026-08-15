"use client";

import { useEffect, useState } from "react";

export function GeneratedImage({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [resolved, setResolved] = useState<string | null>(
    src.startsWith("data:") ? src : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!src.startsWith("data:"));

  useEffect(() => {
    if (src.startsWith("data:")) {
      setResolved(src);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      let lastErr = "تعذر تحميل الصورة";

      for (let attempt = 0; attempt < 3; attempt++) {
        if (cancelled) return;
        try {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, 2000 * attempt));
          }
          const res = await fetch(
            attempt === 0 ? src : src.replace(/([?&]seed=)[^&]+/, `$1${Date.now()}-${attempt}`),
            {
              signal: controller.signal,
              cache: "no-store",
            },
          );
          if (!res.ok) {
            lastErr = `HTTP ${res.status}`;
            continue;
          }
          const blob = await res.blob();
          if (!blob.type.startsWith("image/") || blob.size < 1000) {
            lastErr = "invalid image";
            continue;
          }
          objectUrl = URL.createObjectURL(blob);
          if (!cancelled) {
            setResolved(objectUrl);
            setLoading(false);
          }
          return;
        } catch (err) {
          if (cancelled) return;
          lastErr = err instanceof Error ? err.message : "تعذر تحميل الصورة";
        }
      }

      if (!cancelled) {
        setLoading(false);
        setError(lastErr);
      }
    }

    void load();

    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (loading) {
    return (
      <div className="flex h-48 w-full max-w-md items-center justify-center rounded-[18px] border border-line bg-forest/60 text-[14px] text-ink-mute">
        جاري تجهيز الصورة… قد يستغرق حتى دقيقة
      </div>
    );
  }

  if (error || !resolved) {
    return (
      <div className="rounded-[18px] border border-line bg-forest/60 px-3 py-4 text-[14px] text-ink-soft">
        تعذر تحميل الصورة — أعد كتابة «ارسم…» بعد دقيقة.
        {error ? ` (${error})` : ""}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt || "صورة مولّدة"}
      className="max-h-96 max-w-full rounded-[18px] border border-line object-contain bg-forest/40"
    />
  );
}
