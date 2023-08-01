/* eslint-disable react/prop-types */
import React, { useEffect, useRef, useState } from "react";
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
  updateDoc,
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
import ReplyIcon from "@mui/icons-material/Reply";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ForwardMsgDialogContent from "./ForwardMsgDialogContent";
import LoaderDots from "../components/LoaderDots";

function ChatMsgDisp({ chatId, uploadTask, setMsgReply, scroll }) {
  const user = useSelector(selectUser);
  const [chatMsg, setChatMsg] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [isDeleteMsgOpen, setIsDeleteMsgOpen] = useState(false);
  const [isForwardMsgOpen, setIsForwardMsgOpen] = useState(false);
  const [msgId, setMsgId] = useState("");
  const [fileMsgId, setFileMsgId] = useState("");
  const msgDates = new Set();
  let ref = useRef(null);

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

  useEffect(() => {
    if (chatMsg.length) resetUnreadMsg();
  }, [chatMsg]);

  const subscribeChatMsg = () => {
    const q = query(
      collection(db, "chats", `${chatId}`, "chatMessages"),
      orderBy("timestamp", "desc"),
      limit(30)
    );

    return onSnapshot(q, (querySnap) => {
      const messages = [];
      querySnap.forEach((doc) => messages.push(doc.data()));
      const sortedMessages = messages.sort((a, b) => a.timestamp - b.timestamp);
      setChatMsg(sortedMessages);
    });
  };

  const resetUnreadMsg = async () => {
    if (chatMsg[chatMsg.length - 1].from.uid === user.uid) return;

    await updateDoc(doc(db, "chats", `${chatId}`), {
      unreadMsg: 0,
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

  const handleMsgForwardOpen = () => {
    handleMsgOptionsClose();
    setIsForwardMsgOpen(true);
  };

  const handleMsgForwardClose = () => {
    setIsForwardMsgOpen(false);
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

  const handleMsgReply = async () => {
    const msgReply = chatMsg.find((msg) => msg.msgId === msgId);
    setMsgReply(msgReply);

    handleMsgOptionsClose();
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

  const scrollToMsg = (id) => {
    const msgList = ref.current.children;
    const i = Array.from(msgList).findIndex((msg) => msg.id === id);
    const msg = ref.current.children.item(i);

    msg.scrollIntoView({ behavior: "smooth" });
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
            // maxHeight: "45%",
            boxShadow: 2,
          }}
        >
          {message.msgReply && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                px: "0.5rem",
                borderLeft: "4px solid #80b3ff",
                cursor: "pointer",
              }}
              onClick={() => {
                scrollToMsg(message.msgReply.msgId);
              }}
            >
              {message.msgReply.fileMsg && (
                <InsertDriveFileIcon fontSize="medium" />
              )}
              <div>
                <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
                  {message.msgReply.from.displayName}
                </Typography>
                <Typography variant="subtitle1">
                  {message.msgReply.msg
                    ? message.msgReply.msg
                    : message.msgReply.caption
                    ? message.msgReply.caption
                    : message.msgReply.fileMsg.fileName}
                </Typography>
              </div>
            </Box>
          )}
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
                      width: "100%",
                      height: "auto",
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
          {msgTime === "" ? (
            <LoaderDots />
          ) : (
            <Typography
              variant="subtitle1"
              sx={{
                fontSize: 14,
                color: "rgba(0, 0, 0, 0.45)",
                textAlign: "right",
              }}
            >
              {msgTime}
            </Typography>
          )}
        </Box>
      </React.Fragment>
    );
  });

  return (
    <Box
      sx={{
        flex: "1 1 auto",
        p: "6rem 4rem",
        bgcolor: "secondary.main",
      }}
    >
      <Box
        ref={ref}
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        {msgList.length > 0 ? msgList : null}
        <span ref={scroll}></span>
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
          <MenuItem onClick={handleMsgReply}>
            <ListItemIcon>
              <ReplyIcon />
            </ListItemIcon>
            <ListItemText primary="Reply" />
          </MenuItem>
          <MenuItem onClick={handleMsgForwardOpen}>
            <ListItemIcon>
              <ArrowForwardIcon />
            </ListItemIcon>
            <ListItemText primary="Forward" />
          </MenuItem>
        </Menu>

        <Dialog open={isDeleteMsgOpen} onClose={handleDeleteMsgClose}>
          <DialogTitle>Confirm message deletion</DialogTitle>
          <DeleteMsgDialogContent
            onClose={handleDeleteMsgClose}
            chatId={chatId}
            msgId={msgId}
            chatMsg={chatMsg}
          />
        </Dialog>

        <Dialog open={isForwardMsgOpen} onClose={handleMsgForwardClose}>
          <DialogTitle>Forward message</DialogTitle>
          <ForwardMsgDialogContent
            onClose={handleMsgForwardClose}
            chatId={chatId}
            msg={chatMsg.find((msg) => msg.msgId === msgId)}
          />
        </Dialog>
      </Box>
    </Box>
  );
}

export default ChatMsgDisp;
