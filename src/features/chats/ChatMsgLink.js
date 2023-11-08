import React from "react";
import PropTypes from "prop-types";
import Microlink from "@microlink/react";
import { useMediaQuery } from "@mui/material";

const ChatMsgLink = ({ url, containerWidth }) => {
  const isMobile = useMediaQuery("(max-width: 600px)");
  const maxWidth = isMobile ? 0.75 : 0.45;
  const padding = isMobile ? 64 : 128;
  const maxContainerWidth = containerWidth * maxWidth - padding;

  return (
    <Microlink
      url={url}
      target="_blank"
      media={["image", "logo"]}
      style={{ width: `${maxContainerWidth}px` }}
    />
  );
};

export default ChatMsgLink;

ChatMsgLink.propTypes = {
  url: PropTypes.string,
  containerWidth: PropTypes.number,
};
