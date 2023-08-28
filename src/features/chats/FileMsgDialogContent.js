import React, { useState } from "react";
import PropTypes from "prop-types";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "../../firebase";
import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { v4 as uuid } from "uuid";
import { Box, Button, Typography, TextField } from "@mui/material";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";

function FileMsgDialogContent({
  chat,
  user,
  file,
  setUploadTask,
  onClose,
  msgReply,
  setMsgReply,
}) {
  const chatId = chat.chatId;
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
    if (msgReply) setMsgReply(null);

    const msgId = uuid();
    const msgRef = doc(db, "chats", `${chatId}`, "chatMessages", `${msgId}`);
    // const chatRef = doc(db, "chats", `${chatId}`);

    const message = {
      msgId,
      from: user,
      caption,
      isMsgRead: chat.type === "private" ? false : [],
      timestamp: serverTimestamp(),
      msgReply,
      fileMsg: {
        fileName,
        fileType,
        fileSize,
        fileUrl: "",
        progress: 0,
        uploadTask: null,
      },
    };

    await setDoc(msgRef, message);

    // await updateDoc(chatRef, {
    //   recentMsg: {
    //     msgId,
    //     from: user,
    //     msg: caption === "" ? fileName : caption,
    //     timestamp: serverTimestamp(),
    //   },
    // });

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
        <Button onClick={sendFileMsg}>Send</Button>
      </Box>
    </Box>
  );
}

export default FileMsgDialogContent;

FileMsgDialogContent.propTypes = {
  chat: PropTypes.object,
  user: PropTypes.shape({
    uid: PropTypes.string,
    displayName: PropTypes.string,
    photoURL: PropTypes.string,
  }),
  file: PropTypes.object,
  setUploadTask: PropTypes.func,
  onClose: PropTypes.func,
  setMsgReply: PropTypes.func,
  msgReply: PropTypes.object,
};
