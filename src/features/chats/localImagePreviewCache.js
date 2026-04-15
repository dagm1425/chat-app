const localImagePreviewByMsgId = new Map();
const LOCAL_IMAGE_PREVIEW_CACHE_LIMIT = 64;

const revokeObjectUrl = (objectUrl) => {
  if (!objectUrl || typeof URL === "undefined") return;
  URL.revokeObjectURL(objectUrl);
};

export const setLocalImagePreview = (msgId, blob) => {
  if (!msgId || !blob || !blob.size || typeof URL === "undefined") return "";

  const previousObjectUrl = localImagePreviewByMsgId.get(msgId);
  if (previousObjectUrl) {
    localImagePreviewByMsgId.delete(msgId);
    revokeObjectUrl(previousObjectUrl);
  }

  const objectUrl = URL.createObjectURL(blob);
  localImagePreviewByMsgId.set(msgId, objectUrl);

  while (localImagePreviewByMsgId.size > LOCAL_IMAGE_PREVIEW_CACHE_LIMIT) {
    const oldestEntry = localImagePreviewByMsgId.entries().next().value;
    if (!oldestEntry) break;
    const [oldestMsgId, oldestObjectUrl] = oldestEntry;
    localImagePreviewByMsgId.delete(oldestMsgId);
    revokeObjectUrl(oldestObjectUrl);
  }

  return objectUrl;
};

export const getLocalImagePreview = (msgId) => {
  if (!msgId) return "";

  return localImagePreviewByMsgId.get(msgId) || "";
};

export const clearLocalImagePreview = (msgId) => {
  if (!msgId) return;
  const objectUrl = localImagePreviewByMsgId.get(msgId);
  if (!objectUrl) return;
  localImagePreviewByMsgId.delete(msgId);
  revokeObjectUrl(objectUrl);
};
