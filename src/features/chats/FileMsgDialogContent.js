/* eslint-disable react/prop-types */
import React, { useState } from "react";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "../../firebase";
import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { v4 as uuid } from "uuid";
import { Box, Button, Typography, TextField } from "@mui/material";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";

function FileMsgDialogContent({ chatId, user, file, setUploadTask, onClose }) {
  let fileName;
  const [caption, setCaption] = useState("");

  if (file.name.length <= 20) {
    fileName = file.name;
  } else {
    const begName = file.name.substring(0, 12);
    const endName = file.name.substring(file.name.length - 8);
    fileName = begName + "..." + endName;
  }

  const sufixes = ["B", "kB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(file.size) / Math.log(1024));
  const fileSize = `${(file.size / Math.pow(1024, i)).toFixed(2)} ${
    sufixes[i]
  }`;
  const fileType = file.type;

  const updateProgress = async (msgRef, progress) => {
    // const uploadTaskObj = progress == 100 ? null : JSON.stringify(uploadTask);

    await updateDoc(msgRef, {
      "fileMsg.progress": progress,
      // "fileMsg.uploadTask": uploadTaskObj,
    });
  };

  const updateURL = async (msgRef, downloadURL) => {
    await updateDoc(msgRef, {
      "fileMsg.fileUrl": downloadURL,
    });
  };

  const sendFileMsg = async () => {
    onClose();

    const msgId = uuid();
    const msgRef = doc(db, "chats", `${chatId}`, "chatMessages", `${msgId}`);
    const message = {
      msgId,
      from: user,
      caption,
      timestamp: serverTimestamp(),
      fileMsg: {
        fileName,
        fileType,
        fileSize,
        fileThumbnailUrl: "https://icons8.com/icon/11204/file", // review necessity of these icon links
        fileUrl: "https://icons8.com/icon/11204/file",
        progress: 0,
        uploadTask: null,
      },
    };

    await setDoc(msgRef, message);

    const filePath = `${user.uid}/${msgId}/${file.name}`;
    const newFileRef = ref(storage, filePath);
    const uploadTask = uploadBytesResumable(newFileRef, file);

    setUploadTask(uploadTask);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;

        updateProgress(msgRef, progress, uploadTask);

        switch (snapshot.state) {
          case "paused":
            console.log("Upload is paused");
            break;
          case "running":
            console.log("Upload is running");
            break;
        }
      },
      (error) => {
        console.log("There was a problem uploading the file", error);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          console.log("File available at", downloadURL);
          updateURL(msgRef, downloadURL);
        });
      }
    );
  };

  return (
    <Box sx={{ textAlign: "center", width: 280, padding: "1rem" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "1.5rem",
        }}
      >
        <InsertDriveFileIcon fontSize="large" />
        <div>
          <Typography variant="subtitle1">{fileName}</Typography>
          <Typography variant="subtitle1" sx={{ color: "rgba(0, 0, 0, 0.45)" }}>
            {fileSize}
          </Typography>
        </div>
      </Box>
      <TextField
        label="Add caption"
        variant="standard"
        sx={{ width: "75%", mt: "1.25rem", mb: "1.75rem" }}
        onChange={(e) => setCaption(e.target.value)}
        autoFocus
      />
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "1rem",
        }}
      >
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={sendFileMsg}>
          Send
        </Button>
      </Box>
    </Box>
  );
}

export default FileMsgDialogContent;
