/* eslint-env node */
const admin = require("firebase-admin");
const { setGlobalOptions } = require("firebase-functions");
const {
  onDocumentCreated,
  onDocumentUpdated,
} = require("firebase-functions/v2/firestore");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const logger = require("firebase-functions/logger");
const { REGION } = require("./src/linkPreview/constants");
const {
  buildLinkPreviewHandler,
  buildLinkPreviewUpdateHandler,
} = require("./src/linkPreview/handler");
const {
  buildVideoPosterFinalizeHandler,
} = require("./src/videoPoster/handler");
const { buildPdfPreviewFinalizeHandler } = require("./src/pdfPreview/handler");

admin.initializeApp();
setGlobalOptions({ maxInstances: 10 });

const db = admin.firestore();

exports.buildLinkPreview = onDocumentCreated(
  {
    region: REGION,
    document: "chats/{chatId}/chatMessages/{msgId}",
    timeoutSeconds: 20,
    memory: "256MiB",
  },
  buildLinkPreviewHandler({ admin, db, logger })
);

exports.refreshLinkPreviewOnMessageUpdate = onDocumentUpdated(
  {
    region: REGION,
    document: "chats/{chatId}/chatMessages/{msgId}",
    timeoutSeconds: 20,
    memory: "256MiB",
  },
  buildLinkPreviewUpdateHandler({ admin, db, logger })
);

exports.generateCanonicalVideoPoster = onObjectFinalized(
  {
    region: REGION,
    timeoutSeconds: 120,
    memory: "1GiB",
  },
  buildVideoPosterFinalizeHandler({ admin, db, logger })
);

exports.generateCanonicalPdfPreview = onObjectFinalized(
  {
    region: REGION,
    timeoutSeconds: 120,
    memory: "1GiB",
  },
  buildPdfPreviewFinalizeHandler({ admin, db, logger })
);
