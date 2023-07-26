/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../../firebase";
import { format } from "date-fns";
import formatRelative from "date-fns/formatRelative";
import { enUS } from "date-fns/esm/locale";
import {
  Box,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  Typography,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteMsgDialogContent from "./DeleteMsgDialogContent";
import CircularProgress from "@mui/material/CircularProgress";

function ChatMsgDisp({ chatId, uploadTask }) {
  const user = useSelector(selectUser);
  const [chatMsg, setChatMsg] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [isDeleteMsgOpen, setIsDeleteMsgOpen] = useState(false);
  const [msgId, setMsgId] = useState("");
  const [fileMsgId, setFileMsgId] = useState("");

  const msgDates = new Set();
  msgDates.add("");
  const formatRelativeLocale = {
    lastWeek: " EEEE",
    yesterday: "'Yesterday'",
    today: "'Today'",
    tomorrow: " EEEE",
    nextWeek: " EEEE",
    other: " MMMM dd, yyy",
  };
  const locale = {
    ...enUS,
    formatRelative: (token) => formatRelativeLocale[token],
  };

  useEffect(() => {
    const unsub = subscribeChatMsg();

    return () => {
      unsub();
    };
  }, [chatId]);

  const subscribeChatMsg = () => {
    const q = query(
      collection(db, "chats", `${chatId}`, "chatMessages"),
      orderBy("timestamp", "asc"),
      limit(30)
    );

    return onSnapshot(q, (querySnap) => {
      const messages = [];
      querySnap.forEach((doc) => messages.push(doc.data()));
      setChatMsg(messages);
    });
  };

  const handleMsgOptionsOpen = (e) => {
    setAnchorEl(e.currentTarget);
    setMsgId(e.currentTarget.id);
  };

  const handleMsgOptionsClose = () => {
    setAnchorEl(null);
  };

  const handleMsgClick = (e) => {
    if (e.type === "contextmenu") {
      e.preventDefault();
      handleMsgOptionsOpen(e);
    }
    return;
  };

  const handleDeleteMsgOpen = () => {
    handleMsgOptionsClose();
    setIsDeleteMsgOpen(true);
  };

  const handleDeleteMsgClose = () => {
    setIsDeleteMsgOpen(false);
  };

  const renderMsgDate = (msgDate) => {
    msgDates.add(msgDate);

    return (
      <Box
        sx={{
          alignSelf: "center",
          padding: "0.5rem 1rem",
          margin: "1rem",
          background: "#FFF",
          borderRadius: "1.125rem 1.125rem 1.125rem 1.125rem",
          width: "fit-content",
          maxWidth: "66%",
          boxShadow: 1,
        }}
      >
        {msgDate}
      </Box>
    );
  };

  const cancelUpload = async (msgId) => {
    uploadTask.cancel();

    await deleteDoc(doc(db, "chats", `${chatId}`, "chatMessages", `${msgId}`));
  };

  const downloadFile = (url) => {
    var xhr = new XMLHttpRequest();
    xhr.responseType = "blob";
    // eslint-disable-next-line no-unused-vars
    xhr.onload = function (event) {
      var a = document.createElement("a");
      a.href = window.URL.createObjectURL(xhr.response);
      a.download = "someFileName"; // replace "someFileName" with actual file name
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      // eslint-disable-next-line no-unused-vars
      var blob = xhr.response;
    };
    xhr.open("GET", url);
    xhr.send();
  };

  const msgList = chatMsg.map((message) => {
    const isSentFromUser = message.from.uid === user.uid;
    const timestamp =
      message.timestamp == null ? "" : message.timestamp.toDate();
    const msgTime = timestamp == "" ? "" : format(timestamp, "hh:mm a");
    const msgDate =
      timestamp == ""
        ? ""
        : formatRelative(timestamp, Timestamp.now().toDate(), { locale });

    return (
      <React.Fragment key={message.msgId}>
        {msgDates.has(msgDate) ? null : renderMsgDate(msgDate)}
        <Box
          id={message.msgId}
          onClick={handleMsgClick}
          onContextMenu={handleMsgClick}
          sx={{
            alignSelf: isSentFromUser ? "flex-end" : "flex-start",
            padding: "0.75rem 1rem",
            margin: "1rem",
            background: "#FFF",
            borderRadius: isSentFromUser
              ? "1.125rem 1.125rem 0 1.125rem"
              : "1.125rem 1.125rem 1.125rem 0",
            width: "fit-content",
            maxWidth: "45%",
            maxHeight: "45%",
            boxShadow: 2,
          }}
        >
          {message.msg ? (
            message.msg
          ) : (
            <>
              {message.fileMsg.fileType.includes("image") ? (
                message.fileMsg.progress != 100 ? (
                  <Box
                    sx={{
                      display: "grid",
                      placeItems: "center",
                      height: 65,
                      width: 65,
                      bgcolor: "#eee",
                      borderRadius: "50%",
                    }}
                  >
                    <Box sx={{ display: "grid" }}>
                      <CircularProgress sx={{ gridColumn: 1, gridRow: 1 }} />
                      <IconButton
                        sx={{ gridColumn: 1, gridRow: 1 }}
                        onClick={() =>
                          // const uploadObj = JSON.parse(
                          //   message.fileMsg.uploadTask
                          // );
                          cancelUpload(message.msgId)
                        }
                      >
                        <CloseIcon />
                      </IconButton>
                    </Box>
                  </Box>
                ) : (
                  <img
                    src={message.fileMsg.fileUrl}
                    style={{
                      height: "100%",
                      width: "100%",
                      objectFit: "cover",
                    }}
                  />
                )
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "1rem",
                  }}
                >
                  <Box
                    sx={{
                      display: "grid",
                      placeItems: "center",
                      height: 65,
                      width: 65,
                      bgcolor: "#eee",
                      borderRadius: "50%",
                    }}
                    onMouseOver={() => setFileMsgId(message.msgId)}
                    onMouseOut={() => setFileMsgId("")}
                  >
                    {message.fileMsg.progress != 100 ? (
                      <Box sx={{ display: "grid" }}>
                        <CircularProgress sx={{ gridColumn: 1, gridRow: 1 }} />
                        <IconButton
                          sx={{ gridColumn: 1, gridRow: 1 }}
                          onClick={() =>
                            // const uploadObj = JSON.parse(
                            //   message.fileMsg.uploadTask
                            // );
                            cancelUpload(message.msgId)
                          }
                        >
                          <CloseIcon />
                        </IconButton>
                      </Box>
                    ) : message.msgId === fileMsgId ? (
                      <IconButton
                        sx={{
                          size: "large",
                          "&.MuiButtonBase-root:hover": {
                            bgcolor: "transparent",
                          },
                        }}
                        onClick={() => downloadFile(message.fileMsg.fileUrl)}
                      >
                        <DownloadIcon fontSize="large" sx={{ color: "#000" }} />
                      </IconButton>
                    ) : (
                      <InsertDriveFileIcon fontSize="large" />
                    )}
                  </Box>
                  <div>
                    <Typography variant="subtitle1">
                      {message.fileMsg.fileName}
                    </Typography>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        display: "inline-block",
                        color: "rgba(0, 0, 0, 0.45)",
                        mr: "0.75rem",
                      }}
                    >
                      {message.fileMsg.fileSize}
                    </Typography>
                    {message.fileMsg.progress != 100 && (
                      <Typography
                        variant="subtitle1"
                        sx={{
                          display: "inline-block",
                          color: "rgba(0, 0, 0, 0.45)",
                        }}
                      >
                        {`${message.fileMsg.progress.toFixed(0)}% done`}
                      </Typography>
                    )}
                  </div>
                </Box>
              )}
              <Typography variant="subtitle1">{message.caption}</Typography>
            </>
          )}
          <Box
            component="span"
            sx={{
              position: "relative",
              top: "6px",
              color: "rgba(0, 0, 0, 0.45)",
              display: "inline-block",
              ml: "1rem",
            }}
          >
            {msgTime}
          </Box>
        </Box>
      </React.Fragment>
    );
  });

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
      }}
    >
      {msgList.length > 0 ? msgList : null}

      <Menu
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handleMsgOptionsClose}
      >
        <MenuItem onClick={handleDeleteMsgOpen}>
          <ListItemIcon>
            <DeleteIcon />
          </ListItemIcon>
          <ListItemText primary="Delete" />
        </MenuItem>
      </Menu>

      <Dialog open={isDeleteMsgOpen} onClose={handleDeleteMsgClose}>
        <DialogTitle>Confirm message deletion</DialogTitle>
        <DeleteMsgDialogContent
          onClose={handleDeleteMsgClose}
          chatId={chatId}
          msgId={msgId}
        />
      </Dialog>
    </Box>
  );
}

export default ChatMsgDisp;
