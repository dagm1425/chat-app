import React, { useState } from "react";
import PropTypes from "prop-types";
import { provider, auth, db } from "../../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  Box,
  Button,
  Typography,
  TextField,
  IconButton,
  InputAdornment,
} from "@mui/material";
import QuestionAnswerOutlinedIcon from "@mui/icons-material/QuestionAnswerOutlined";
import GoogleIcon from "@mui/icons-material/Google";
import PersonIcon from "@mui/icons-material/Person";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { useNavigate } from "react-router-dom";
import { keyframes } from "@mui/system";

const authViewEnter = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const AUTH_PAGE_BG = "#FAFAFA";
const AUTH_SURFACE_BG = "#fff";
const AUTH_BORDER_NEUTRAL = "rgba(0, 0, 0, 0.23)";
const AUTH_CONTROL_WIDTH = "320px";
const AUTH_CONTROL_HEIGHT = "48px";
const AUTH_CONTROL_RADIUS = "10px";

const outlinedActionButtonSx = {
  bgcolor: AUTH_SURFACE_BG,
  borderColor: "primary.main",
  color: "primary.main",
  height: AUTH_CONTROL_HEIGHT,
  borderRadius: AUTH_CONTROL_RADIUS,
  fontSize: "1.06rem",
  fontWeight: 500,
  textTransform: "none",
  "& .MuiSvgIcon-root": {
    color: "inherit",
  },
  transition: "none",
  "&&.Mui-disabled": {
    backgroundColor: "transparent",
    borderColor: (theme) => theme.palette.primary.main,
    color: (theme) => theme.palette.primary.main,
    opacity: 1,
    WebkitTextFillColor: (theme) => theme.palette.primary.main,
  },
};

