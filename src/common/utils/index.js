import formatRelative from "date-fns/formatRelative";
import { enUS } from "date-fns/esm/locale";
import { Timestamp } from "firebase/firestore";
import { format } from "date-fns";

const formatRelativeLocale = {
  lastWeek: "EEEE",
  yesterday: "'Yesterday'",
  today: "'Today'",
  tomorrow: "EEEE",
  nextWeek: "EEEE",
  other: "dd/MM/yy",
};

const locale = {
  ...enUS,
  formatRelative: (token) => formatRelativeLocale[token],
};

export function formatFilename(filename) {
  if (filename.length <= 15) {
    return filename;
  } else {
    const begName = filename.substring(0, 8);
    const endName = filename.substring(filename.length - 6);
    return begName + "..." + endName;
  }
}

export function formatDate(timestamp) {
  const ts = timestamp ? new Date(timestamp) : new Date();

  return formatRelative(ts, Timestamp.now().toDate(), {
    locale,
  });
}

export function formatTime(timestamp) {
  const ts = timestamp ? new Date(timestamp) : new Date();

  return format(ts, "hh:mm a");
}

export function formatDurationMinutes(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0 min";
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} min`;
}

export function getMediaPermissionMessage({ error, isAudioCall }) {
  const name = error?.name || "";
  if (name === "NotAllowedError") {
    return isAudioCall
      ? "Microphone access is needed for audio calls."
      : "Camera access is needed for video calls.";
  }
  if (name === "NotReadableError") {
    return isAudioCall
      ? "Microphone is in use by another app."
      : "Camera is in use by another app.";
  }
  if (name === "NotFoundError") {
    return isAudioCall ? "No microphone found." : "No camera/microphone found.";
  }
  return isAudioCall
    ? "Unable to access microphone."
    : "Unable to access camera/microphone.";
}

export function extractFirstUrl(text) {
  if (typeof text !== "string") return null;
  const match = text.match(/https?:\/\/[^\s<>"'`]+/i);
  if (!match) return null;

  let url = match[0].trim();
  while (/[),.!?;:\]}]$/.test(url)) {
    url = url.slice(0, -1);
  }
  return url || null;
}

export function isLink(text) {
  try {
    new URL(text);
    return true;
  } catch (e) {
    return false;
  }
}
