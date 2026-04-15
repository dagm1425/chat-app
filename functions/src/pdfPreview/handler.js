/* eslint-env node */
const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const {
  createCanvas,
  DOMMatrix,
  ImageData,
  Path2D,
} = require("@napi-rs/canvas");

const CHAT_PDF_MEDIA_ROLE = "chat_pdf";
const CHAT_PDF_PREVIEW_MEDIA_ROLE = "chat_pdf_preview";
const PDF_PREVIEW_FILE_NAME = "preview-server.jpg";
const PDF_PREVIEW_CONTENT_TYPE = "image/jpeg";
const PDF_PREVIEW_CACHE_CONTROL = "public,max-age=604800,immutable";
const PDF_PREVIEW_MAX_EDGE = 320;
const PDF_PREVIEW_PAGE_HEIGHT_MULTIPLIER = 1.95;
const PDF_PREVIEW_ZOOM_SCALE = 1.4;

const safeUnlink = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (error) {
    // best-effort cleanup
  }
};

const extractOwnerUidFromPath = (objectPath) => {
  if (!objectPath || typeof objectPath !== "string") return "";
  const [ownerUid] = objectPath.split("/");
  return ownerUid || "";
};

const isPdfObject = ({ contentType, objectPath }) => {
  const normalizedContentType =
    typeof contentType === "string" ? contentType.toLowerCase() : "";
  if (normalizedContentType.startsWith("application/pdf")) return true;
  return (
    typeof objectPath === "string" && objectPath.toLowerCase().endsWith(".pdf")
  );
};

const buildStorageDownloadUrl = (bucketName, objectPath, token) => {
  const encodedPath = encodeURIComponent(objectPath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;
};

const resolvePreviewToken = async (previewFile) => {
  const [exists] = await previewFile.exists();
  if (!exists) {
    return crypto.randomUUID();
  }

  const [metadata] = await previewFile.getMetadata();
  const token = metadata?.metadata?.firebaseStorageDownloadTokens;
  if (typeof token === "string" && token.length > 0) {
    return token.split(",")[0];
  }

  return crypto.randomUUID();
};

// Main reason for this loader: this file is CommonJS, while pdfjs is consumed
// from an ESM (.mjs) entry, needs dynamic import() instead of require().
const loadPdfjsLib = async () => {
  const module = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return module.default || module;
};

// pdfjs expects these APIs to exist.
// In browser they exist by default.
// In Node they usually don't, so we "polyfill" them before rendering PDF page
// to canvas.
// global: Node's app-wide object (like window in browser).
const installPdfNodePolyfills = () => {
  if (typeof global.DOMMatrix === "undefined" && DOMMatrix) {
    global.DOMMatrix = DOMMatrix;
  }
  if (typeof global.ImageData === "undefined" && ImageData) {
    global.ImageData = ImageData;
  }
  if (typeof global.Path2D === "undefined" && Path2D) {
    global.Path2D = Path2D;
  }
};

const renderPdfPreviewImage = async ({ inputPath, outputPath }) => {
  installPdfNodePolyfills();
  const pdfjsLib = await loadPdfjsLib();
  const pdfData = await fs.readFile(inputPath);

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfData),
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
  });

  let pdfDocument = null;
  let page = null;
  try {
    pdfDocument = await loadingTask.promise;
    page = await pdfDocument.getPage(1);

    const baseViewport = page.getViewport({ scale: 1 });
    // Match the previous client-side PDF thumbnail behavior:
    // 1) render the page using ~1.95x thumbnail height,
    // 2) apply a top-centered 1.4x zoom,
    // 3) crop into a square thumbnail.
    const targetPageRenderHeight =
      PDF_PREVIEW_MAX_EDGE * PDF_PREVIEW_PAGE_HEIGHT_MULTIPLIER;
    const renderScale = Math.max(
      0.01,
      targetPageRenderHeight / Math.max(1, baseViewport.height)
    );
    const viewport = page.getViewport({ scale: renderScale });

    const renderCanvas = createCanvas(
      Math.max(1, Math.round(viewport.width)),
      Math.max(1, Math.round(viewport.height))
    );
    const renderContext = renderCanvas.getContext("2d");

    await page.render({
      canvasContext: renderContext,
      viewport,
    }).promise;

    const outputCanvas = createCanvas(PDF_PREVIEW_MAX_EDGE, PDF_PREVIEW_MAX_EDGE);
    const outputContext = outputCanvas.getContext("2d");
    outputContext.fillStyle = "#ffffff";
    outputContext.fillRect(0, 0, PDF_PREVIEW_MAX_EDGE, PDF_PREVIEW_MAX_EDGE);

    const zoomedWidth = renderCanvas.width * PDF_PREVIEW_ZOOM_SCALE;
    const zoomedHeight = renderCanvas.height * PDF_PREVIEW_ZOOM_SCALE;
    const drawX = (PDF_PREVIEW_MAX_EDGE - zoomedWidth) / 2;
    const drawY = 0;
    outputContext.drawImage(renderCanvas, drawX, drawY, zoomedWidth, zoomedHeight);

    const jpegBuffer = outputCanvas.toBuffer("image/jpeg");
    await fs.writeFile(outputPath, jpegBuffer);
  } finally {
    if (page && typeof page.cleanup === "function") {
      page.cleanup();
    }
    if (pdfDocument && typeof pdfDocument.cleanup === "function") {
      pdfDocument.cleanup();
    }
    if (pdfDocument && typeof pdfDocument.destroy === "function") {
      await pdfDocument.destroy();
    }
    if (loadingTask && typeof loadingTask.destroy === "function") {
      await loadingTask.destroy();
    }
  }
};

