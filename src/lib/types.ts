export type Role = "user" | "assistant" | "system";

export type ImageAttachment = {
  id: string;
  mimeType: string;
  dataUrl: string;
};

export type Message = {
  id: string;
  role: Role;
  content: string;
  images?: ImageAttachment[];
  createdAt: number;
};

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

export function createId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function titleFromMessage(content: string, hasImages = false) {
  const cleaned = content.replace(/\s+/g, " ").trim();
  if (!cleaned) return hasImages ? "تحليل صورة" : "محادثة جديدة";
  return cleaned.length > 42 ? `${cleaned.slice(0, 42)}…` : cleaned;
}

export function looksLikeImageRequest(text: string) {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return /ارسم|ارسمى|رسمة|رسمه|رسّام|رسام|صورة|صوره|صوّر|صور لي|ولد صورة|ولّد|أنشئ صورة|انشئ صورة|اصنع صورة|سوي صورة|سوي لي صورة|طلع صورة|طلع لي صورة|أبغى صورة|ابغى صورة|ابي صورة|أريد صورة|اريد صورة|بدي صورة|وريني|ورّيني|اعرض صورة|تصميم صورة|تخيل صورة|تخيّل|مشهد|لقطة سينما|لا اريد وصف|ما ابي وصف|مو وصف|generate\s+(an?\s+)?image|draw\s+(me\s+)?|create\s+(an?\s+)?image|make\s+(an?\s+)?image|paint\s+|dall-?e|midjourney|text[\s-]?to[\s-]?image|illustration of|picture of|photo of|i want (a |an )?picture|show me (a |an )?(picture|image|photo)/i.test(
    t,
  );
}

export async function fileToAttachment(file: File): Promise<ImageAttachment> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("تعذر قراءة الملف"));
    reader.readAsDataURL(file);
  });

  return {
    id: createId("img"),
    mimeType: file.type || "image/jpeg",
    dataUrl,
  };
}
