import React from "react";
import PropTypes from "prop-types";
import { Box, Button, Typography } from "@mui/material";

function SignOutDialogContent({ signOutUser, onClose }) {
  return (
    <Box
      sx={{
        width: 340,
        pb: "1rem",
        px: "1.5rem",
      }}
    >
      <Typography
        variant="body1"
        sx={{ fontSize: "1rem", color: "text.secondary", mb: "1.25rem" }}
      >
        Are you sure you want to sign out?
      </Typography>
      <Box
        sx={{
          width: "100%",
          display: "flex",
          justifyContent: "flex-end",
          gap: "0.5rem",
        }}
      >
        <Button color="error" onClick={signOutUser}>
          Sign out
        </Button>

        <Button onClick={onClose}>Cancel</Button>
      </Box>
    </Box>
  );
}

export default SignOutDialogContent;

SignOutDialogContent.propTypes = {
  signOutUser: PropTypes.func,
  onClose: PropTypes.func,
};
