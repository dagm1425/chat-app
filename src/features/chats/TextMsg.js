import React from "react";
import PropTypes from "prop-types";
import { Typography } from "@mui/material";
import ChatMsgLink from "./ChatMsgLink"; // Import ChatMsgLink
import { isLink } from "../../common/utils"; // Assuming isLink is in utils

const TextMsg = ({ message, isMobile, scroll }) => {
  return (
    <>
      {isLink(message.msg) ? (
        <ChatMsgLink
          url={message.msg}
          containerWidth={
            isMobile ? window.innerWidth : scroll.current.offsetWidth
          }
        />
      ) : (
        <Typography variant="body2" sx={{ ml: "0.25rem" }}>
          {message.msg}
        </Typography>
      )}
    </>
  );
};

TextMsg.propTypes = {
  message: PropTypes.object.isRequired,
  isMobile: PropTypes.bool.isRequired,
  scroll: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  ]),
};

export default TextMsg;
