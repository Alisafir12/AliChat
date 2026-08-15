import { NextRequest } from "next/server";

type ImagePart = {
  mimeType: string;
  dataUrl: string;
};

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  images?: ImagePart[];
};

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM_PROMPT = `You are سِراج (Siraj), a helpful Arabic-first assistant.
Rules:
- Always follow the ongoing conversation context and prior messages.
- If the user corrects you (e.g. wants an image instead of text, or changes the topic details), obey the latest instruction while keeping earlier topic details.
- Reply in the same language the user writes in.
- When an image is attached, carefully analyze it.
- Be concrete and useful; do not ignore what the user already asked in this chat.`;

function hasImages(messages: ChatMessage[]) {
  return messages.some((m) => (m.images?.length || 0) > 0);
}

function looksLikeImageRequest(text: string) {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return /ارسم|ارسمى|رسمة|رسمه|رسّام|رسام|صورة|صوره|صوّر|صور لي|ولد صورة|ولّد|أنشئ صورة|انشئ صورة|اصنع صورة|سوي صورة|سوي لي صورة|طلع صورة|طلع لي صورة|أبغى صورة|ابغى صورة|ابي صورة|أريد صورة|اريد صورة|بدي صورة|وريني|ورّيني|اعرض صورة|تصميم صورة|تخيل صورة|تخيّل|مشهد|لقطة سينما|لا اريد وصف|ما ابي وصف|مو وصف|generate\s+(an?\s+)?image|draw\s+(me\s+)?|create\s+(an?\s+)?image|make\s+(an?\s+)?image|paint\s+|dall-?e|midjourney|text[\s-]?to[\s-]?image|illustration of|picture of|photo of|i want (a |an )?picture|show me (a |an )?(picture|image|photo)/i.test(
    t,
  );
}

function isVagueImageFollowUp(text: string) {
  const t = text.trim().toLowerCase();
  return /^(لا اريد وصف|ما ابي وصف|مو وصف|ابي صورة|أبغى صورة|أريد صورة|اريد صورة|بدي صورة|وريني|صورة|صوره|ارسم|generate|draw|picture|image)\b/i.test(
    t,
  ) || t.length < 40;
}

function conversationForImagePrompt(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-10)
    .map((m) => {
      const role = m.role === "user" ? "User" : "Assistant";
      const content = m.content.replace(/\s+/g, " ").trim().slice(0, 400);
      return `${role}: ${content}`;
    })
    .join("\n");
}

function splitDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function buildDemoReply(messages: ChatMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const question = lastUser?.content?.trim() || "";
  const isArabic = /[\u0600-\u06FF]/.test(question);
  if (lastUser?.images?.length) {
    return isArabic
      ? "أرى أنك أرفقت صورة. فعّل GEMINI_API_KEY لتحليل الصور."
      : "I see an attached image. Enable GEMINI_API_KEY for vision analysis.";
  }
  return isArabic
    ? "هذا رد تجريبي محلي. أضف GROQ_API_KEY أو GEMINI_API_KEY في .env.local."
    : "Local demo reply. Add GROQ_API_KEY or GEMINI_API_KEY in .env.local.";
}

async function streamText(text: string): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  const chunks = text.split(/(\s+)/);
  return new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
        await new Promise((r) => setTimeout(r, 8));
      }
      controller.close();
    },
  });
}

function parseProviderError(errText: string, fallback: string) {
  let detail = errText || fallback;
  try {
    const parsed = JSON.parse(errText) as {
      error?: { message?: string; code?: number | string; status?: string };
    };
    const msg = parsed.error?.message || "";
    const status = String(parsed.error?.status || parsed.error?.code || "");
    if (/quota|RESOURCE_EXHAUSTED|rate limit/i.test(msg + status)) {
      detail =
        "تم تجاوز حد Gemini المجاني لتوليد/تحليل الصور. انتظر قليلاً أو استخدم طلب نصي فقط.";
    } else if (/denied access|PERMISSION_DENIED/i.test(msg + status)) {
      detail = "حساب Gemini مرفوض الوصول لهذا المشروع.";
    } else if (/API key|invalid|UNAUTHENTICATED/i.test(msg + status)) {
      detail = "مفتاح الـ API غير صالح.";
    } else if (msg) {
      detail = msg;
    }
  } catch {
    // keep
  }
  return detail;
}

