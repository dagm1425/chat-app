import React from "react";
import PropTypes from "prop-types";
import { Alert, Slide, Snackbar } from "@mui/material";

const AUTO_HIDE_MS = 3000;
const ALLOWED_SEVERITIES = new Set(["error", "warning", "info", "success"]);

let toastSetter = null;

export function notifyUser(message, severity = "error") {
  if (!toastSetter) {
    console.warn("[Toast] notifyUser called before ToastProvider mounted.");
    return;
  }

  const normalizedSeverity = ALLOWED_SEVERITIES.has(severity)
    ? severity
    : "error";
  const normalizedMessage =
    typeof message === "string" ? message : String(message ?? "");

  toastSetter({ message: normalizedMessage, severity: normalizedSeverity });
}

const ensureOpacityTransition = (node) => {
  const existing = node.style.transitionProperty;
  if (!existing || existing === "none") {
    node.style.transitionProperty = "transform, opacity";
    return;
  }
  if (!existing.includes("opacity")) {
    node.style.transitionProperty = `${existing}, opacity`;
  }
};

const transitionProps = {
  direction: "up",
  onEnter: (node) => {
    node.style.opacity = "0";
    ensureOpacityTransition(node);
  },
  onEntering: (node) => {
    node.style.opacity = "1";
    ensureOpacityTransition(node);
  },
  onExit: (node) => {
    node.style.opacity = "0";
    ensureOpacityTransition(node);
  },
};

function ToastProvider({ children }) {
  const [toast, setToast] = React.useState({
    open: false,
    message: "",
    severity: "error",
    key: 0,
  });

  // Stable during normal rerenders; new identity only when this provider
  // instance remounts.
  const showToast = React.useCallback(({ message, severity }) => {
    setToast((prev) => ({
      open: true,
      message,
      severity,
      key: prev.key + 1,
    }));
  }, []);

  React.useEffect(() => {
    // Bind this exact showToast instance to the module-level bridge.
    toastSetter = showToast;
    return () => {
      // Prevent stale global setter from pointing to an unmounted provider.
      if (toastSetter === showToast) {
        toastSetter = null;
      }
    };
  }, [showToast]);

  const handleClose = (event, reason) => {
    if (reason === "clickaway") return;
    setToast((prev) => ({ ...prev, open: false }));
  };

  return (
    <>
      {children}
      <Snackbar
        key={toast.key}
        open={toast.open}
        autoHideDuration={AUTO_HIDE_MS}
        onClose={handleClose}
        TransitionComponent={Slide}
        TransitionProps={transitionProps}
      >
        <Alert severity={toast.severity} onClose={handleClose} variant="filled">
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  );
}

ToastProvider.propTypes = {
  children: PropTypes.node,
};

export default ToastProvider;