const buildPdfPreviewFinalizeHandler = ({ admin, db, logger }) => {
  return async (event) => {
    const object = event.data;
    const objectPath = object?.name;
    if (!objectPath) return;

    if (!isPdfObject({ contentType: object.contentType, objectPath })) return;

    const customMetadata = object.metadata || {};
    if (customMetadata.mediaRole !== CHAT_PDF_MEDIA_ROLE) return;

    const chatId = customMetadata.chatId;
    const msgId = customMetadata.msgId;
    if (!chatId || !msgId) {
      logger.warn("Skipping pdf preview generation due to missing metadata", {
        objectPath,
        bucket: object.bucket,
        chatId,
        msgId,
      });
      return;
    }

    const messageRef = db
      .collection("chats")
      .doc(chatId)
      .collection("chatMessages")
      .doc(msgId);
    const messageSnapshot = await messageRef.get();
    if (!messageSnapshot.exists) {
      logger.warn("Skipping pdf preview generation: message not found", {
        objectPath,
        chatId,
        msgId,
      });
      return;
    }

    const ownerUid = extractOwnerUidFromPath(objectPath);
    const previewPath = `${
      ownerUid || "chat-pdf"
    }/${msgId}/${PDF_PREVIEW_FILE_NAME}`;
    const existingPreviewUrl = messageSnapshot.get("fileMsg.pdfPreviewUrl");
    if (
      typeof existingPreviewUrl === "string" &&
      existingPreviewUrl.includes(encodeURIComponent(previewPath))
    ) {
      logger.info(
        "Skipping pdf preview generation: canonical preview already set",
        {
          objectPath,
          chatId,
          msgId,
          previewPath,
        }
      );
      return;
    }

    const bucket = admin.storage().bucket(object.bucket);
    const sourceFile = bucket.file(objectPath);
    const previewFile = bucket.file(previewPath);
    const tmpPrefix = `${msgId}-${Date.now()}`;
    const tmpInputPath = path.join(os.tmpdir(), `${tmpPrefix}-source.pdf`);
    const tmpPreviewPath = path.join(
      os.tmpdir(),
      `${tmpPrefix}-${PDF_PREVIEW_FILE_NAME}`
    );

    try {
      await sourceFile.download({ destination: tmpInputPath });
      await renderPdfPreviewImage({
        inputPath: tmpInputPath,
        outputPath: tmpPreviewPath,
      });

      const token = await resolvePreviewToken(previewFile);
      await bucket.upload(tmpPreviewPath, {
        destination: previewPath,
        resumable: false,
        metadata: {
          contentType: PDF_PREVIEW_CONTENT_TYPE,
          cacheControl: PDF_PREVIEW_CACHE_CONTROL,
          metadata: {
            chatId,
            msgId,
            mediaRole: CHAT_PDF_PREVIEW_MEDIA_ROLE,
            firebaseStorageDownloadTokens: token,
          },
        },
      });

      const previewUrl = buildStorageDownloadUrl(
        bucket.name,
        previewPath,
        token
      );
      await messageRef.set(
        {
          fileMsg: {
            pdfPreviewUrl: previewUrl,
          },
        },
        { merge: true }
      );

      logger.info("Generated canonical pdf preview", {
        objectPath,
        chatId,
        msgId,
        previewPath,
      });
    } catch (error) {
      logger.error("Failed to generate canonical pdf preview", {
        objectPath,
        chatId,
        msgId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      await Promise.all([safeUnlink(tmpInputPath), safeUnlink(tmpPreviewPath)]);
    }
  };
};

module.exports = {
  buildPdfPreviewFinalizeHandler,
};