function toOpenAIMessages(messages: ChatMessage[]) {
  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    ...messages
      .filter((m) => m.role !== "system")
      .map((m) => {
        if (!m.images?.length) {
          return { role: m.role, content: m.content };
        }
        const parts: Array<
          | { type: "text"; text: string }
          | { type: "image_url"; image_url: { url: string } }
        > = [];
        if (m.content.trim()) parts.push({ type: "text", text: m.content });
        for (const img of m.images) {
          parts.push({ type: "image_url", image_url: { url: img.dataUrl } });
        }
        return { role: m.role, content: parts };
      }),
  ];
}

async function streamOpenAICompatible(options: {
  messages: ChatMessage[];
  apiKey: string;
  model: string;
  url: string;
  providerLabel: string;
}) {
  const res = await fetch(options.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      stream: true,
      temperature: 0.4,
      messages: toOpenAIMessages(options.messages),
    }),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      parseProviderError(errText, `${options.providerLabel} error ${res.status}`),
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const token = json.choices?.[0]?.delta?.content;
              if (token) controller.enqueue(encoder.encode(token));
            } catch {
              // ignore
            }
          }
        }
      } catch (error) {
        controller.error(error);
        return;
      }
      controller.close();
    },
    cancel() {
      reader.cancel().catch(() => undefined);
    },
  });
}

function toGeminiParts(message: ChatMessage) {
  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];

  if (message.content.trim()) parts.push({ text: message.content });

  for (const img of message.images || []) {
    const parsed = splitDataUrl(img.dataUrl);
    if (!parsed) continue;
    parts.push({
      inlineData: {
        mimeType: img.mimeType || parsed.mimeType,
        data: parsed.data,
      },
    });
  }

  if (!parts.length) parts.push({ text: " " });
  return parts;
}

async function streamGeminiVision(messages: ChatMessage[], apiKey: string) {
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: toGeminiParts(m),
    }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
    }),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new Error(parseProviderError(errText, `Gemini error ${res.status}`));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const json = JSON.parse(data) as {
                candidates?: Array<{
                  content?: {
                    parts?: Array<{
                      text?: string;
                      inlineData?: { mimeType?: string; data?: string };
                    }>;
                  };
                }>;
              };
              const parts = json.candidates?.[0]?.content?.parts || [];
              for (const part of parts) {
                if (part.text) controller.enqueue(encoder.encode(part.text));
                if (part.inlineData?.data) {
                  const mime = part.inlineData.mimeType || "image/png";
                  const md = `\n\n![صورة](data:${mime};base64,${part.inlineData.data})\n\n`;
                  controller.enqueue(encoder.encode(md));
                }
              }
            } catch {
              // ignore
            }
          }
        }
      } catch (error) {
        controller.error(error);
        return;
      }
      controller.close();
    },
    cancel() {
      reader.cancel().catch(() => undefined);
    },
  });
}

async function generateGeminiImage(prompt: string, apiKey: string) {
  const model =
    process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(parseProviderError(errText, `Gemini image error ${res.status}`));
  }

  const json = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          inlineData?: { mimeType?: string; data?: string };
        }>;
      };
    }>;
  };

  const parts = json.candidates?.[0]?.content?.parts || [];
  let text = "";
  const images: string[] = [];
  for (const part of parts) {
    if (part.text) text += part.text;
    if (part.inlineData?.data) {
      const mime = part.inlineData.mimeType || "image/png";
      images.push(`![صورة مولّدة](data:${mime};base64,${part.inlineData.data})`);
    }
  }

  if (!images.length) {
    throw new Error("لم يُرجع النموذج أي صورة.");
  }

  return [text.trim(), ...images].filter(Boolean).join("\n\n");
}

