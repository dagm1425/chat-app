import { pdfjs } from "react-pdf";

let isPdfWorkerReady = false;

export function setupPdfWorker() {
  if (isPdfWorkerReady) return;

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  isPdfWorkerReady = true;
}
