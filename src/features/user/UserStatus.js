import React from "react";
import PropTypes from "prop-types";
import { Typography } from "@mui/material";

function UserStatus({ status }) {
  return (
    <Typography
      variant="body2"
      sx={{ color: status === "online" ? "primary.main" : "text.secondary" }}
    >
      {status}
    </Typography>
  );
}

export default UserStatus;

UserStatus.propTypes = {
  status: PropTypes.string,
};
