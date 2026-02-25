/* eslint-env node */
const admin = require("firebase-admin");
const { setGlobalOptions } = require("firebase-functions");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const { REGION } = require("./src/linkPreview/constants");
const { buildLinkPreviewHandler } = require("./src/linkPreview/handler");

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
