// ============================================================
// Renderer — đọc ảnh gốc + composite text overlay
// ============================================================
// Dùng @resvg/resvg-js (WASM) để render SVG text → PNG.
// Không phụ thuộc system fonts (fontconfig). Hoạt động trên Vercel.
// Server-side only. Never import this in client components.

import sharp from "sharp";
import fs from "fs";
import path from "path";
import { Resvg } from "@resvg/resvg-js";
import { BaliImageAggregated } from "./types";
import { normalizePattern } from "./normalizers";

// ============================================================
// Source image lookup
// ============================================================

const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const ASSETS_BASE = path.join(process.cwd(), "public", "assets", "bali-to");

/**
 * Tìm file ảnh mẫu gốc theo group + pattern.
 * Hỗ trợ:
 *   - BACAU/08.jpg  (pattern = "08")
 *   - BACAU/8.jpg   (fallback bỏ leading zero)
 *   - .jpg / .jpeg / .png / .webp
 */
export function findSourceImage(group: string, pattern: string): string | null {
  const groupDir = path.join(ASSETS_BASE, group);
  if (!fs.existsSync(groupDir)) return null;

  const normalizedPat = normalizePattern(pattern); // e.g. "8" from "08"
  const candidates: string[] = [];

  // Try both raw and normalized (leading-zero stripped)
  const patternVariants = new Set([pattern, normalizedPat]);
  // Also try zero-padded version if numeric (2 → 02)
  if (/^\d+$/.test(normalizedPat)) {
    patternVariants.add(normalizedPat.padStart(2, "0"));
  }

  for (const pat of Array.from(patternVariants)) {
    for (const ext of SUPPORTED_EXTENSIONS) {
      candidates.push(path.join(groupDir, `${pat}${ext}`));
    }
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

// ============================================================
// Font loading (cached, chỉ đọc 1 lần)
// ============================================================

let _fontData: Buffer | null = null;

function loadFontData(): Buffer {
  if (_fontData) return _fontData;
  // Thử nhiều đường dẫn để tìm font file
  const candidates = [
    path.join(process.cwd(), "fonts", "inter-black.ttf"),
    path.join(process.cwd(), "public", "fonts", "inter-black.ttf"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      _fontData = fs.readFileSync(p);
      return _fontData;
    }
  }
  throw new Error(
    `Font file not found. Tried: ${candidates.join(", ")}`
  );
}

// ============================================================
// SVG overlay builder
// ============================================================

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build SVG overlay: text size summary căn giữa ảnh.
 * Font size = ~8% chiều rộng ảnh để luôn đọc được dù ảnh lớn hay nhỏ.
 * Text trắng + viền đen dày để đọc được trên mọi nền ảnh.
 */
function buildOverlaySVG(
  sizeSummary: string,
  imgWidth: number,
  imgHeight: number
): string {
  // Font size = 8% chiều rộng ảnh, giới hạn trong [24, 200]
  const fontSize = Math.max(24, Math.min(200, Math.round(imgWidth * 0.08)));
  const strokeW = Math.max(3, Math.round(fontSize * 0.12));
  // Padding ngang = 5% mỗi bên
  const padX = Math.round(imgWidth * 0.05);
  const usableWidth = imgWidth - padX * 2;

  // Wrap tại " + " nếu text quá dài
  const parts = sizeSummary.split(" + ");
  const charsPerLine = Math.floor(usableWidth / (fontSize * 0.6));
  const lines: string[] = [];
  let cur = "";
  for (const part of parts) {
    const candidate = cur ? cur + " + " + part : part;
    if (candidate.length > charsPerLine && cur) {
      lines.push(cur);
      cur = part;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);

  const lineH = fontSize * 1.4;
  const totalTextH = lines.length * lineH;
  const startY = (imgHeight - totalTextH) / 2 + fontSize;

  const textLines = lines
    .map((line, i) => {
      const y = startY + i * lineH;
      return `<text
        x="${imgWidth / 2}"
        y="${y}"
        text-anchor="middle"
        dominant-baseline="auto"
        font-family="Inter"
        font-size="${fontSize}"
        font-weight="900"
        fill="white"
        stroke="black"
        stroke-width="${strokeW}"
        paint-order="stroke fill"
      >${escapeXml(line)}</text>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${imgWidth}" height="${imgHeight}">
  ${textLines}
</svg>`;
}

/**
 * Render SVG text overlay thành PNG buffer (transparent background)
 * bằng @resvg/resvg-js — WASM, không cần system fonts.
 */

let _tmpFontPath: string | null = null;

function ensureFontFile(): string {
  if (_tmpFontPath && fs.existsSync(_tmpFontPath)) return _tmpFontPath;

  const fontData = loadFontData();

  // Trên Vercel, chỉ /tmp là writable. Local thì dùng thư mục project.
  const tmpDir = process.env.VERCEL ? "/tmp" : process.cwd();
  const fontPath = path.join(tmpDir, "inter-black.ttf");

  if (!fs.existsSync(fontPath)) {
    fs.writeFileSync(fontPath, fontData);
  }
  _tmpFontPath = fontPath;
  return fontPath;
}

function renderSvgToPng(svgString: string): Buffer {
  const fontPath = ensureFontFile();

  const resvg = new Resvg(svgString, {
    font: {
      fontFiles: [fontPath],
      loadSystemFonts: false,
      defaultFontFamily: "Inter",
    },
  });

  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}

// ============================================================
// Render a single image
// ============================================================

export type RenderOptions = {
  showCaption?: boolean; // kept for API compat, no longer used
};

/**
 * Đọc ảnh gốc, render text overlay bằng resvg → PNG,
 * composite lên ảnh bằng sharp, trả về Buffer JPEG.
 */
export async function renderImage(
  agg: BaliImageAggregated,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options: RenderOptions = {}
): Promise<Buffer> {
  const srcPath = agg.sourceImagePath!;

  const meta = await sharp(srcPath).metadata();
  const imgWidth = meta.width ?? 800;
  const imgHeight = meta.height ?? 800;

  // Build SVG text overlay
  const svgString = buildOverlaySVG(agg.sizeSummary, imgWidth, imgHeight);

  // Render SVG → PNG bằng resvg (WASM, không cần fontconfig)
  const overlayPng = renderSvgToPng(svgString);

  // Composite PNG overlay lên ảnh gốc
  const outputBuffer = await sharp(srcPath)
    .composite([{ input: overlayPng, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();

  return outputBuffer;
}
