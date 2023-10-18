import React from "react";
import PropTypes from "prop-types";
import { provider, auth, db } from "../../firebase";
import { signInWithPopup } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Box, Button, Typography } from "@mui/material";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
import GoogleIcon from "@mui/icons-material/Google";

function UserLogin({ setUserStatus }) {
  const imgURL =
    "https://blog.1a23.com/wp-content/uploads/sites/2/2020/02/pattern-9.svg";

  async function signIn() {
    await signInWithPopup(auth, provider);
    addUser(auth.currentUser);
    localStorage.setItem("auth", "true");
    setUserStatus(auth.currentUser.uid, true);
  }

  const addUser = async (user) => {
    await setDoc(doc(db, "users", `${user.uid}`), {
      uid: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL,
    });
  };

  return (
    <Box
      sx={{
        display: "grid",
        placeItems: "center",
        height: "100vh",
        background: `linear-gradient(0deg, rgba(255, 255, 255, 0.93), rgba(255, 255, 255, 0.93)), fixed url(${imgURL})`,
        backgroundPosition: "center",
        backgroundSize: "contain",
        boxShadow: "inset 0 0 0 2000px rgba(211, 211, 211, 0.15)",
      }}
    >
      <Box
        sx={{
          textAlign: "center",
          maxWidth: "340px",
          width: "100%",
          bgcolor: "background.default",
          boxShadow:
            "rgba(60, 64, 67, 0.3) 0px 1px 2px 0px, rgba(60, 64, 67, 0.15) 0px 2px 6px 2px",
        }}
      >
        <Box>
          <QuestionAnswerIcon
            sx={{ color: "primary.main", fontSize: "4rem", mt: "4rem" }}
          />
          <Typography
            variant="subtitle1"
            sx={{ fontSize: "1.25em", mt: "0.25rem" }}
          >
            ChatApp
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", mb: "2rem" }}
          >
            Login to start messaging.
          </Typography>
          <Button
            variant="contained"
            sx={{ bgcolor: "background.light", mb: "5rem" }}
            startIcon={<GoogleIcon />}
            onClick={signIn}
          >
            Continue with Google
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

export default UserLogin;

UserLogin.propTypes = {
  setUserStatus: PropTypes.func,
};