async function toEnglishImagePrompt(
  messages: ChatMessage[],
  lastUserText: string,
  groqKey?: string,
) {
  const context = conversationForImagePrompt(messages);
  const vague = isVagueImageFollowUp(lastUserText);

  let english = "";

  if (groqKey) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: `You create ONE English image-generation prompt from a chat transcript.
Rules:
- Use the FULL conversation topic, not only the last short message.
- If the user says they want a picture/photo instead of text, visualize the earlier requested subject (e.g. software company offices interior).
- Describe a concrete visual scene: place, people, objects, style, lighting.
- Under 28 words. Output ONLY the English prompt. No quotes.`,
            },
            {
              role: "user",
              content: `Conversation:\n${context}\n\nLatest user message: ${lastUserText}\n\nWrite the image prompt now.`,
            },
          ],
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        english = json.choices?.[0]?.message?.content?.trim() || "";
      }
    } catch {
      // fallback below
    }
  }

  if (!english || /[\u0600-\u06FF]/.test(english)) {
    // Build a crude fallback from earlier user messages (skip vague follow-ups)
    const priorUser = [...messages]
      .reverse()
      .find(
        (m) =>
          m.role === "user" &&
          m.content.trim() &&
          !isVagueImageFollowUp(m.content),
      );
    const source = priorUser?.content || lastUserText;
    english = vague
      ? `photorealistic interior scene related to: ${source}`
      : source;
  }

  english = english
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[^\w\s.,\-']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  if (!english) {
    english = "detailed photorealistic scene from the conversation topic";
  }

  return `${english}, photorealistic cinematic 8k`;
}

async function pollinationsImage(
  messages: ChatMessage[],
  lastUserText: string,
  groqKey?: string,
) {
  const priorTopic =
    [...messages]
      .reverse()
      .find(
        (m) =>
          m.role === "user" &&
          m.content.trim() &&
          !isVagueImageFollowUp(m.content),
      )?.content || lastUserText;

  const original = priorTopic.replace(/\s+/g, " ").trim().slice(0, 120);
  const englishPrompt = await toEnglishImagePrompt(
    messages,
    lastUserText,
    groqKey,
  );
  const seed = Date.now();
  const proxy = `/api/image?prompt=${encodeURIComponent(englishPrompt)}&seed=${seed}`;

  return [
    "إليك الصورة المولّدة حسب سياق المحادثة:",
    "",
    `![صورة مولّدة](${proxy})`,
    "",
    `_الموضوع:_ ${original}`,
  ].join("\n");
}

async function handleImageGeneration(
  messages: ChatMessage[],
  lastUserText: string,
  options: { geminiKey?: string; groqKey?: string },
) {
  const preferGemini =
    process.env.IMAGE_PROVIDER === "gemini" && options.geminiKey;
  if (preferGemini && options.geminiKey) {
    try {
      const contextual =
        conversationForImagePrompt(messages) + `\nUser: ${lastUserText}`;
      return await generateGeminiImage(contextual, options.geminiKey);
    } catch {
      // fallback
    }
  }
  return pollinationsImage(messages, lastUserText, options.groqKey);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      messages?: ChatMessage[];
      mode?: "chat" | "image";
    };
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const wantsImage =
      body.mode === "image" || looksLikeImageRequest(lastUser?.content || "");
    const withImages = hasImages(messages);

    const groqKey = process.env.GROQ_API_KEY?.trim();
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const openaiKey = process.env.OPENAI_API_KEY?.trim();

    let stream: ReadableStream<Uint8Array>;

    // مهم: طلبات الرسم يجب ألا تذهب أبداً لنموذج نصي مثل Groq
    if (wantsImage && !withImages) {
      const content = await handleImageGeneration(
        messages,
        lastUser?.content || "a detailed scene",
        { geminiKey, groqKey },
      );
      // صورة كاملة دفعة واحدة (بدون تقطيع بطيء) حتى لا ينكسر data URL
      const encoder = new TextEncoder();
      stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(content));
          controller.close();
        },
      });
    } else if (withImages && geminiKey) {
      stream = await streamGeminiVision(messages, geminiKey);
    } else if (withImages && groqKey) {
      stream = await streamOpenAICompatible({
        messages,
        apiKey: groqKey,
        model:
          process.env.GROQ_VISION_MODEL ||
          "meta-llama/llama-4-scout-17b-16e-instruct",
        url: "https://api.groq.com/openai/v1/chat/completions",
        providerLabel: "Groq Vision",
      });
    } else if (groqKey && !withImages) {
      stream = await streamOpenAICompatible({
        messages,
        apiKey: groqKey,
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        url: "https://api.groq.com/openai/v1/chat/completions",
        providerLabel: "Groq",
      });
    } else if (geminiKey) {
      stream = await streamGeminiVision(messages, geminiKey);
    } else if (openaiKey) {
      stream = await streamOpenAICompatible({
        messages,
        apiKey: openaiKey,
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        url: "https://api.openai.com/v1/chat/completions",
        providerLabel: "OpenAI",
      });
    } else {
      stream = await streamText(buildDemoReply(messages));
    }

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error";
    return new Response(message, { status: 500 });
  }
}
