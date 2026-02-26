import React from "react";
import PropTypes from "prop-types";
import { Box, Skeleton, Typography } from "@mui/material";
import BrokenImageOutlinedIcon from "@mui/icons-material/BrokenImageOutlined";
import { extractFirstUrl } from "../../common/utils";

const previewMediaWidthSx = { xs: 78, sm: 90 };
const previewMediaHeightSx = { xs: 76, sm: 88 };
const previewCardWidthSx = { xs: "17.75rem", sm: "21.5rem" };
const urlLinkSx = {
  color: "#1f7ef0",
  textDecoration: "underline",
  textUnderlineOffset: "2px",
};

const previewCardSx = {
  borderRadius: "0.5rem",
  overflow: "hidden",
  // Tint only the card background (not text/image) for clearer bubble contrast.
  backgroundColor: (theme) =>
    theme.palette.mode === "light"
      ? "rgba(11, 20, 26, 0.04)"
      : "rgba(255, 255, 255, 0.06)",
  ml: "0.25rem",
  display: "flex",
  alignItems: "stretch",
  width: previewCardWidthSx,
  maxWidth: "100%",
};

const TextMsg = ({ message }) => {
  const messageText = typeof message.msg === "string" ? message.msg : "";
  const firstUrl = extractFirstUrl(messageText);
  const urlIndex = firstUrl ? messageText.indexOf(firstUrl) : -1;
  const textBeforeLink =
    firstUrl && urlIndex >= 0 ? messageText.slice(0, urlIndex) : messageText;
  const textAfterLink =
    firstUrl && urlIndex >= 0
      ? messageText.slice(urlIndex + firstUrl.length)
      : "";
  const preview =
    message.linkPreviewStatus === "ready" && message.linkPreview
      ? message.linkPreview
      : null;
  const showPreviewSkeleton =
    Boolean(firstUrl) && !preview && message.linkPreviewStatus !== "failed";
  const hasPreviewCard = Boolean(preview) || showPreviewSkeleton;
  const shouldPlaceLinkBelowPreview = Boolean(firstUrl) && hasPreviewCard;
  const topText =
    firstUrl && urlIndex >= 0
      ? `${textBeforeLink}${textAfterLink}`
      : messageText;
  const showTopText = shouldPlaceLinkBelowPreview
    ? Boolean(topText.trim())
    : true;
  const shouldRenderInlineUrl =
    Boolean(firstUrl) && !shouldPlaceLinkBelowPreview && urlIndex >= 0;
  const previewTopMargin = showTopText ? "0.5rem" : "0.25rem";

  return (
    <Box>
      {showTopText && (
        <Typography
          variant="body2"
          component="div"
          sx={{
            ml: "0.25rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {shouldRenderInlineUrl ? (
            <>
              {textBeforeLink}
              <Box
                component="a"
                href={firstUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ ...urlLinkSx, display: "inline" }}
              >
                {firstUrl}
              </Box>
              {textAfterLink}
            </>
          ) : (
            topText
          )}
        </Typography>
      )}
      {preview && (
        <a
          href={preview.url || preview.linkPreviewUrl || firstUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            textDecoration: "none",
            color: "inherit",
            display: "block",
            width: "fit-content",
            maxWidth: "100%",
            marginTop: previewTopMargin,
          }}
        >
          <Box sx={previewCardSx}>
            <Box
              sx={{
                width: previewMediaWidthSx,
                minWidth: previewMediaWidthSx,
                minHeight: previewMediaHeightSx,
                flexShrink: 0,
                alignSelf: "stretch",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: (theme) =>
                  preview.imageUrl
                    ? "transparent"
                    : theme.palette.mode === "light"
                    ? "rgba(0,0,0,0.06)"
                    : "rgba(255,255,255,0.12)",
                color: (theme) =>
                  preview.imageUrl
                    ? "inherit"
                    : theme.palette.mode === "light"
                    ? "grey.500"
                    : "grey.400",
              }}
            >
              {preview.imageUrl ? (
                <Box
                  component="img"
                  src={preview.imageUrl}
                  alt={preview.title || "Link preview"}
                  sx={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <BrokenImageOutlinedIcon sx={{ fontSize: 34 }} />
              )}
            </Box>
            <Box sx={{ p: "0.625rem 0.75rem", minWidth: 0, flex: 1 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  lineHeight: 1.22,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {preview.title || "Link"}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: preview.description
                    ? "rgba(0, 0, 0, 0.87)"
                    : "text.secondary",
                  mt: "0.2rem",
                  lineHeight: 1.3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {preview.description || "Preview details unavailable"}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  display: "block",
                  mt: "0.3rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {preview.siteName || preview.domain || firstUrl}
              </Typography>
            </Box>
          </Box>
        </a>
      )}
      {showPreviewSkeleton && (
        <Box
          sx={{
            ...previewCardSx,
            mt: previewTopMargin,
          }}
        >
          <Skeleton
            variant="rectangular"
            sx={{
              width: previewMediaWidthSx,
              height: previewMediaHeightSx,
              minWidth: previewMediaWidthSx,
              flexShrink: 0,
            }}
          />
          <Box sx={{ p: "0.625rem 0.75rem", minWidth: 0, flex: 1 }}>
            <Skeleton variant="text" height={24} width="84%" />
            <Skeleton variant="text" height={18} width="96%" />
            <Skeleton variant="text" height={18} width="72%" />
            <Skeleton
              variant="text"
              height={14}
              width="46%"
              sx={{ mt: "0.3rem" }}
            />
          </Box>
        </Box>
      )}
      {firstUrl && shouldPlaceLinkBelowPreview && (
        <Typography
          variant="body2"
          component="div"
          sx={{
            mt: "0.42rem",
            ml: "0.25rem",
            maxWidth: previewCardWidthSx,
            wordBreak: "break-word",
          }}
        >
          <Box
            component="a"
            href={firstUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ ...urlLinkSx, display: "inline" }}
          >
            {firstUrl}
          </Box>
        </Typography>
      )}
    </Box>
  );
};

TextMsg.propTypes = {
  message: PropTypes.object.isRequired,
};

export default TextMsg;
