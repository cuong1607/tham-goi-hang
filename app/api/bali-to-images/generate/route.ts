import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import fs from "fs";
import { parseOrderText, aggregateByPattern } from "@/lib/bali-image/parsers";
import {
  findSourceImage,
  renderImage,
  saveImage,
  getPublicUrl,
  getOutputPath,
  clearOutputDir,
} from "@/lib/bali-image/renderer";
import { BaliImageResult, GenerateResponse } from "@/lib/bali-image/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const orderText: string = (body.orderText ?? "").trim();
    const showCaption: boolean = body.options?.showCaption !== false;

    if (!orderText) {
      return NextResponse.json(
        { success: false, error: "Vui lòng nhập text gọi hàng." },
        { status: 400 }
      );
    }

    // --- Parse ---
    const rawItems = parseOrderText(orderText);
    if (rawItems.length === 0) {
      return NextResponse.json(
        { success: false, error: "Không parse được text gọi hàng. Kiểm tra format: GROUP\nsize: mã." },
        { status: 400 }
      );
    }

    // --- Aggregate by group+pattern ---
    const aggregated = aggregateByPattern(rawItems, (group, pattern) =>
      findSourceImage(group, pattern)
    );

    // --- Clear old output ---
    clearOutputDir();

    // --- Render each image ---
    const results: BaliImageResult[] = [];
    const missingImages: Array<{ group: string; pattern: string; caption: string }> = [];

    for (const agg of aggregated) {
      if (!agg.sourceImagePath) {
        missingImages.push({
          group: agg.group,
          pattern: agg.pattern,
          caption: agg.caption,
        });
        results.push({
          group: agg.group,
          pattern: agg.pattern,
          caption: agg.caption,
          sizeSummary: agg.sizeSummary,
          sourceImagePath: null,
          outputUrl: null,
          fileName: agg.fileName,
          status: "missing_source",
        });
        continue;
      }

      try {
        const buffer = await renderImage(agg, { showCaption });
        saveImage(agg.fileName, buffer);

        results.push({
          group: agg.group,
          pattern: agg.pattern,
          caption: agg.caption,
          sizeSummary: agg.sizeSummary,
          sourceImagePath: agg.sourceImagePath,
          outputUrl: getPublicUrl(agg.fileName),
          fileName: agg.fileName,
          status: "generated",
        });
      } catch (err) {
        results.push({
          group: agg.group,
          pattern: agg.pattern,
          caption: agg.caption,
          sizeSummary: agg.sizeSummary,
          sourceImagePath: agg.sourceImagePath,
          outputUrl: null,
          fileName: agg.fileName,
          status: "error",
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // --- Build ZIP from all generated images ---
    const generatedItems = results.filter((r) => r.status === "generated");
    let zipUrl: string | null = null;

    if (generatedItems.length > 0) {
      const zip = new JSZip();
      for (const item of generatedItems) {
        const filePath = getOutputPath(item.fileName);
        if (fs.existsSync(filePath)) {
          const fileBuffer = fs.readFileSync(filePath);
          zip.file(item.fileName, fileBuffer);
        }
      }
      const zipBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      const zipFileName = `bali-to-goi-hang-${Date.now()}.zip`;
      saveImage(zipFileName, zipBuffer);
      zipUrl = getPublicUrl(zipFileName);
    }

    const response: GenerateResponse = {
      success: true,
      items: results,
      missingImages,
      zipUrl,
      totalGenerated: generatedItems.length,
      totalMissing: missingImages.length,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[bali-to-images/generate]", err);
    return NextResponse.json(
      { success: false, error: "Lỗi server: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
