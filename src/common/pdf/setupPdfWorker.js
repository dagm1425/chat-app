import { pdfjs } from "react-pdf";

let isPdfWorkerReady = false;

export function setupPdfWorker() {
  if (isPdfWorkerReady) return;

  // Use a stable worker URL that behaves consistently in dev and production builds.
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  isPdfWorkerReady = true;
}
