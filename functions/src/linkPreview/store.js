const tsFromMillis = (admin, ms) => admin.firestore.Timestamp.fromMillis(ms);
const nowTs = (admin) => admin.firestore.Timestamp.now();
const serverTs = (admin) => admin.firestore.FieldValue.serverTimestamp();
const deleteField = (admin) => admin.firestore.FieldValue.delete();

const writeMessageReady = async ({
  admin,
  messageRef,
  normalizedUrl,
  preview,
}) => {
  await messageRef.set(
    {
      linkPreviewStatus: "ready",
      linkPreviewFetchedAt: serverTs(admin),
      linkPreviewUrl: normalizedUrl,
      linkPreview: preview,
      linkPreviewErrorCode: deleteField(admin),
    },
    { merge: true }
  );
};

const writeMessageFailed = async ({
  admin,
  messageRef,
  normalizedUrl,
  errorCode,
}) => {
  await messageRef.set(
    {
      linkPreviewStatus: "failed",
      linkPreviewFetchedAt: serverTs(admin),
      linkPreviewUrl: normalizedUrl || deleteField(admin),
      linkPreview: deleteField(admin),
      linkPreviewErrorCode: errorCode,
    },
    { merge: true }
  );
};

const writeSuccessCache = async ({
  admin,
  cacheRef,
  urlHash,
  normalizedUrl,
  preview,
  ttlMs,
}) => {
  await cacheRef.set(
    {
      urlHash,
      normalizedUrl,
      preview,
      fetchedAt: nowTs(admin),
      expiresAt: tsFromMillis(admin, Date.now() + ttlMs),
      lastStatus: "ready",
      errorCode: deleteField(admin),
    },
    { merge: true }
  );
};

module.exports = {
  writeMessageReady,
  writeMessageFailed,
  writeSuccessCache,
};
