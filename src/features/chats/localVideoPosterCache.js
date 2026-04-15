const localVideoPosterByMsgId = new Map();
const LOCAL_VIDEO_POSTER_CACHE_LIMIT = 48;

const revokeObjectUrl = (objectUrl) => {
  if (!objectUrl || typeof URL === "undefined") return;
  URL.revokeObjectURL(objectUrl);
};

export const setLocalVideoPoster = (msgId, blob) => {
  if (!msgId || !blob || !blob.size || typeof URL === "undefined") return "";

  const previousEntry = localVideoPosterByMsgId.get(msgId);
  if (previousEntry) {
    localVideoPosterByMsgId.delete(msgId);
    revokeObjectUrl(previousEntry.objectUrl);
  }

  const entry = {
    objectUrl: URL.createObjectURL(blob),
    bytes: blob.size,
  };
  localVideoPosterByMsgId.set(msgId, entry);

  while (localVideoPosterByMsgId.size > LOCAL_VIDEO_POSTER_CACHE_LIMIT) {
    const oldestEntry = localVideoPosterByMsgId.entries().next().value;
    if (!oldestEntry) break;
    const [oldestMsgId, oldestValue] = oldestEntry;
    localVideoPosterByMsgId.delete(oldestMsgId);
    revokeObjectUrl(oldestValue.objectUrl);
  }

  return entry.objectUrl;
};

export const getLocalVideoPoster = (msgId) => {
  if (!msgId) return "";

  const entry = localVideoPosterByMsgId.get(msgId);
  if (!entry) return "";

  // LRU reordering
  localVideoPosterByMsgId.delete(msgId);
  localVideoPosterByMsgId.set(msgId, entry);

  return entry.objectUrl;
};

export const clearLocalVideoPoster = (msgId) => {
  if (!msgId) return;
  const entry = localVideoPosterByMsgId.get(msgId);
  if (!entry) return;
  localVideoPosterByMsgId.delete(msgId);
  revokeObjectUrl(entry.objectUrl);
};
