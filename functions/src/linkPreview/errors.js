const createError = (code, message) => {
  const err = new Error(message || code);
  err.code = code;
  return err;
};

const toErrorCode = (error, fallback = "preview_failed") => {
  if (typeof error?.code === "string" && error.code.trim()) return error.code;
  return fallback;
};

module.exports = {
  createError,
  toErrorCode,
};
