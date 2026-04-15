/* eslint-env node */
// Generates a canonical low-res poster for chat videos.
// Primary UX goal: reduce first-load time spent showing only empty/skeleton
// video containers for all users (not just the uploader), because video decode
// + first-frame readiness usually takes longer than image paint.
// We intentionally did not add the same server-side preview pipeline for images
// since image first paint is typically fast enough.
const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const ffmpegPath = require("ffmpeg-static");

const CHAT_VIDEO_MEDIA_ROLE = "chat_video";
const CHAT_VIDEO_POSTER_MEDIA_ROLE = "chat_video_poster";
const POSTER_FILE_NAME = "poster-server.jpg";
const POSTER_CONTENT_TYPE = "image/jpeg";
const POSTER_CACHE_CONTROL = "public,max-age=604800,immutable";
const POSTER_MAX_EDGE = 320;

const isVideoContentType = (contentType) =>
  typeof contentType === "string" && contentType.startsWith("video/");

const safeUnlink = async (filePath) => {
  if (!filePath) return;
  try {
    // Delete local temp file (from os.tmpdir()) after processing.
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

const buildStorageDownloadUrl = (bucketName, objectPath, token) => {
  // Encode object path so "/" and special characters are safe in URL path segment.
  const encodedPath = encodeURIComponent(objectPath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;
};

// Purpose of this helper:
// - Client SDK uploads (uploadBytes/uploadBytesResumable) usually end up with
//   Firebase download-token metadata already set.
// - Admin/GCS uploads (bucket.upload/file.save) do not reliably provide that
//   Firebase-specific token by default.
// - Our poster is uploaded from a Cloud Function via Admin/GCS, so we ensure a
//   token exists (or reuse existing) before building a Firebase download URL.
// - URL token and metadata token must match, otherwise Firebase download URLs
//   fail with access errors (typically 403).
// - Recovery scenario: poster upload may succeed but Firestore update may fail.
//   On a later rerun, the poster file can already exist; reading/reusing its
//   existing token keeps the URL stable and avoids token churn.
const resolvePosterToken = async (posterFile) => {
  const [exists] = await posterFile.exists();
  if (!exists) {
    return crypto.randomUUID();
  }

  const [metadata] = await posterFile.getMetadata();
  const token = metadata?.metadata?.firebaseStorageDownloadTokens;
  if (typeof token === "string" && token.length > 0) {
    return token.split(",")[0];
  }

  return crypto.randomUUID();
};

const runFfmpegPosterCapture = async ({ inputPath, outputPath }) => {
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static binary path is unavailable");
  }

  // Pipeline (with flags):
  // 1) seek near start: "-ss 0.1"
  // 2) read input video: "-i inputPath"
  // 3) extract one frame: "-frames:v 1"
  // 4) scale to poster max edge: "-vf scale=...:force_original_aspect_ratio=decrease"
  // 5) encode JPEG quality: "-q:v 4"
  // 6) write local output file: "outputPath"
  // Note: ffmpeg is file-path based here:
  // - input path is passed via "-i", inputPath (see ffmpegArgs below)
  // - output path is the final ffmpegArgs item: outputPath
  // ffmpeg reads media bytes from inputPath and writes poster bytes to outputPath.
  // So this implementation does not stream media via stdin/stdout.
  const ffmpegArgs = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    "0.1",
    "-i",
    inputPath,
    "-frames:v",
    "1",
    "-vf",
    `scale=${POSTER_MAX_EDGE}:${POSTER_MAX_EDGE}:force_original_aspect_ratio=decrease`,
    "-q:v",
    "4",
    outputPath,
  ];

  await new Promise((resolve, reject) => {
    let stderr = "";
    // Process model:
    // - This Cloud Function's Node.js runtime is the parent process.
    // - ffmpeg is a separate executable binary, so it must run in its own
    //   OS process (child process), not as normal JavaScript code.
    // - spawn() launches that child process and gives us event hooks to track
    //   its lifecycle and capture diagnostics.
    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, {
      // stdio[0] = stdin  (input into process)
      // stdio[1] = stdout (normal output from process)
      // stdio[2] = stderr (error/log output from process)
      // We ignore stdin/stdout because ffmpegArgs already include file paths:
      // "-i inputPath" for input and trailing "outputPath" for output.
      // stderr is piped so we can capture real ffmpeg errors on failure.
      stdio: ["ignore", "ignore", "pipe"],
    });

    // stderr is a stream. "data" fires each time a new chunk arrives.
    // With ffmpegArgs using "-loglevel error", stderr chunks are mostly
    // failure diagnostics. We append them so non-zero exits can return a
    // readable reason.
    ffmpegProcess.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    // "error" here means the child process itself could not be started or
    // managed correctly (e.g. missing binary / spawn failure), not a normal
    // ffmpeg conversion failure.
    ffmpegProcess.on("error", (error) => {
      reject(error);
    });

    // "close" means ffmpeg finished. exitCode 0 = success.
    // Non-zero exit code = failure; include captured stderr details.
    ffmpegProcess.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve();
        return;
      }
      const reason = stderr.trim() || `ffmpeg exited with code ${exitCode}`;
      reject(new Error(reason));
    });
  });
};

