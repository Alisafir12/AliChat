"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Composer } from "@/components/Composer";
import { MenuIcon } from "@/components/Icons";
import { IconButton } from "@/components/IconButton";
import { MessageBubble, Welcome } from "@/components/MessageViews";
import { Sidebar } from "@/components/Sidebar";
import { loadConversations, saveConversations } from "@/lib/storage";
import {
  createId,
  looksLikeImageRequest,
  titleFromMessage,
  type Conversation,
  type ImageAttachment,
  type Message,
} from "@/lib/types";

export function ChatApp() {
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = loadConversations();
    setConversations(stored);
    setActiveId(stored[0]?.id ?? null);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveConversations(conversations);
  }, [conversations, ready]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [active?.messages, streaming]);

  const upsertConversation = useCallback((next: Conversation) => {
    setConversations((prev) => {
      const without = prev.filter((c) => c.id !== next.id);
      return [next, ...without].sort((a, b) => b.updatedAt - a.updatedAt);
    });
  }, []);

  function handleNewChat() {
    setActiveId(null);
    setSidebarOpen(false);
  }

  function handleDelete(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  }

  function handleStop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }

  async function handleSend(text: string, images: ImageAttachment[] = []) {
    const now = Date.now();
    const generatingImage = looksLikeImageRequest(text) && images.length === 0;
    const userMessage: Message = {
      id: createId("msg"),
      role: "user",
      content: text,
      images: images.length ? images : undefined,
      createdAt: now,
    };

    let conversation = active;
    if (!conversation) {
      conversation = {
        id: createId("chat"),
        title: titleFromMessage(text, images.length > 0),
        messages: [],
        updatedAt: now,
      };
      setActiveId(conversation.id);
    }

    const assistantId = createId("msg");
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: generatingImage ? "جاري تجهيز طلب الصورة…" : "",
      createdAt: now + 1,
    };

    const withUser: Conversation = {
      ...conversation,
      title:
        conversation.messages.length === 0
          ? titleFromMessage(text, images.length > 0)
          : conversation.title,
      messages: [...conversation.messages, userMessage, assistantMessage],
      updatedAt: now,
    };

    upsertConversation(withUser);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const history = withUser.messages
        .filter((m) => m.id !== assistantId)
        .map(({ role, content, images: imgs }) => ({
          role,
          content,
          images: imgs?.map(({ mimeType, dataUrl }) => ({ mimeType, dataUrl })),
        }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          mode: looksLikeImageRequest(text) ? "image" : "chat",
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || "فشل الاتصال بالخادم");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        const snapshot = full;
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== withUser.id) return c;
            return {
              ...c,
              updatedAt: Date.now(),
              messages: c.messages.map((m) =>
                m.id === assistantId ? { ...m, content: snapshot } : m,
              ),
            };
          }),
        );
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // stopped by user
      } else {
        const fallback =
          (err as Error).message ||
          "عذراً، حدث خطأ أثناء توليد الرد. حاول مرة أخرى.";
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== withUser.id) return c;
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content || fallback }
                  : m,
              ),
            };
          }),
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  if (!ready) {
    return (
      <div className="app-shell flex h-dvh items-center justify-center text-ink-mute">
        يضيء سِراج…
      </div>
    );
  }

  const messages = active?.messages ?? [];
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const isStreamingLast =
    streaming && lastAssistant && lastAssistant.content !== undefined;

  return (
    <div className="app-shell relative flex h-dvh w-full max-w-[100vw] overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
        conversations={conversations}
        activeId={activeId}
        onNewChat={handleNewChat}
        onSelect={setActiveId}
        onDelete={handleDelete}
      />

      <main className="relative flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
        <header className="flex h-[56px] shrink-0 items-center gap-2 border-b border-line/40 px-3 sm:h-[60px] sm:gap-3 sm:px-4">
          <IconButton
            label="فتح القائمة"
            className="shrink-0 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <MenuIcon />
          </IconButton>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-medium text-ink sm:text-[15px]">
              {active?.title ?? "محادثة جديدة"}
            </div>
            <div className="text-[11px] tracking-[0.16em] text-ink-mute">
              {streaming ? "يكتب الآن" : "جاهز"}
            </div>
          </div>
        </header>

        <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overflow-x-hidden">
          {messages.length === 0 ? (
            <Welcome onSuggestion={(text) => handleSend(text, [])} />
          ) : (
            <div className="mx-auto w-full max-w-[760px] flex-1 px-3 pb-4 sm:px-4">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  streaming={
                    Boolean(
                      isStreamingLast &&
                        message.id === lastAssistant?.id &&
                        streaming,
                    )
                  }
                />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="w-full shrink-0 border-t border-line/30 bg-[rgba(7,20,18,0.72)] backdrop-blur-md">
          <Composer
            streaming={streaming}
            onSend={handleSend}
            onStop={handleStop}
          />
        </div>
      </main>
    </div>
  );
}
