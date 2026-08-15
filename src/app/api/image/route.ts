import { NextRequest } from "next/server";
import { createHash } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 120;

type CacheEntry = {
  mime: string;
  buffer: Buffer;
  expires: number;
};

const memoryCache = new Map<string, CacheEntry>();

function cacheKey(prompt: string, seed: string) {
  return createHash("sha256").update(`${prompt}::${seed}`).digest("hex");
}

function sanitizePrompt(prompt: string) {
  return prompt
    .replace(/[^\w\s.,\-']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

async function fromPollinations(prompt: string, seed: string) {
  const encoded = encodeURIComponent(prompt);
  const remoteUrl = `https://image.pollinations.ai/prompt/${encoded}?width=768&height=768&nologo=true&seed=${encodeURIComponent(seed)}`;
  const res = await fetch(remoteUrl, {
    headers: {
      Accept: "image/jpeg,image/png,image/*,*/*",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`pollinations ${res.status}`);
  const mime = res.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!mime.startsWith("image/") || buffer.length < 1000) {
    throw new Error("pollinations invalid payload");
  }
  return { mime, buffer };
}

async function fromStableHorde(prompt: string) {
  const start = await fetch("https://stablehorde.net/api/v2/generate/async", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: "0000000000",
      "Client-Agent": "ChatGPT-App:1.0:cursor",
    },
    body: JSON.stringify({
      prompt,
      nsfw: false,
      censor_nsfw: true,
      r2: true,
      shared: false,
      models: ["stable_diffusion"],
      params: {
        width: 512,
        height: 512,
        steps: 20,
        cfg_scale: 7,
        n: 1,
      },
    }),
  });

  if (!start.ok) {
    const t = await start.text().catch(() => "");
    throw new Error(`horde start ${start.status} ${t.slice(0, 120)}`);
  }

  const started = (await start.json()) as { id?: string };
  if (!started.id) throw new Error("horde missing id");

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const check = await fetch(
      `https://stablehorde.net/api/v2/generate/status/${started.id}`,
      {
        headers: { "Client-Agent": "ChatGPT-App:1.0:cursor" },
        cache: "no-store",
      },
    );
    if (!check.ok) continue;
    const status = (await check.json()) as {
      done?: boolean;
      faulted?: boolean;
      generations?: Array<{ img?: string }>;
    };
    if (status.faulted) throw new Error("horde faulted");
    if (!status.done) continue;

    const img = status.generations?.[0]?.img;
    if (!img) throw new Error("horde empty generation");

    // R2 mode returns a URL; otherwise base64
    if (img.startsWith("http")) {
      const imgRes = await fetch(img, { cache: "no-store" });
      if (!imgRes.ok) throw new Error(`horde image ${imgRes.status}`);
      const mime = imgRes.headers.get("content-type") || "image/webp";
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      return { mime, buffer };
    }

    const buffer = Buffer.from(img, "base64");
    return { mime: "image/webp", buffer };
  }

  throw new Error("horde timeout");
}

export async function GET(req: NextRequest) {
  const promptRaw = req.nextUrl.searchParams.get("prompt")?.trim();
  const seed = req.nextUrl.searchParams.get("seed") || String(Date.now());

  if (!promptRaw) {
    return new Response("missing prompt", { status: 400 });
  }

  const prompt = sanitizePrompt(promptRaw) || "cinematic photorealistic scene";
  const key = cacheKey(prompt, seed);
  const cached = memoryCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return new Response(new Uint8Array(cached.buffer), {
      headers: {
        "Content-Type": cached.mime,
        "Cache-Control": "public, max-age=3600",
        "X-Image-Cache": "hit",
      },
    });
  }

  const errors: string[] = [];

  // 1) Pollinations (fast when available)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await fromPollinations(
        prompt,
        attempt === 0 ? seed : `${seed}-${attempt}`,
      );
      memoryCache.set(key, {
        ...result,
        expires: Date.now() + 1000 * 60 * 30,
      });
      return new Response(new Uint8Array(result.buffer), {
        headers: {
          "Content-Type": result.mime,
          "Cache-Control": "public, max-age=3600",
          "X-Image-Provider": "pollinations",
        },
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "pollinations");
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // 2) Stable Horde fallback (free distributed SD)
  try {
    const result = await fromStableHorde(prompt);
    memoryCache.set(key, {
      ...result,
      expires: Date.now() + 1000 * 60 * 30,
    });
    return new Response(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": result.mime,
        "Cache-Control": "public, max-age=3600",
        "X-Image-Provider": "stablehorde",
      },
    });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "horde");
  }

  return new Response(`failed to generate image: ${errors.join(" | ")}`, {
    status: 502,
  });
}
