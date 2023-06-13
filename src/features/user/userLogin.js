/* eslint-disable react/prop-types */
import React from "react";
import { provider, auth, db } from "../../firebase";
import { signInWithPopup } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import Container from "@mui/material/Container";
import Button from "@mui/material/Button";

function userLogin() {
  async function signIn() {
    await signInWithPopup(auth, provider);
    addUser(auth.currentUser);
  }

  const addUser = async (user) => {
    await setDoc(doc(db, "users", `${user.uid}`), {
      uid: user.uid,
      displayName: user.displayName,
      photoUrl: user.photoURL,
    });
  };

  return (
    <Container>
      <Button onClick={signIn}>Sign-In with Google</Button>
    </Container>
  );
}

export default userLogin;
