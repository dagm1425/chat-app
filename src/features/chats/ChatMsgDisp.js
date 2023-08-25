/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import {
  Timestamp,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
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
  Modal,
  Avatar,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteMsgDialogContent from "./DeleteMsgDialogContent";
import CircularProgress from "@mui/material/CircularProgress";
import ReplyIcon from "@mui/icons-material/Reply";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LoaderDots from "../../common/components/LoaderDots";
import ChatMsgImgDisp from "./ChatMsgImgDisp";
import { selectChats } from "./chatsSlice";
import { uuid } from "uuidv4";
import UsersSearch from "./UsersSearch";

function ChatMsgDisp({ chat, uploadTask, setMsgReply, scroll }) {
  const user = useSelector(selectUser);
  const chats = useSelector(selectChats);
  const chatId = chat.chatId;
  const [chatMsg, setChatMsg] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [isDeleteMsgOpen, setIsDeleteMsgOpen] = useState(false);
  const [isForwardMsgOpen, setIsForwardMsgOpen] = useState(false);
  const [isImgModalOpen, setIsImgModalOpen] = useState(false);
  const [imgData, setImgData] = useState(null);
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
    updateUnreadMsg();

    return () => {
      unsub();
    };
  }, [chatId]);

  // useEffect(() => {
  //   if (chatMsg.length) resetUnreadMsg();
  // }, [chatMsg]);

  const subscribeChatMsg = () => {
    const q = query(
      collection(db, "chats", `${chatId}`, "chatMessages"),
      orderBy("timestamp", "desc"),
      limit(30)
    );

    return onSnapshot(q, (querySnap) => {
      const messages = [];
      querySnap.forEach((doc) => messages.push(doc.data()));
      const sortedMessages = messages.sort((a, b) => {
        if (a.timestamp === null) {
          return 1;
        }
        if (b.timestamp === null) {
          return -1;
        }
        return a.timestamp - b.timestamp;
      });
      setChatMsg(sortedMessages);
    });
  };

  const updateUnreadMsg = async () => {
    const querySnapshot = await getDocs(
      collection(db, "chats", `${chatId}`, "chatMessages")
    );
    if (chat.type === "private") {
      querySnapshot.forEach(async (doc) => {
        if (doc.data().from.uid === user.uid || doc.data().isMsgRead == true)
          return;
        await updateDoc(doc.ref, {
          isMsgRead: true,
        });
      });
    } else {
      querySnapshot.forEach(async (doc) => {
        if (
          doc.data().from.uid === user.uid ||
          doc.data().isMsgRead.includes(user.uid)
        )
          return;
        await updateDoc(doc.ref, {
          isMsgRead: arrayUnion(user.uid),
        });
      });
    }
  };
  // const resetUnreadMsg = async () => {
  //   if (chatMsg[chatMsg.length - 1].from.uid === user.uid) return;

  //   await updateDoc(doc(db, "chats", `${chatId}`), {
  //     unreadMsg: 0,
  //   });
  // };

  const handleMsgOptionsOpen = (e) => {
    setAnchorEl(e.currentTarget);
    setMsgId(e.currentTarget.parentElement.id);
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

  const openImgModal = (imgData) => {
    setIsImgModalOpen(true);
    setImgData(imgData);
  };

  const closeImgModal = () => {
    setIsImgModalOpen(false);
    setImgData(null);
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

  const downloadFile = (url, fileName) => {
    var xhr = new XMLHttpRequest();
    xhr.responseType = "blob";
    // eslint-disable-next-line no-unused-vars
    xhr.onload = function (event) {
      var a = document.createElement("a");
      a.href = window.URL.createObjectURL(xhr.response);
      a.download = `${fileName}`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      // eslint-disable-next-line no-unused-vars
      var blob = xhr.response;
    };
    xhr.open("GET", url);
    xhr.send();
  };

  const handleForwardMsg = async (recipientUser) => {
    handleMsgForwardClose();

    const msg = chatMsg.find((msg) => msg.msgId === msgId);
    const privateChats = chats.filter((chat) => chat.type === " private");
    const chatWithSelectedUser = privateChats.filter((chat) => {
      return (
        chat.members.filter(
          (member) =>
            member.uid === user.uid || member.uid === recipientUser.uid
        ).length == 2
      );
    });

    if (chatWithSelectedUser.length) {
      const chatId = chatWithSelectedUser[0].chatId;
      const msgId = uuid();
      const msgRef = doc(db, "chats", `${chatId}`, "chatMessages", `${msgId}`);
      const message = {
        ...msg,
        from: user,
        msgId: msgId,
        msgReply: null,
        timestamp: serverTimestamp(),
      };

      await setDoc(msgRef, message);
    } else {
      const chatId = uuid();
      const msgId = uuid();
      const message = {
        ...msg,
        from: user,
        msgId: msgId,
        msgReply: null,
        timestamp: serverTimestamp(),
      };
      let msgRef;

      await setDoc(doc(db, "chats", `${chatId}`), {
        chatId: `${chatId}`,
        type: "private",
        createdBy: user,
        members: [user, recipientUser],
      });

      msgRef = doc(db, "chats", `${chatId}`, "chatMessages", `${msgId}`);

      await setDoc(msgRef, message);
    }
  };

  const scrollToMsg = (id) => {
    const msgList = scroll.current.children;
    const i = Array.from(msgList).findIndex((msg) => msg.id === id);
    const msg = scroll.current.children.item(i).lastElementChild;

    msg.style.scrollMarginTop = "7rem";
    msg.style.background = "#eee";

    msg.scrollIntoView({ behavior: "smooth" });

    setTimeout(() => {
      msg.style.scrollMarginTop = "";
      msg.style.background = "#fff";
    }, 1000);
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
    const isMsgFromOtherPublicChatMembers =
      chat.type === "public" && message.from.uid !== user.uid;

    return (
      <React.Fragment key={message.msgId}>
        {msgDates.has(msgDate) ? null : renderMsgDate(msgDate)}
        <Box
          id={message.msgId}
          sx={{
            display: isMsgFromOtherPublicChatMembers ? "flex" : "block",
            alignSelf: isSentFromUser ? "flex-end" : "flex-start",
            width: "fit-content",
            maxWidth: "45%",
          }}
        >
          {isMsgFromOtherPublicChatMembers && (
            <Avatar
              src={message.from.photoURL}
              sx={{ alignSelf: "flex-end" }}
            />
          )}
          <Box
            onClick={handleMsgClick}
            onContextMenu={handleMsgClick}
            sx={{
              padding: "0.75rem 1rem 0.25rem",
              margin: "1rem",
              background: "#FFF",
              borderRadius: isSentFromUser
                ? "1.125rem 1.125rem 0 1.125rem"
                : "1.125rem 1.125rem 1.125rem 0",
              boxShadow: 2,
            }}
          >
            {isMsgFromOtherPublicChatMembers && (
              <Typography
                variant="subtitle1"
                sx={{
                  fontSize: 14,
                  fontWeight: "bold",
                  mb: "0.25rem",
                }}
              >
                {message.from.displayName}
              </Typography>
            )}
            {message.msgReply && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  px: "0.5rem",
                  mb: "0.5rem",
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
              <Typography variant="body1">{message.msg}</Typography>
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
                        cursor: "pointer",
                        marginBottom: "0.5rem",
                      }}
                      onClick={() =>
                        openImgModal({
                          fileName: message.fileMsg.fileName,
                          url: message.fileMsg.fileUrl,
                        })
                      }
                    />
                  )
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: "1rem",
                      mb: message.caption !== "" ? "0.5rem" : "0rem",
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
                          <CircularProgress
                            sx={{ gridColumn: 1, gridRow: 1 }}
                          />
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
                          onClick={() =>
                            downloadFile(
                              message.fileMsg.fileUrl,
                              message.fileMsg.fileName
                            )
                          }
                        >
                          <DownloadIcon
                            fontSize="large"
                            sx={{ color: "#000" }}
                          />
                        </IconButton>
                      ) : (
                        <InsertDriveFileIcon fontSize="large" />
                      )}
                    </Box>
                    <div>
                      <Typography variant="subtitle1" fontWeight="bold">
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
            <Box sx={{ textAlign: "right", marginLeft: "0.5rem" }}>
              {msgTime === "" ? (
                <LoaderDots />
              ) : (
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontSize: 14,
                    color: "rgba(0, 0, 0, 0.45)",
                  }}
                >
                  {msgTime}
                </Typography>
              )}
            </Box>
          </Box>
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
        ref={scroll}
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        {msgList.length > 0 ? msgList : null}
        <span></span>
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
          <DialogTitle>Delete message?</DialogTitle>
          <DeleteMsgDialogContent
            onClose={handleDeleteMsgClose}
            chatId={chatId}
            msgId={msgId}
            chatMsg={chatMsg}
          />
        </Dialog>
        <Dialog open={isForwardMsgOpen} onClose={handleMsgForwardClose}>
          <DialogTitle>Forward message</DialogTitle>
          <UsersSearch
            excUsers={chat.type === "private" ? chat.members : [{ user }]}
            handleItemClick={handleForwardMsg}
            onClose={handleMsgForwardClose}
          />
        </Dialog>

        <Modal
          open={isImgModalOpen}
          onClose={closeImgModal}
          sx={{ display: "grid", placeItems: "center" }}
        >
          <div>
            <ChatMsgImgDisp
              imgData={imgData}
              downloadFile={downloadFile}
              onClose={closeImgModal}
            />
          </div>
        </Modal>
      </Box>
    </Box>
  );
}

export default ChatMsgDisp;
