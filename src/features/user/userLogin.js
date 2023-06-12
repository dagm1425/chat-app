/* eslint-disable react/prop-types */
import React from "react";
import { provider, auth } from "../../firebase";
import { signInWithPopup } from "firebase/auth";
import Container from "@mui/material/Container";
// import Box from "@mui/material/Box";
import Button from "@mui/material/Button";

function userLogin() {
  async function signIn() {
    await signInWithPopup(auth, provider);
  }

  return (
    <Container>
      <Button onClick={signIn}>Sign-In with Google</Button>
    </Container>
  );
}

export default userLogin;
