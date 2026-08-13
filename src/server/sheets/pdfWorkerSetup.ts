import path from "node:path";
import { PDFParse } from "pdf-parse";

/**
 * pdfjs-dist (used internally by pdf-parse) tries to auto-resolve its own
 * worker file relative to its bundled module location. Under Next.js /
 * Turbopack that path gets rewritten and no longer exists on disk, which
 * fails with "Setting up fake worker failed: Cannot find module
 * .../pdf.worker.mjs". Pointing it at the real on-disk file explicitly
 * sidesteps that. Side-effect import this once before using PDFParse.
 */
PDFParse.setWorker(
  path.join(process.cwd(), "node_modules/pdf-parse/dist/pdf-parse/esm/pdf.worker.mjs"),
);