const buildVideoPosterFinalizeHandler = ({ admin, db, logger }) => {
  return async (event) => {
    const object = event.data;
    const objectPath = object?.name;
    if (!objectPath) return;

    const contentType = object.contentType || "";
    if (!isVideoContentType(contentType)) return;

    const customMetadata = object.metadata || {};
    if (customMetadata.mediaRole !== CHAT_VIDEO_MEDIA_ROLE) return;

    const chatId = customMetadata.chatId;
    const msgId = customMetadata.msgId;

    if (!chatId || !msgId) {
      logger.warn("Skipping video poster generation due to missing metadata", {
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
      logger.warn("Skipping video poster generation: message not found", {
        objectPath,
        chatId,
        msgId,
      });
      return;
    }

    const ownerUid = extractOwnerUidFromPath(objectPath);
    const posterPath = `${
      ownerUid || "chat-video"
    }/${msgId}/${POSTER_FILE_NAME}`;

    const existingPosterUrl = messageSnapshot.get("fileMsg.videoPosterUrl");
    if (
      typeof existingPosterUrl === "string" &&
      existingPosterUrl.includes(encodeURIComponent(posterPath))
    ) {
      logger.info(
        "Skipping video poster generation: canonical poster already set",
        {
          objectPath,
          chatId,
          msgId,
          posterPath,
        }
      );
      return;
    }

    // Use the same Storage bucket that emitted this finalize event.
    const bucket = admin.storage().bucket(object.bucket);
    const sourceFile = bucket.file(objectPath);
    const posterFile = bucket.file(posterPath);

    const tmpPrefix = `${msgId}-${Date.now()}`;
    //inside os.tmpdir() of the Cloud Function runtime environment (the server/container)
    const tmpInputPath = path.join(os.tmpdir(), `${tmpPrefix}-source`);
    const tmpPosterPath = path.join(
      os.tmpdir(),
      `${tmpPrefix}-${POSTER_FILE_NAME}`
    );

    try {
      await sourceFile.download({ destination: tmpInputPath });
      await runFfmpegPosterCapture({
        inputPath: tmpInputPath,
        outputPath: tmpPosterPath,
      });

      const token = await resolvePosterToken(posterFile);

      await bucket.upload(tmpPosterPath, {
        destination: posterPath,
        resumable: false,
        metadata: {
          contentType: POSTER_CONTENT_TYPE,
          cacheControl: POSTER_CACHE_CONTROL,
          metadata: {
            chatId,
            msgId,
            mediaRole: CHAT_VIDEO_POSTER_MEDIA_ROLE,
            firebaseStorageDownloadTokens: token,
          },
        },
      });

      const posterUrl = buildStorageDownloadUrl(bucket.name, posterPath, token);
      await messageRef.set(
        {
          fileMsg: {
            videoPosterUrl: posterUrl,
          },
        },
        { merge: true }
      );

      logger.info("Generated canonical video poster", {
        objectPath,
        chatId,
        msgId,
        posterPath,
      });
    } catch (error) {
      logger.error("Failed to generate canonical video poster", {
        objectPath,
        chatId,
        msgId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      await Promise.all([safeUnlink(tmpInputPath), safeUnlink(tmpPosterPath)]);
    }
  };
};

module.exports = {
  buildVideoPosterFinalizeHandler,
};
