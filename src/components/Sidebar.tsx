"use client";

import type { Conversation } from "@/lib/types";
import { ChatBubbleIcon, CloseIcon, PenIcon, SearchIcon } from "./Icons";
import { IconButton } from "./IconButton";
import { SidebarItem } from "./SidebarItem";

type Props = {
  open: boolean;
  onCloseMobile: () => void;
  conversations: Conversation[];
  activeId: string | null;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
};

export function Sidebar({
  open,
  onCloseMobile,
  conversations,
  activeId,
  onNewChat,
  onSelect,
  onDelete,
}: Props) {
  return (
    <>
      {/* Mobile scrim */}
      <button
        type="button"
        aria-label="إغلاق القائمة"
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onCloseMobile}
      />

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex h-dvh w-[min(300px,88vw)] flex-col border-l border-line bg-[rgba(10,30,27,0.97)] shadow-[-12px_0_40px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-transform duration-300 ease-out md:static md:z-auto md:h-full md:w-[300px] md:shrink-0 md:translate-x-0 md:shadow-none ${
          open ? "translate-x-0" : "translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <div className="flex min-w-0 items-center gap-2">
            <IconButton label="إغلاق القائمة" className="md:hidden" onClick={onCloseMobile}>
              <CloseIcon />
            </IconButton>
            <div className="min-w-0">
              <div className="brand-mark text-[22px] font-semibold leading-none text-sand">
                سِراج
              </div>
              <div className="mt-1 text-[11px] tracking-[0.18em] text-ink-mute">SIRAJ</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <IconButton label="بحث" className="hidden sm:inline-flex">
              <SearchIcon />
            </IconButton>
            <IconButton label="محادثة جديدة" onClick={onNewChat}>
              <PenIcon />
            </IconButton>
          </div>
        </div>

        <div className="px-3 pb-3">
          <SidebarItem
            onClick={() => {
              onNewChat();
              onCloseMobile();
            }}
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-copper/20 text-sand">
              <PenIcon size={14} />
            </span>
            <span>محادثة جديدة</span>
          </SidebarItem>
        </div>

        <div className="mx-4 h-px bg-line" />

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-2 text-[11px] font-medium tracking-[0.14em] text-ink-mute">
            المحادثات
          </p>
          <div className="flex flex-col gap-1">
            {conversations.length === 0 && (
              <p className="px-2 py-3 text-[13px] text-ink-mute">ابدأ أول خيط ضوء…</p>
            )}
            {conversations.map((chat) => {
              const preview =
                chat.messages.find((m) => m.role === "assistant")?.content ||
                chat.messages[0]?.content ||
                "";
              return (
                <div key={chat.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(chat.id);
                      onCloseMobile();
                    }}
                    className={`flex w-full flex-col gap-0.5 rounded-[14px] px-3 py-2.5 text-start transition-colors ${
                      activeId === chat.id
                        ? "bg-sand/12 text-ink"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate text-[14px] font-medium text-ink">
                      <ChatBubbleIcon />
                      <span className="truncate">{chat.title}</span>
                    </span>
                    {preview && (
                      <span className="truncate ps-6 text-[12px] text-ink-mute">
                        {preview}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label="حذف المحادثة"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(chat.id);
                    }}
                    className="absolute start-1 top-2 hidden rounded-[10px] p-1 text-ink-mute hover:bg-white/10 hover:text-sand group-hover:inline-flex"
                  >
                    <CloseIcon size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mx-4 h-px bg-line" />

        <div className="flex flex-col gap-2 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <p className="text-[13px] leading-relaxed text-ink-soft">
            مساحة هادئة للأسئلة، التحليل، والصور.
          </p>
          <button
            type="button"
            className="mt-1 inline-flex h-10 items-center justify-center rounded-full border border-line-strong bg-sand/10 px-4 text-[13px] font-medium text-sand transition-colors hover:bg-sand/20"
          >
            تسجيل الدخول
          </button>
        </div>
      </aside>
    </>
  );
}
