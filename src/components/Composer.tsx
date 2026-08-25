"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { CloseIcon, ImageIcon, SendIcon, StopIcon } from "./Icons";
import {
  fileToAttachment,
  type ImageAttachment,
} from "@/lib/types";

type Props = {
  disabled?: boolean;
  streaming?: boolean;
  onSend: (text: string, images: ImageAttachment[]) => void;
  onStop: () => void;
};

const MAX_IMAGES = 4;
const MAX_BYTES = 4 * 1024 * 1024;

export function Composer({ disabled, streaming, onSend, onStop }: Props) {
  const [value, setValue] = useState("");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 48), 200)}px`;
  }, [value]);

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;

    const remaining = MAX_IMAGES - images.length;
    const selected = list.slice(0, remaining);
    const next: ImageAttachment[] = [];

    for (const file of selected) {
      if (file.size > MAX_BYTES) continue;
      next.push(await fileToAttachment(file));
    }

    if (next.length) setImages((prev) => [...prev, ...next].slice(0, MAX_IMAGES));
  }

  function submit() {
    const text = value.trim();
    if ((!text && images.length === 0) || disabled || streaming) return;
    onSend(text || "حلّل هذه الصورة", images);
    setValue("");
    setImages([]);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="mx-auto w-full max-w-[760px] px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
      <form
        onSubmit={onSubmit}
        className={`w-full rounded-[22px] border bg-[rgba(13,36,32,0.92)] p-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-all duration-300 sm:rounded-[28px] sm:p-3 ${
          focused
            ? "border-sand/40 shadow-[0_0_0_4px_rgba(208,137,79,0.12)]"
            : "border-line"
        }`}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData.files || []).filter((f) =>
            f.type.startsWith("image/"),
          );
          if (files.length) {
            e.preventDefault();
            void addFiles(files);
          }
        }}
      >
        {images.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 px-1 pt-1">
            {images.map((img) => (
              <div key={img.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.dataUrl}
                  alt="مرفق"
                  className="h-16 w-16 rounded-[14px] border border-line object-cover"
                />
                <button
                  type="button"
                  aria-label="إزالة الصورة"
                  onClick={() =>
                    setImages((prev) => prev.filter((x) => x.id !== img.id))
                  }
                  className="absolute -start-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-copper text-night"
                >
                  <CloseIcon size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={1}
          placeholder="اسأل سِراج… أو أرفق صورة"
          disabled={disabled}
          className="max-h-[200px] min-h-[48px] w-full resize-none border-0 bg-transparent px-3 py-2 text-[16px] leading-[1.6] text-ink outline-none placeholder:text-ink-mute disabled:opacity-50"
        />
        <div className="flex items-center justify-between gap-2 px-1 pb-1">
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={disabled || streaming || images.length >= MAX_IMAGES}
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:border-sand/40 hover:text-sand disabled:opacity-30"
              aria-label="إرفاق صورة"
              title="إرفاق صورة"
            >
              <ImageIcon />
            </button>
            <span className="hidden text-[12px] text-ink-mute sm:inline">
              صورة للتحليل · أو اكتب «ارسم…»
            </span>
          </div>

          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sand text-night transition-transform hover:scale-[1.03]"
              aria-label="إيقاف التوليد"
            >
              <StopIcon />
            </button>
          ) : (
            <button
              type="submit"
              disabled={(!value.trim() && images.length === 0) || disabled}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-l from-copper to-sand text-night transition-transform hover:scale-[1.03] disabled:opacity-30"
              aria-label="إرسال"
            >
              <SendIcon />
            </button>
          )}
        </div>
      </form>
      <p className="mt-3 text-center text-[12px] text-ink-mute">
        سِراج قد يخطئ — راجع المعلومات المهمة.
      </p>
    </div>
  );
}
