import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Box, IconButton, Typography } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import BrokenImageOutlinedIcon from "@mui/icons-material/BrokenImageOutlined";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import { Document, Page } from "react-pdf";
import { setupPdfWorker } from "../../common/pdf/setupPdfWorker";
import { formatFilename } from "../../common/utils";

// Call setupPdfWorker() once at module load.
// Document renders use the configured worker automatically.
setupPdfWorker();

const getPageLabel = (numPages) => {
  if (!Number.isFinite(numPages)) return "— pages";
  if (numPages === 1) return "1 page";
  return `${numPages} pages`;
};

const PdfFilePreview = ({
  fileUrl,
  fileName,
  fileSize,
  isSentFromUser,
  onDownload,
}) => {
  const [numPages, setNumPages] = useState(null);
  const [hasPdfError, setHasPdfError] = useState(false);
  const [isPageRendered, setIsPageRendered] = useState(false);
  const renderScale = 1;

  useEffect(() => {
    setNumPages(null);
    setHasPdfError(false);
    setIsPageRendered(false);
  }, [fileUrl]);

  const metadataLabel = `${getPageLabel(numPages)} · PDF · ${fileSize || "—"}`;

  const handlePdfLoadSuccess = ({ numPages: loadedNumPages }) => {
    if (!Number.isFinite(loadedNumPages)) return;

    setNumPages(loadedNumPages);
    setHasPdfError(false);
  };

  const handlePdfLoadError = () => {
    setNumPages(null);
    setHasPdfError(true);
    setIsPageRendered(true);
  };

  const handlePageRenderSuccess = () => {
    setIsPageRendered(true);
  };

  const handleOpenPreview = () => {
    if (!fileUrl || !isPageRendered || hasPdfError) return;
    window.open(fileUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Box
      sx={{
        width: { xs: "14.5rem", sm: "16.5rem" },
        maxWidth: "100%",
        ml: "0.25rem",
        mt: "0.125rem",
        borderRadius: "0.75rem",
        overflow: "hidden",
        backgroundColor: (theme) =>
          theme.palette.mode === "light"
            ? "rgba(11, 20, 26, 0.04)"
            : "rgba(255, 255, 255, 0.08)",
      }}
    >
      <Box
        sx={{
          height: { xs: 92, sm: 108 },
          bgcolor: (theme) =>
            theme.palette.mode === "light"
              ? "rgba(0, 0, 0, 0.05)"
              : "rgba(255, 255, 255, 0.1)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {!hasPdfError && !isPageRendered && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: 1,
              bgcolor: (theme) =>
                theme.palette.mode === "light"
                  ? "rgba(255, 255, 255, 0.24)"
                  : "rgba(255, 255, 255, 0.08)",
              overflow: "hidden",
              "&::after": {
                content: '""',
                position: "absolute",
                inset: 0,
                transform: "translateX(-100%)",
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.35) 50%, transparent 100%)",
                animation: "pdfPreviewShimmer 1.4s ease-in-out infinite",
              },
              "@keyframes pdfPreviewShimmer": {
                "100%": {
                  transform: "translateX(100%)",
                },
              },
            }}
          />
        )}

        {hasPdfError ? (
          <Box
            sx={{
              height: "100%",
              display: "grid",
              placeItems: "center",
            }}
          >
            <BrokenImageOutlinedIcon sx={{ fontSize: 42, color: "grey.500" }} />
          </Box>
        ) : (
          <Box
            role={isPageRendered ? "button" : undefined}
            tabIndex={isPageRendered ? 0 : -1}
            onClick={handleOpenPreview}
            onKeyDown={(event) => {
              if (!isPageRendered) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleOpenPreview();
              }
            }}
            sx={{
              width: "100%",
              height: "100%",
              opacity: isPageRendered ? 1 : 0,
              transition: "opacity 140ms ease",
              cursor: isPageRendered ? "pointer" : "default",
              "& .react-pdf__Document": {
                width: "100%",
                height: "100%",
              },
              "& .react-pdf__Page": {
                width: "100%",
                margin: "0 auto",
              },
              "& .react-pdf__Page__canvas": {
                display: "block",
                width: "100% !important",
                height: "auto !important",
              },
            }}
          >
            <Document
              file={fileUrl}
              loading={null}
              onLoadSuccess={handlePdfLoadSuccess}
              onLoadError={handlePdfLoadError}
              onSourceError={handlePdfLoadError}
              error={null}
              noData={null}
            >
              <Page
                pageNumber={1}
                scale={renderScale}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                loading={null}
                onRenderSuccess={handlePageRenderSuccess}
                onRenderError={handlePdfLoadError}
              />
            </Document>
          </Box>
        )}
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          px: "0.5rem",
          py: "0.425rem",
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 34,
            position: "relative",
            flexShrink: 0,
          }}
        >
          <InsertDriveFileIcon
            sx={{
              fontSize: 34,
              color: "#E11D48",
              display: "block",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              left: "55%",
              bottom: 6,
              transform: "translateX(-50%)",
              color: "#fff",
              fontSize: "0.6rem",
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: "0.01em",
              pointerEvents: "none",
            }}
          >
            PDF
          </Box>
        </Box>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {formatFilename(fileName)}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", display: "block", mt: "0.1rem" }}
          >
            {metadataLabel}
          </Typography>
        </Box>

        <IconButton
          size="small"
          sx={{
            color: "text.primary",
            flexShrink: 0,
            "&.MuiButtonBase-root:hover": {
              bgcolor: isSentFromUser
                ? "rgba(255, 255, 255, 0.28)"
                : "rgba(0, 0, 0, 0.08)",
            },
          }}
          onClick={() => onDownload(fileUrl, fileName)}
        >
          <DownloadIcon sx={{ fontSize: "1.25rem" }} />
        </IconButton>
      </Box>
    </Box>
  );
};

PdfFilePreview.propTypes = {
  fileUrl: PropTypes.string.isRequired,
  fileName: PropTypes.string,
  fileSize: PropTypes.string,
  isSentFromUser: PropTypes.bool.isRequired,
  onDownload: PropTypes.func.isRequired,
};

PdfFilePreview.defaultProps = {
  fileName: "",
  fileSize: "",
};

export default PdfFilePreview;
