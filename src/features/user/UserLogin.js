import React, { useState } from "react";
import PropTypes from "prop-types";
import { provider, auth, db } from "../../firebase";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import {
  doc,
  getCountFromServer,
  setDoc,
  collection,
} from "firebase/firestore";
import { Box, Button, Typography, TextField } from "@mui/material";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
import GoogleIcon from "@mui/icons-material/Google";
import PersonIcon from "@mui/icons-material/Person";

function UserLogin({ setUserStatus }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const imgURL =
    "https://blog.1a23.com/wp-content/uploads/sites/2/2020/02/pattern-9.svg";

  const isUsersLimitReached = async () => {
    const coll = collection(db, "users");
    const snapshot = await getCountFromServer(coll);
    const usersCount = snapshot.data().count;
    const usersLimit = 15;
    return usersCount > usersLimit;
  };

  const addUser = async (user) => {
    await setDoc(doc(db, "users", `${user.uid}`), {
      uid: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL,
    });
  };

  const signInUser = async () => {
    const limitReached = await isUsersLimitReached();

    try {
      if (limitReached) {
        alert("Users limit reached. Please login using the demo account.");
        return;
      }
      await signInWithPopup(auth, provider);
      addUser(auth.currentUser);
      localStorage.setItem("auth", "true");
      setUserStatus(auth.currentUser.uid, true);
    } catch (error) {
      console.error("Authentication error:", error.message);
    }
  };

  const signInDemoUser = async () => {
    try {
      await signInWithEmailAndPassword(
        auth,
        "demo@example.com",
        "demopassword"
      );
      const currentUser = auth.currentUser;
      await updateProfile(currentUser, {
        displayName: "Alex",
        photoURL:
          "https://img.freepik.com/free-psd/3d-illustration-human-avatar-profile_23-2150671142.jpg?w=740&t=st=1700482327~exp=1700482927~hmac=19e87f8c18b4c31fad62ac9916aecb95097397a79851f191721944f5cd6e419e",
      });
      addUser(currentUser);
      localStorage.setItem("auth", "true");
      setUserStatus(currentUser.uid, true);
    } catch (error) {
      console.error("Demo user authentication error:", error.message);
    }
  };

  const signInWithEmailPwd = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      const currentUser = auth.currentUser;
      if (!currentUser.displayName) {
        const generatedName = email.split("@")[0];
        await updateProfile(currentUser, {
          displayName: generatedName,
          photoURL:
            "https://static.vecteezy.com/system/resources/previews/009/398/577/non_2x/man-avatar-clipart-illustration-free-png.png",
        });
      }
      addUser(currentUser);
      localStorage.setItem("auth", "true");
      setUserStatus(currentUser.uid, true);
    } catch (error) {
      console.error("Email/Password authentication error:", error.message);
    }
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
          maxWidth: "390px",
          width: "100%",
          bgcolor: "background.default",
          border: "none",
          borderRadius: "10px",
          boxShadow:
            "rgba(60, 64, 67, 0.3) 0px 1px 2px 0px, rgba(60, 64, 67, 0.15) 0px 2px 6px 2px",
        }}
      >
        <Box>
          <QuestionAnswerIcon
            sx={{ color: "primary.main", fontSize: "4rem", mt: "2rem" }}
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

          <Box
            sx={{
              color: "text.secondary",
              display: "flex",
              width: "75%",
              flexDirection: "column",
              mx: "auto",
              gap: "1rem",
              mb: "2.5rem",
            }}
          >
            <TextField
              placeholder="Email"
              variant="outlined"
              size="small"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{
                "& .MuiOutlinedInput-root:hover fieldset": {
                  borderColor: "rgba(0, 0, 0, 0.23)",
                },
                "& .Mui-focused:hover fieldset": {
                  borderColor: (theme) => theme.palette.primary.main,
                },
              }}
            />
            <TextField
              placeholder="Password"
              variant="outlined"
              size="small"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{
                "& .MuiOutlinedInput-root:hover fieldset": {
                  borderColor: "rgba(0, 0, 0, 0.23)",
                },
                "& .Mui-focused:hover fieldset": {
                  borderColor: (theme) => theme.palette.primary.main,
                },
              }}
            />
            <Button variant="contained" onClick={signInWithEmailPwd}>
              Sign in
            </Button>
            <Typography
              variant="body1"
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                gap: "1rem",

                "&::before, &::after": {
                  content: '""',
                  borderColor: "#f5f5f0",
                  borderTop: "1px solid",
                  alignSelf: "center",
                },
              }}
            >
              or
            </Typography>
            <Button
              variant="outlined"
              sx={{ bgcolor: "background.light" }}
              startIcon={<GoogleIcon />}
              onClick={signInUser}
            >
              Continue with Google
            </Button>
            <Button
              variant="outlined"
              sx={{ bgcolor: "background.light" }}
              startIcon={<PersonIcon />}
              onClick={signInDemoUser}
            >
              Use a demo account
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default UserLogin;

UserLogin.propTypes = {
  setUserStatus: PropTypes.func,
};
