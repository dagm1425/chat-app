/* eslint-disable react/prop-types */
import React, { useState } from "react";
import PropTypes from "prop-types";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "../../firebase";
import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { v4 as uuid } from "uuid";
import { Box, Button, Typography, TextField } from "@mui/material";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import { formatFilename } from "../../common/utils";

function FileMsgDialogContent({
  chat,
  user,
  fileMsg,
  setUploadTask,
  onClose,
  msgReply,
  setMsgReply,
  scroll,
}) {
  const file = fileMsg.file;
  const chatId = chat.chatId;
  const [caption, setCaption] = useState("");
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
    const chatRef = doc(db, "chats", `${chatId}`);
    const msgRef = doc(db, "chats", `${chatId}`, "chatMessages", `${msgId}`);
    const msgList = scroll.current.children;
    const lastMmsg = msgList.item(msgList.length - 2);
    let unreadCounts = { ...chat.unreadCounts };
    const message = {
      msgId,
      from: user,
      caption,
      isMsgRead: chat.type === "private" ? false : [],
      timestamp: serverTimestamp(),
      msgReply,
      fileMsg: {
        fileName: file.name,
        fileType,
        fileSize,
        fileUrl: "",
        progress: 0,
        uploadTask: null,
      },
    };

    if (fileType.includes("image")) {
      message.fileMsg.imgWidth = fileMsg.imgSize.width;
      message.fileMsg.imgHeight = fileMsg.imgSize.height;
    }

    await setDoc(msgRef, message);

    lastMmsg.scrollIntoView({ behavior: "smooth" });

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

    await updateDoc(chatRef, { timestamp: message.timestamp });
    await updateDoc(chatRef, { recentMsg: message });

    for (const uid in unreadCounts) {
      if (uid !== user.uid) {
        unreadCounts[uid]++;
      }
    }

    await updateDoc(chatRef, { unreadCounts });
  };

  return (
    <Box sx={{ textAlign: "center", width: 280, padding: "1rem" }}>
      <Box
        sx={{
          width: "85%",
          mx: "auto",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "0.825rem",
        }}
      >
        <Box
          sx={{
            display: "grid",
            placeItems: "center",
            bgcolor: "background.default",
            width: 40,
            height: 40,
            filter: "brightness(0.875)",
            borderRadius: "50%",
          }}
        >
          <InsertDriveFileIcon fontSize="medium" />
        </Box>
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="body1">{formatFilename(file.name)}</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {fileSize}
          </Typography>
        </Box>
      </Box>
      <TextField
        label="Add caption"
        variant="standard"
        sx={{ width: "85%", mt: "1.25rem", mb: "1.75rem" }}
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
  scroll: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  ]),
};
