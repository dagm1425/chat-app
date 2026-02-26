import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Box, Skeleton, useMediaQuery } from "@mui/material";
import BrokenImageOutlinedIcon from "@mui/icons-material/BrokenImageOutlined";
import { Document, Page } from "react-pdf";
import { setupPdfWorker } from "../../common/pdf/setupPdfWorker";

// Configure pdf.js worker once; all Document/Page instances use it.
setupPdfWorker();

const PdfFilePreview = ({ fileUrl, onDownload }) => {
  const isMobile = useMediaQuery("(max-width:600px)");
  const [hasPdfError, setHasPdfError] = useState(false);
  const [isPageRendered, setIsPageRendered] = useState(false);
  const thumbSize = isMobile ? 68 : 72;
  const pageRenderHeight = thumbSize;
  const showLoadingSkeleton = !hasPdfError && !isPageRendered;

  useEffect(() => {
    setHasPdfError(false);
    setIsPageRendered(false);
  }, [fileUrl]);

  const handlePdfLoadError = () => {
    setHasPdfError(true);
    setIsPageRendered(true);
  };

  const handlePageRenderSuccess = () => {
    setIsPageRendered(true);
  };

  const handlePreviewClick = () => {
    if (!fileUrl) return;
    onDownload(fileUrl);
  };

  return (
    <Box
      onClick={handlePreviewClick}
      role={fileUrl ? "button" : undefined}
      tabIndex={fileUrl ? 0 : -1}
      onKeyDown={(event) => {
        if (!fileUrl) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handlePreviewClick();
        }
      }}
      sx={{
        width: thumbSize,
        height: thumbSize,
        borderRadius: "0.35rem",
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
        cursor: fileUrl ? "pointer" : "default",
        bgcolor: (theme) =>
          showLoadingSkeleton
            ? theme.palette.mode === "light"
              ? "rgba(11, 20, 26, 0.04)"
              : "rgba(255, 255, 255, 0.06)"
            : "#fff",
        border: showLoadingSkeleton ? "none" : "1px solid rgba(0, 0, 0, 0.12)",
      }}
    >
      {showLoadingSkeleton && (
        <Skeleton
          variant="rectangular"
          animation="wave"
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            width: "100%",
            height: "100%",
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
          <BrokenImageOutlinedIcon sx={{ fontSize: 22, color: "grey.500" }} />
        </Box>
      ) : (
        <Box
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            overflow: "hidden",
            opacity: isPageRendered ? 1 : 0,
            transition: "opacity 140ms ease",
            bgcolor: (theme) =>
              theme.palette.mode === "dark" ? "#1e1f22" : "#fafafa",
            boxShadow: (theme) =>
              theme.palette.mode === "dark"
                ? "0 1px 3px rgba(0,0,0,0.6)"
                : "0 1px 2px rgba(0,0,0,0.15)",
            "& .react-pdf__Document": {
              lineHeight: 0,
            },
            "& .react-pdf__Page": {
              margin: 0,
            },
            "& .react-pdf__Page__canvas": {
              display: "block",
              imageRendering: "auto",
              transform: "scale(1.4)", // subtle zoom-in crop (Telegram style)
              transformOrigin: "top center",
            },
          }}
        >
          <Document
            file={fileUrl}
            loading={null}
            onLoadError={handlePdfLoadError}
            onSourceError={handlePdfLoadError}
            error={null}
            noData={null}
          >
            <Page
              pageNumber={1}
              height={pageRenderHeight * 1.95} // render larger internally (sharper)
              devicePixelRatio={3}
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
  );
};

PdfFilePreview.propTypes = {
  fileUrl: PropTypes.string.isRequired,
  onDownload: PropTypes.func.isRequired,
};

export default PdfFilePreview;
