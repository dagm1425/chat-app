import React from "react";
import PropTypes from "prop-types";
import { Box, Button } from "@mui/material";

function SignOutDialogContent({ signOutUser, onClose }) {
  return (
    <Box
      sx={{
        display: "flex",
        width: 280,
        justifyContent: "flex-end",
        mt: "1.5rem",
        pb: "1rem",
        pr: "1rem",
        gap: "0.5rem",
      }}
    >
      <Button color="error" onClick={signOutUser}>
        Sign out
      </Button>

      <Button onClick={onClose}>Cancel</Button>
    </Box>
  );
}

export default SignOutDialogContent;

SignOutDialogContent.propTypes = {
  signOutUser: PropTypes.func,
  onClose: PropTypes.func,
};
