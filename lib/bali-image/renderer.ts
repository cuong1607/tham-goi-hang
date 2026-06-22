// ============================================================
// Renderer — đọc ảnh gốc + composite SVG text overlay (sharp)
// ============================================================
// Server-side only. Never import this in client components.

import sharp from "sharp";
import fs from "fs";
import path from "path";
import { BaliImageAggregated } from "./types";
import { normalizePattern } from "./normalizers";

// ============================================================
// Source image lookup
// ============================================================

const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const ASSETS_BASE = path.join(process.cwd(), "public", "assets", "bali-to");
const OUTPUT_BASE = path.join(process.cwd(), "public", "generated", "bali-to");

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
// SVG overlay builder
// ============================================================

/**
 * Tính font size tự động dựa trên độ dài chuỗi và chiều rộng ảnh.
 */
function calcFontSize(text: string, maxWidth: number): number {
  const sizes = [56, 48, 40, 32, 26, 20, 16];
  for (const size of sizes) {
    if (text.length * size * 0.58 < maxWidth - 40) return size;
  }
  return 16;
}

/**
 * Build SVG overlay: chỉ text size summary, không có khung, không có caption.
 * Text trắng + viền đen (paint-order: stroke fill) để đọc được trên mọi nền ảnh.
 * Tự xuống dòng nếu chuỗi quá dài.
 */
function buildOverlaySVG(
  sizeSummary: string,
  imgWidth: number,
  imgHeight: number
): Buffer {
  const fontSize = calcFontSize(sizeSummary, imgWidth);
  const strokeW = Math.max(2, Math.round(fontSize * 0.08));

  // Wrap dài → xuống dòng tại " + "
  const parts = sizeSummary.split(" + ");
  const LINE_MAX = Math.floor((imgWidth - 40) / (fontSize * 0.58));
  const lines: string[] = [];
  let cur = "";
  for (const part of parts) {
    const candidate = cur ? cur + " + " + part : part;
    if (candidate.length > LINE_MAX && cur) {
      lines.push(cur);
      cur = part;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);

  const lineH = fontSize + 10;
  const totalTextH = lines.length * lineH;
  // Căn giữa theo chiều dọc
  const startY = (imgHeight - totalTextH) / 2 + fontSize;

  const textLines = lines
    .map((line, i) => {
      const y = startY + i * lineH;
      return `<text
        x="${imgWidth / 2}"
        y="${y}"
        text-anchor="middle"
        dominant-baseline="auto"
        font-family="Arial Black, Arial, Helvetica, sans-serif"
        font-size="${fontSize}"
        font-weight="900"
        fill="white"
        stroke="black"
        stroke-width="${strokeW}"
        paint-order="stroke fill"
      >${escapeXml(line)}</text>`;
    })
    .join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${imgWidth}" height="${imgHeight}">
  ${textLines}
</svg>`;

  return Buffer.from(svg);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ============================================================
// Render a single image
// ============================================================

export type RenderOptions = {
  showCaption?: boolean; // kept for API compat, no longer used
};

/**
 * Đọc ảnh gốc, composite text-only SVG overlay lên giữa ảnh, trả về Buffer JPEG.
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

  const overlaySvg = buildOverlaySVG(agg.sizeSummary, imgWidth, imgHeight);

  const outputBuffer = await sharp(srcPath)
    .composite([{ input: overlaySvg, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();

  return outputBuffer;
}


// ============================================================
// Save image to output folder
// ============================================================

/**
 * Đảm bảo thư mục output tồn tại và lưu buffer vào file.
 */
export function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_BASE)) {
    fs.mkdirSync(OUTPUT_BASE, { recursive: true });
  }
}

export function saveImage(fileName: string, buffer: Buffer): string {
  ensureOutputDir();
  const filePath = path.join(OUTPUT_BASE, fileName);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * URL preview công khai của file đã lưu.
 */
export function getPublicUrl(fileName: string): string {
  return `/generated/bali-to/${fileName}`;
}

/**
 * Đường dẫn tuyệt đối của output file (để đọc lại khi zip).
 */
export function getOutputPath(fileName: string): string {
  return path.join(OUTPUT_BASE, fileName);
}

/**
 * Xóa toàn bộ thư mục output cũ trước mỗi lần generate mới.
 */
export function clearOutputDir(): void {
  if (fs.existsSync(OUTPUT_BASE)) {
    const files = fs.readdirSync(OUTPUT_BASE);
    for (const f of files) {
      fs.unlinkSync(path.join(OUTPUT_BASE, f));
    }
  }
}
