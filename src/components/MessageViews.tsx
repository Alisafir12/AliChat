"use client";

import type { Message } from "@/lib/types";
import { GeneratedImage } from "./GeneratedImage";

function Avatar({ role }: { role: Message["role"] }) {
  const isUser = role === "user";
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
        isUser
          ? "bg-sand/20 text-sand"
          : "bg-gradient-to-br from-copper to-sand text-night"
      }`}
      aria-hidden
    >
      {isUser ? "أنت" : "س"}
    </div>
  );
}

function extractMarkdownImages(content: string) {
  const images: Array<{ alt: string; url: string }> = [];
  const without = content.replace(
    /!\[([^\]]*)\]\((data:image\/[^)\s]+|https?:\/\/[^)\s]+|\/api\/[^)\s]+)\)/g,
    (_, alt: string, url: string) => {
      images.push({ alt, url });
      return "";
    },
  );
  return { text: without.trim(), images };
}

export function MessageBubble({
  message,
  streaming = false,
}: {
  message: Message;
  streaming?: boolean;
}) {
  const isUser = message.role === "user";
  const parsed = extractMarkdownImages(message.content);
  const attached = message.images || [];

  return (
    <div className="rise-in flex w-full gap-3 py-4">
      <Avatar role={message.role} />
      <div
        className={`min-w-0 flex-1 rounded-[22px] border px-3 py-3 sm:px-4 ${
          isUser
            ? "border-sand/20 bg-sand/10"
            : "border-line bg-[rgba(13,36,32,0.55)]"
        }`}
      >
        <div className="mb-1 text-[12px] font-medium tracking-wide text-ink-mute">
          {isUser ? "أنت" : "سِراج"}
        </div>

        {(attached.length > 0 || parsed.images.length > 0) && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attached.map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.id}
                src={img.dataUrl}
                alt="مرفق"
                className="max-h-72 max-w-full rounded-[16px] border border-line object-contain"
              />
            ))}
            {parsed.images.map((img, idx) => (
              <GeneratedImage
                key={`${img.url.slice(0, 48)}-${idx}`}
                src={img.url}
                alt={img.alt || "صورة مولّدة"}
              />
            ))}
          </div>
        )}

        {(parsed.text || streaming) && (
          <div
            className={`whitespace-pre-wrap break-words text-[16px] leading-[1.7] text-ink ${
              streaming ? "typing-cursor" : ""
            }`}
          >
            {parsed.text || (streaming ? "" : "…")}
          </div>
        )}
      </div>
    </div>
  );
}

export function Welcome({
  onSuggestion,
}: {
  onSuggestion: (text: string) => void;
}) {
  const suggestions = [
    { title: "وضّح لي فكرة", text: "اشرح لي مفهوم الذكاء الاصطناعي ببساطة" },
    { title: "ارسم مشهداً", text: "ارسم قطة صغيرة على طاولة خشبية" },
    { title: "صغ رسالة", text: "ساعدني في صياغة رسالة مهنية" },
    { title: "قارن تقنيتين", text: "ما الفرق بين Next.js و React؟" },
  ];

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center px-4 py-10 sm:py-12">
      <div className="w-full max-w-[760px]">
        <div className="rise-in mb-8">
          <p className="mb-3 text-[12px] font-medium tracking-[0.22em] text-sand/80">
            SIRAJ SPACE
          </p>
          <h1 className="brand-mark mb-3 text-[36px] font-semibold leading-[1.15] text-ink sm:text-[52px]">
            سِراج
          </h1>
          <p className="max-w-xl text-[15px] leading-relaxed text-ink-soft sm:text-[17px]">
            اسأل، حلّل صورة، أو اطلب رسماً — في مساحة هادئة بضوء دافئ.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {suggestions.map((item, index) => (
            <button
              key={item.text}
              type="button"
              onClick={() => onSuggestion(item.text)}
              style={{ animationDelay: `${0.08 * (index + 1)}s` }}
              className="rise-in rounded-[20px] border border-line bg-[rgba(13,36,32,0.55)] px-4 py-4 text-start transition-all hover:-translate-y-0.5 hover:border-sand/35 hover:bg-sand/10"
            >
              <div className="mb-1 text-[12px] font-medium tracking-wide text-sand">
                {item.title}
              </div>
              <div className="text-[14px] leading-relaxed text-ink-soft">
                {item.text}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
