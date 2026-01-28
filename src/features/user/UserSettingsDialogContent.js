import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Box,
  Button,
  TextField,
  Avatar,
  Typography,
  CircularProgress,
} from "@mui/material";
import { auth, db, storage } from "../../firebase";
import { selectUser, setUser } from "./userSlice";
import { updateProfile } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { v4 as uuid } from "uuid";

function UserSettingsDialogContent({ onClose }) {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [photoFile, setPhotoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(user.photoURL || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!photoFile) return;
    const nextUrl = URL.createObjectURL(photoFile);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [photoFile]);

  const updateChatsForUser = async (oldUser, newUser) => {
    const chatsRef = collection(db, "chats");
    const memberIdsQuery = query(
      chatsRef,
      where("memberIds", "array-contains", oldUser.uid)
    );
    const memberIdsSnap = await getDocs(memberIdsQuery);

    const updates = memberIdsSnap.docs.map((chatDoc) => {
      const chatData = chatDoc.data();
      const updatedMembers = chatData.members.map((member) =>
        member.uid === oldUser.uid ? newUser : member
      );
      const updatePayload = { members: updatedMembers };

      if (chatData.createdBy?.uid === oldUser.uid) {
        updatePayload.createdBy = newUser;
      }

      if (chatData.call?.callData?.participantDetails?.[oldUser.uid]) {
        updatePayload[`call.callData.participantDetails.${oldUser.uid}`] =
          newUser;
      }

      updatePayload.memberIds = updatedMembers.map((member) => member.uid);

      return updateDoc(chatDoc.ref, updatePayload);
    });

    await Promise.all(updates);
  };

  const uploadAvatar = async (file) => {
    const filePath = `users/${user.uid}/avatars/${uuid()}-${file.name}`;
    const fileRef = ref(storage, filePath);
    const uploadTask = uploadBytesResumable(fileRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        () => {},
        (err) => reject(err),
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        }
      );
    });
  };

  const handleSave = async () => {
    const nextDisplayName = displayName.trim();
    if (!nextDisplayName) {
      setError("Username cannot be empty.");
      return;
    }

    const hasNameChange = nextDisplayName !== user.displayName;
    const hasPhotoChange = !!photoFile;
    if (!hasNameChange && !hasPhotoChange) {
      onClose();
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      let nextPhotoURL = user.photoURL || "";
      if (photoFile) {
        nextPhotoURL = await uploadAvatar(photoFile);
      }

      const updatedUser = {
        uid: user.uid,
        displayName: nextDisplayName,
        photoURL: nextPhotoURL,
      };

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: nextDisplayName,
          photoURL: nextPhotoURL,
        });
      }

      await Promise.all([
        updateDoc(doc(db, "users", user.uid), {
          displayName: nextDisplayName,
          photoURL: nextPhotoURL,
        }),
        updateChatsForUser(user, updatedUser),
      ]);
      dispatch(setUser(updatedUser));
      onClose();
    } catch (err) {
      console.error("Error updating profile:", err);
      setError("Failed to update profile. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ width: 360, px: "1.5rem", pb: "1.25rem" }}>
      <Box sx={{ textAlign: "center", mb: "1rem" }}>
        <Avatar
          src={previewUrl}
          sx={{ width: 72, height: 72, mx: "auto", mb: "0.5rem" }}
        />
        <Button variant="outlined" component="label" size="small">
          Upload photo
          <input
            hidden
            type="file"
            accept="image/*"
            onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
          />
        </Button>
      </Box>

      <TextField
        label="Username"
        variant="standard"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        fullWidth
      />

      {error && (
        <Typography variant="body2" sx={{ color: "error.main", mt: "0.5rem" }}>
          {error}
        </Typography>
      )}

      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "0.75rem",
          mt: "1.5rem",
        }}
      >
        <Button onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <CircularProgress size={18} /> : "Save"}
        </Button>
      </Box>
    </Box>
  );
}

export default UserSettingsDialogContent;

UserSettingsDialogContent.propTypes = {
  onClose: PropTypes.func,
};
