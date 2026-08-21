import { NextResponse } from "next/server";
import { generate, llmConfigured } from "../_lib/llm";

/**
 * 브랜드 웹사이트 스캔 — 실제 사이트를 읽고 LLM(Gemini→Claude)으로 브랜드 프로필을 만든다.
 * 키가 없거나 실패하면 { ok: false }로 응답하고,
 * 클라이언트는 결정론 목업으로 폴백한다 (라이브 데모 안전장치).
 */

export const runtime = "nodejs";
export const maxDuration = 60;

type ScanProfile = {
  name: string;
  tagline: string;
  tone: string[];
  products: { name: string; desc: string }[];
  audience: string;
  color: string;
};

function absolutize(href: string, base: string) {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

async function fetchSite(url: string) {
  const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(target, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 knot-agent/1.0",
        accept: "text/html,application/xhtml+xml",
      },
    });
    const html = (await res.text()).slice(0, 200_000);
    return { finalUrl: res.url || target, html };
  } finally {
    clearTimeout(timer);
  }
}

function extractHints(html: string, baseUrl: string) {
  const pick = (re: RegExp) => html.match(re)?.[1]?.trim() ?? null;
  const meta = (name: string) =>
    pick(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i")) ??
    pick(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, "i"));
  const logoRaw =
    meta("og:image") ??
    pick(/<link[^>]+rel=["'](?:apple-touch-icon|icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/i);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 7000);
  return {
    title: pick(/<title[^>]*>([^<]+)<\/title>/i),
    description: meta("description") ?? meta("og:description"),
    siteName: meta("og:site_name"),
    themeColor: meta("theme-color"),
    logo: logoRaw ? absolutize(logoRaw, baseUrl) : null,
    text,
  };
}


// Vercel 등 GCP 밖 배포에서는 LLM 호출을 Cloud Run(키리스 Vertex)으로 위임한다.
async function proxyUpstream(req: Request, path: string): Promise<Response | null> {
  const upstream = process.env.LLM_UPSTREAM;
  if (!upstream) return null;
  try {
    const res = await fetch(`${upstream}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await req.clone().text(),
      signal: AbortSignal.timeout(55_000),
    });
    return new Response(await res.text(), {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const proxied = await proxyUpstream(req, "/api/knot/scan");
  if (proxied) return proxied;
  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  if (!url || typeof url !== "string") {
    return NextResponse.json({ ok: false, reason: "bad-url" });
  }

  let hints: ReturnType<typeof extractHints> | null = null;
  let finalUrl = url;
  try {
    const site = await fetchSite(url);
    finalUrl = site.finalUrl;
    hints = extractHints(site.html, site.finalUrl);
  } catch {
    return NextResponse.json({ ok: false, reason: "fetch-failed" });
  }

  if (!llmConfigured()) {
    // 키가 없으면 LLM 없이 힌트만 돌려준다 — 클라이언트가 목업과 병합.
    return NextResponse.json({ ok: false, reason: "no-key", hints, finalUrl });
  }

  try {
    const raw = await generate({
      system:
        "당신은 브랜드 전략가입니다. 웹사이트에서 추출한 텍스트를 읽고 브랜드 프로필을 만듭니다. " +
        "반드시 아래 형태의 JSON만 출력하세요 (코드펜스·설명 금지). 한국어로, 톤은 간결하고 감각적으로:\n" +
        '{"name":"브랜드명(한글 우선)","tagline":"12자 내외 한줄","tone":["형용사","형용사","형용사"],' +
        '"products":[{"name":"제품/서비스명","desc":"10자 내외"},{"name":"...","desc":"..."}],' +
        '"audience":"타깃 한 줄","color":"#rrggbb (브랜드 무드에 맞는 색)"}',
      turns: [
        {
          role: "user",
          content: `URL: ${finalUrl}\ntitle: ${hints.title ?? "-"}\ndescription: ${hints.description ?? "-"}\nsite_name: ${hints.siteName ?? "-"}\ntheme_color: ${hints.themeColor ?? "-"}\n\n본문 발췌:\n${hints.text}`,
        },
      ],
      json: true,
      maxTokens: 2000,
    });
    if (!raw) {
      return NextResponse.json({ ok: false, reason: "llm-failed", hints, finalUrl });
    }
    const json = raw.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "").trim();
    const profile = JSON.parse(json) as ScanProfile;
    return NextResponse.json({ ok: true, profile, logo: hints.logo, finalUrl });
  } catch {
    return NextResponse.json({ ok: false, reason: "llm-failed", hints, finalUrl });
  }
}
