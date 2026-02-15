import React from "react";
import PropTypes from "prop-types";
import { Typography } from "@mui/material";

function UserStatus({ status }) {
  const isStatusReady = typeof status === "string" && status.trim().length > 0;
  const text = isStatusReady ? status : "online";

  return (
    <Typography
      variant="body2"
      sx={{
        color: status === "online" ? "primary.main" : "text.secondary",
        visibility: isStatusReady ? "visible" : "hidden",
      }}
    >
      {text}
    </Typography>
  );
}

export default UserStatus;

UserStatus.propTypes = {
  status: PropTypes.string,
};
