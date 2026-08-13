import { classifySheet, UnsupportedFileTypeError } from "@/server/sheets/classify";
import { parseFormFieldPdf } from "@/server/sheets/formFieldParser";
import { parseTextLayerPdf } from "@/server/sheets/textLayerParser";
import { parseSheetImage } from "@/server/sheets/visionParser";
import { rasterizeFirstPage } from "@/server/sheets/rasterizePdf";
import { parseFormData } from "@/server/http";
import type { SheetKind } from "@/server/sheets/types";

export async function POST(request: Request) {
  const formDataResult = await parseFormData(request);
  if (!formDataResult.ok) return formDataResult.response;
  const formData = formDataResult.data;
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "no_file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";

  let kind: SheetKind;
  try {
    kind = await classifySheet(buffer, mimeType);
  } catch (err) {
    if (err instanceof UnsupportedFileTypeError) {
      return Response.json({ error: "unsupported_file", message: err.message }, { status: 400 });
    }
    return Response.json(
      { error: "classify_failed", message: (err as Error).message ?? "Couldn't read this file." },
      { status: 400 },
    );
  }

  try {
    switch (kind) {
      case "form-field-pdf": {
        const result = await parseFormFieldPdf(buffer);
        return Response.json({ kind, ...result });
      }
      case "text-layer-pdf": {
        const result = await parseTextLayerPdf(buffer);
        return Response.json({ kind, ...result });
      }
      case "image": {
        const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
        const result = await parseSheetImage(dataUrl);
        return Response.json({ kind, ...result });
      }
      case "scanned-pdf": {
        const dataUrl = await rasterizeFirstPage(buffer);
        const result = await parseSheetImage(dataUrl);
        return Response.json({ kind, ...result });
      }
    }
  } catch (err) {
    const e = err as { status?: number; code?: string; message?: string };
    return Response.json(
      {
        error: "parse_failed",
        kind,
        status: e.status,
        code: e.code,
        message: e.message ?? "Failed to parse this sheet.",
      },
      { status: 502 },
    );
  }
}
