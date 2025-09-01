import React from "react";
import PropTypes from "prop-types";
import { Typography } from "@mui/material";
import { isLink } from "../../common/utils";

const TextMsg = ({ message }) => {
  return (
    <>
      {isLink(message.msg) ? (
        <a
          href={message.msg}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "underline", color: "blue" }}
        >
          {message.msg}
        </a>
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
};

export default TextMsg;