function UserLogin({ mode = "signin", setUserStatus }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const defaultAvatarUrl =
    "https://static.vecteezy.com/system/resources/previews/009/398/577/non_2x/man-avatar-clipart-illustration-free-png.png";
  const isSignUpMode = mode === "signup";
  const authInputSx = {
    "& .MuiInputLabel-root": {
      transform: "translate(14px, 13px) scale(1)",
    },
    "& .MuiInputLabel-root.MuiInputLabel-shrink": {
      transform: "translate(14px, -9px) scale(0.75)",
    },
    "& .MuiInputBase-root": {
      backgroundColor: AUTH_SURFACE_BG,
      borderRadius: AUTH_CONTROL_RADIUS,
    },
    "& .MuiOutlinedInput-input": {
      py: "12px",
      fontSize: "1.02rem",
    },
    "& .MuiOutlinedInput-root:hover fieldset": {
      borderColor: AUTH_BORDER_NEUTRAL,
    },
    "& .Mui-focused:hover fieldset": {
      borderColor: (theme) => theme.palette.primary.main,
    },
  };

  const clearAuthError = () => {
    setAuthError("");
  };

  const getFriendlyAuthError = (error, fallbackMessage) => {
    const authErrorMessages = {
      "auth/invalid-login-credentials": "Incorrect email or password.",
      "auth/user-not-found": "Incorrect email or password.",
      "auth/wrong-password": "Incorrect email or password.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/email-already-in-use": "An account with this email already exists.",
      "auth/weak-password": "Password must be at least 6 characters.",
      "auth/too-many-requests": "Too many attempts. Please try again later.",
      "auth/network-request-failed":
        "Network error. Check your connection and try again.",
      "auth/popup-closed-by-user": "Google sign-in was canceled.",
      "auth/popup-blocked":
        "Popup was blocked. Please allow popups and try again.",
    };

    if (authErrorMessages[error?.code]) {
      return authErrorMessages[error.code];
    }

    if (error?.message === "User profile is missing. Please contact support.") {
      return error.message;
    }

    return fallbackMessage;
  };

  const buildUserDoc = (user) => ({
    uid: user.uid,
    displayName: user.displayName || user.email?.split("@")[0] || "User",
    photoURL: user.photoURL || defaultAvatarUrl,
  });

  const upsertUserDoc = async (user) => {
    await setDoc(doc(db, "users", `${user.uid}`), buildUserDoc(user), {
      merge: true,
    });
  };

  const ensureUserDocExists = async (user) => {
    const userRef = doc(db, "users", `${user.uid}`);
    const userSnap = await getDoc(userRef);
    return userSnap.exists();
  };

  const requireUserDoc = async (user) => {
    const userExists = await ensureUserDocExists(user);
    if (!userExists) {
      throw new Error("User profile is missing. Please contact support.");
    }
  };

  const getCurrentUser = () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("Authenticated user not found.");
    }
    return currentUser;
  };

  const signInUser = async () => {
    setIsSubmitting(true);
    setAuthError("");

    try {
      await signInWithPopup(auth, provider);
      const currentUser = getCurrentUser();
      const userExists = await ensureUserDocExists(currentUser);
      if (!userExists) {
        await setDoc(
          doc(db, "users", `${currentUser.uid}`),
          buildUserDoc(currentUser)
        );
      }
      localStorage.setItem("auth", "true");
      setUserStatus(currentUser.uid, true);
    } catch (error) {
      const friendlyAuthError = getFriendlyAuthError(
        error,
        "Google authentication failed."
      );
      setAuthError(friendlyAuthError);

      if (auth.currentUser) {
        try {
          await signOut(auth);
        } catch (signOutError) {
          console.error(
            "Error signing out after Google auth failure:",
            signOutError
          );
        }
      }
      console.error("Authentication error:", error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const signInDemoUser = async () => {
    setIsSubmitting(true);
    setAuthError("");
    try {
      await signInWithEmailAndPassword(
        auth,
        "demo@example.com",
        "demopassword"
      );
      const currentUser = getCurrentUser();
      await requireUserDoc(currentUser);
      localStorage.setItem("auth", "true");
      setUserStatus(currentUser.uid, true);
    } catch (error) {
      if (auth.currentUser) {
        try {
          await signOut(auth);
        } catch (signOutError) {
          console.error(
            "Error signing out after demo auth failure:",
            signOutError
          );
        }
      }
      setAuthError(getFriendlyAuthError(error, "Demo authentication failed."));
      console.error("Demo user authentication error:", error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const signInWithEmailPwd = async () => {
    setAuthError("");
    const normalizedEmail = email.trim();
    const hasValidEmail = /^\S+@\S+\.\S+$/.test(normalizedEmail);
    if (!hasValidEmail) {
      setAuthError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setAuthError("Password is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
      const currentUser = getCurrentUser();
      await requireUserDoc(currentUser);
      localStorage.setItem("auth", "true");
      setUserStatus(currentUser.uid, true);
    } catch (error) {
      if (auth.currentUser) {
        try {
          await signOut(auth);
        } catch (signOutError) {
          console.error(
            "Error signing out after email/password auth failure:",
            signOutError
          );
        }
      }
      setAuthError(
        getFriendlyAuthError(error, "Email/password sign in failed.")
      );
      console.error("Email/Password authentication error:", error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const signUpWithEmailPwd = async () => {
    setAuthError("");
    const normalizedEmail = email.trim();
    const hasValidEmail = /^\S+@\S+\.\S+$/.test(normalizedEmail);
    if (!hasValidEmail) {
      setAuthError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setAuthError("Password is required.");
      return;
    }
    if (password.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }
    setIsSubmitting(true);
    try {
      await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const currentUser = getCurrentUser();
      const generatedName = normalizedEmail.split("@")[0];
      const resolvedDisplayName = (displayName || "").trim() || generatedName;
      await updateProfile(currentUser, {
        displayName: resolvedDisplayName,
        photoURL: defaultAvatarUrl,
      });
      await upsertUserDoc(currentUser);
      localStorage.setItem("auth", "true");
      setUserStatus(currentUser.uid, true);
    } catch (error) {
      if (auth.currentUser) {
        try {
          await signOut(auth);
        } catch (signOutError) {
          console.error(
            "Error signing out after signup failure:",
            signOutError
          );
        }
      }
      setAuthError(getFriendlyAuthError(error, "Account creation failed."));
      console.error("Email/Password sign up error:", error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        display: "grid",
        placeItems: "center",
        height: "100vh",
        bgcolor: AUTH_PAGE_BG,
        position: "relative",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: { xs: "1.15rem", sm: "1.45rem" },
          left: { xs: "1rem", sm: "1.5rem" },
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <QuestionAnswerOutlinedIcon
          sx={{ color: "primary.main", fontSize: "1.8rem" }}
        />
        <Typography
          component="h1"
          sx={{
            color: "primary.main",
            fontSize: "1.48rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          WeConnect
        </Typography>
      </Box>
      <Box
        key={mode}
        sx={{
          textAlign: "center",
          maxWidth: { xs: "390px", sm: "450px" },
          width: "100%",
          bgcolor: "transparent",
          border: "none",
          borderRadius: AUTH_CONTROL_RADIUS,
          animation: `${authViewEnter} 220ms ease-out`,
        }}
      >
        <Box>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: AUTH_CONTROL_WIDTH,
              mx: "auto",
              mt: "1.75rem",
              mb: "1.5rem",
            }}
          >
            <Typography
              component="h2"
              sx={{
                color: "text.primary",
                fontSize: "1.9rem",
                fontWeight: 500,
                mt: 0,
                mb: 0,
                textAlign: "center",
              }}
            >
              {isSignUpMode ? "Create an account" : "Sign in to continue"}
            </Typography>
          </Box>

          <Box
            sx={{
              color: "text.secondary",
              display: "flex",
              width: AUTH_CONTROL_WIDTH,
              flexDirection: "column",
              mx: "auto",
              gap: "0.9rem",
              mb: "2.5rem",
            }}
          >
            {isSignUpMode ? (
              <>
                <TextField
                  label="Display name"
                  variant="outlined"
                  value={displayName}
                  onChange={(e) => {
                    clearAuthError();
                    setDisplayName(e.target.value);
                  }}
                  sx={{ width: "100%", ...authInputSx }}
                />
                <TextField
                  label="Email"
                  variant="outlined"
                  value={email}
                  onChange={(e) => {
                    clearAuthError();
                    setEmail(e.target.value);
                  }}
                  sx={authInputSx}
                />
                <TextField
                  label="Password"
                  variant="outlined"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    clearAuthError();
                    setPassword(e.target.value);
                  }}
                  InputProps={{
                    endAdornment: password ? (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                          onClick={() => setShowPassword((prev) => !prev)}
                          onMouseDown={(event) => event.preventDefault()}
                          disableRipple
                          edge="end"
                        >
                          {showPassword ? (
                            <VisibilityOffOutlinedIcon fontSize="small" />
                          ) : (
                            <VisibilityOutlinedIcon fontSize="small" />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ) : undefined,
                  }}
                  sx={authInputSx}
                />
              </>
            ) : (
              <>
                <TextField
                  label="Email"
                  variant="outlined"
                  value={email}
                  onChange={(e) => {
                    clearAuthError();
                    setEmail(e.target.value);
                  }}
                  sx={authInputSx}
                />
                <TextField
                  label="Password"
                  variant="outlined"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    clearAuthError();
                    setPassword(e.target.value);
                  }}
                  InputProps={{
                    endAdornment: password ? (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                          onClick={() => setShowPassword((prev) => !prev)}
                          onMouseDown={(event) => event.preventDefault()}
                          disableRipple
                          edge="end"
                        >
                          {showPassword ? (
                            <VisibilityOffOutlinedIcon fontSize="small" />
                          ) : (
                            <VisibilityOutlinedIcon fontSize="small" />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ) : undefined,
                  }}
                  sx={authInputSx}
                />
              </>
            )}
            <Box sx={{ position: "relative", width: "100%", mt: "1.5rem" }}>
              <Box
                sx={{
                  position: "absolute",
                  left: 0,
                  top: "-1.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  color: "error.main",
                  visibility: authError ? "visible" : "hidden",
                  pointerEvents: "none",
                }}
              >
                <ErrorOutlineIcon sx={{ fontSize: "0.95rem" }} />
                <Typography
                  variant="caption"
                  sx={{ color: "inherit", textAlign: "left", lineHeight: 1.2 }}
                >
                  {authError || "\u00A0"}
                </Typography>
              </Box>
              <Button
                variant="contained"
                onClick={isSignUpMode ? signUpWithEmailPwd : signInWithEmailPwd}
                disabled={isSubmitting}
                disableRipple
                startIcon={isSignUpMode ? <PersonAddAlt1Icon /> : undefined}
                sx={{
                  width: "100%",
                  height: AUTH_CONTROL_HEIGHT,
                  borderRadius: AUTH_CONTROL_RADIUS,
                  fontSize: "1.06rem",
                  fontWeight: 600,
                  textTransform: "none",
                  backgroundColor: (theme) => theme.palette.primary.main,
                  transition: (theme) =>
                    theme.transitions.create(
                      ["background-color", "box-shadow", "filter"],
                      {
                        duration: theme.transitions.duration.shortest,
                      }
                    ),
                  boxShadow: (theme) => theme.shadows[2],
                  "&:hover": {
                    backgroundColor: (theme) => theme.palette.primary.main,
                    filter: "brightness(0.94)",
                    boxShadow: (theme) => theme.shadows[2],
                  },
                  "&:active": {
                    backgroundColor: (theme) => theme.palette.primary.dark,
                    filter: "none",
                  },
                  "&&.Mui-disabled": {
                    backgroundColor: (theme) => theme.palette.primary.dark,
                    color: (theme) => theme.palette.primary.contrastText,
                    WebkitTextFillColor: (theme) =>
                      theme.palette.primary.contrastText,
                    boxShadow: (theme) => theme.shadows[2],
                  },
                }}
              >
                {isSignUpMode ? "Create account" : "Sign in"}
              </Button>
            </Box>
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                fontSize: "0.875rem",
                lineHeight: 1.35,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.3rem",
              }}
            >
              {isSignUpMode
                ? "Already have an account?"
                : "Don’t have an account?"}
              <Button
                variant="text"
                size="small"
                disableRipple
                disabled={isSubmitting}
                onClick={() => {
                  clearAuthError();
                  navigate(isSignUpMode ? "/sign-in" : "/sign-up");
                }}
                sx={{
                  minWidth: "auto",
                  p: 0,
                  minHeight: 0,
                  m: 0,
                  fontWeight: 500,
                  textTransform: "none",
                  fontSize: "inherit",
                  lineHeight: "inherit",
                  "&:hover": {
                    backgroundColor: "transparent",
                  },
                }}
              >
                {isSignUpMode ? "Sign in" : "Sign up"}
              </Button>
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: "text.secondary",
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                gap: "1rem",

                "&::before, &::after": {
                  content: '""',
                  borderColor: AUTH_BORDER_NEUTRAL,
                  borderTop: "1px solid",
                  alignSelf: "center",
                },
              }}
            >
              or
            </Typography>
            <Button
              variant="outlined"
              disableRipple
              sx={outlinedActionButtonSx}
              startIcon={<GoogleIcon />}
              onClick={signInUser}
              disabled={isSubmitting}
            >
              Continue with Google
            </Button>
            <Button
              variant="outlined"
              disableRipple
              sx={outlinedActionButtonSx}
              startIcon={<PersonIcon />}
              onClick={signInDemoUser}
              disabled={isSubmitting}
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
  mode: PropTypes.oneOf(["signin", "signup"]),
  setUserStatus: PropTypes.func,
};
