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
  const ts = timestamp == null ? new Date() : timestamp.toDate();

  return formatRelative(ts, Timestamp.now().toDate(), {
    locale,
  });
}

export function formatTime(timestamp) {
  const ts = timestamp == null ? new Date() : timestamp.toDate();

  return format(ts, "hh:mm a");
}

export function isLink(str) {
  const pattern = new RegExp(
    "^(https?:\\/\\/)?" +
      "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" +
      "((\\d{1,3}\\.){3}\\d{1,3}))" +
      "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" +
      "(\\?[;&a-z\\d%_.~+=-]*)?" +
      "(\\#[-a-z\\d_]*)?$",
    "i"
  );

  return pattern.test(str);
}
