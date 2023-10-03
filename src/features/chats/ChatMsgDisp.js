import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import {
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
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import DeleteMsgDialogContent from "./DeleteMsgDialogContent";
import CircularProgress from "@mui/material/CircularProgress";
import ReplyIcon from "@mui/icons-material/Reply";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ChatMsgImgDisp from "./ChatMsgImgDisp";
import { selectChats } from "./chatsSlice";
import { v4 as uuid } from "uuid";
import UsersSearch from "./UsersSearch";
import { formatDate, formatFilename, formatTime } from "../../common/utils";

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
  const [isScrollToBottomBtnActive, setIsScrollToBottomBtnActive] =
    useState(false);
  const [scrollTop, setScrollTop] = useState(0);

  const msgDates = new Set();
  const imgURL =
    "https://blog.1a23.com/wp-content/uploads/sites/2/2020/02/pattern-9.svg";

  const showScrollToBottomBtn = () => {
    setIsScrollToBottomBtnActive(true);
  };

  const hideScrollToBottomBtn = () => {
    setIsScrollToBottomBtnActive(false);
  };

  useEffect(() => {
    const unsub = subscribeChatMsg();

    return () => {
      unsub();
    };
  }, [chatId]);

  useEffect(() => {
    updateUnreadMsg();
  }, [chatMsg]);

  useEffect(() => {
    if (!scrollTop) return;

    const observer = new IntersectionObserver(callback);
    const list = scroll.current.children;
    const target = list.item(list.length - 2);

    setTimeout(() => {
      observer.observe(target);
    }, 1000);

    return () => observer.disconnect();
  }, [scrollTop]);

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

  // eslint-disable-next-line no-unused-vars
  const callback = (entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        hideScrollToBottomBtn();
      } else {
        showScrollToBottomBtn();
      }
    });
  };

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
          position: "sticky",
          fontSize: 12,
          top: 0,
          alignSelf: "center",
          justifySelf: "flex-start",
          padding: "0.5rem 0.75rem",
          margin: "1rem",
          bgcolor: "background.paper",
          borderRadius: "1rem",
          width: "fit-content",
          maxWidth: "66%",
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
    const privateChats = chats.filter((chat) => chat.type === "private");
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
        timestamp: serverTimestamp(),
        recentMsg: null,
      });

      msgRef = doc(db, "chats", `${chatId}`, "chatMessages", `${msgId}`);

      await setDoc(msgRef, message);
    }
  };

  const scrollToMsg = (message) => {
    const id = message.msgReply.msgId;
    const msgList = scroll.current.children;
    const i = Array.from(msgList).findIndex((msg) => msg.id === id);
    const msg = msgList.item(i).lastElementChild;

    msg.style.scrollMarginTop = "7rem";
    msg.style.filter = "brightness(0.7)";

    msg.scrollIntoView({ behavior: "smooth" });

    setTimeout(() => {
      msg.style.scrollMarginTop = "";
      msg.style.filter = "brightness(1)";
    }, 1000);
  };

  const scrollToBottom = () => {
    const list = scroll.current.children;
    const lastMmsg = list.item(list.length - 2);

    lastMmsg.scrollIntoView({ behavior: "smooth" });
  };

  const updateScrollTop = () => {
    if (scrollTop) return;
    setScrollTop(scroll.current.scrollTop);
  };

  const msgList = chatMsg.map((message) => {
    const isSentFromUser = message.from.uid === user.uid;
    const msgTime = formatTime(message.timestamp);
    const msgDate = formatDate(message.timestamp);
    const isMsgFromOtherPublicChatMembers =
      chat.type === "public" && message.from.uid !== user.uid;

    return (
      <React.Fragment key={message.msgId}>
        {msgDates.has(msgDate) ? null : renderMsgDate(msgDate)}
        <Box
          id={message.msgId}
          sx={{
            display: isMsgFromOtherPublicChatMembers ? "flex" : "block",
            gap: isMsgFromOtherPublicChatMembers ? "0.5rem" : "block",
            alignSelf: isSentFromUser ? "flex-end" : "flex-start",
            width: "fit-content",
            maxWidth: "45%",
          }}
        >
          {isMsgFromOtherPublicChatMembers && (
            <Avatar
              src={message.from.photoURL}
              sx={{ width: 28, height: 28, alignSelf: "flex-end" }}
            />
          )}
          <Box
            onClick={handleMsgClick}
            onContextMenu={handleMsgClick}
            sx={{
              padding: "0.5rem 0.5rem 0.25rem",
              mb: "0.75rem",
              bgcolor: isSentFromUser ? "primary.light" : "background.default",
              borderRadius: isSentFromUser
                ? "1.125rem 1.125rem 0 1.125rem"
                : "1.125rem 1.125rem 1.125rem 0",
              boxSizing: "border-box",
              boxShadow: 2,
            }}
          >
            {isMsgFromOtherPublicChatMembers && (
              <Typography
                variant="body2"
                sx={{
                  fontWeight: "bold",
                  mb: "0.25rem",
                  ml: "0.25rem",
                }}
              >
                {message.from.displayName}
              </Typography>
            )}
            {message.msgReply &&
              chatMsg.find((msg) => msg.msgId === message.msgReply.msgId) && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    px: "0.5rem",
                    mb: "0.5rem",
                    ml: "0.25rem",
                    borderLeft: "4px solid",
                    borderColor: "primary.main",
                    borderTopLeftRadius: "0.25rem",
                    borderBottomLeftRadius: "0.25rem",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    scrollToMsg(message);
                  }}
                >
                  {message.msgReply.fileMsg && (
                    <InsertDriveFileIcon fontSize="medium" />
                  )}
                  <div>
                    <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                      {message.msgReply.from.displayName}
                    </Typography>
                    <Typography variant="body2">
                      {message.msgReply.msg
                        ? message.msgReply.msg
                        : message.msgReply.caption
                        ? message.msgReply.caption
                        : formatFilename(message.msgReply.fileMsg.fileName)}
                    </Typography>
                  </div>
                </Box>
              )}
            {message.msg ? (
              <Typography variant="body2" sx={{ ml: "0.25rem" }}>
                {message.msg}
              </Typography>
            ) : (
              <>
                {message.fileMsg.fileType.includes("image") ? (
                  message.fileMsg.progress != 100 ? (
                    <Box
                      sx={{
                        display: "grid",
                        placeItems: "center",
                        m: "0 auto 0.5rem",
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
                        marginBottom:
                          message.caption !== "" ? "0.5rem" : "0rem",
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
                      alignItems: "center",
                      pr: "0.5rem",
                      gap: "0.5rem",
                      mb: message.caption !== "" ? "0.5rem" : "0rem",
                    }}
                  >
                    <Box
                      sx={{
                        display: "grid",
                        placeItems: "center",
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
                            sx={{
                              gridColumn: 1,
                              gridRow: 1,
                              "&.MuiButtonBase-root:hover": {
                                bgcolor: "transparent",
                              },
                            }}
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
                            p: 0,
                            size: "medium",
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
                            fontSize="medium"
                            sx={{ color: "text.primary" }}
                          />
                        </IconButton>
                      ) : (
                        <InsertDriveFileIcon fontSize="medium" />
                      )}
                    </Box>
                    <div>
                      <Typography variant="body2" fontWeight="bold">
                        {formatFilename(message.fileMsg.fileName)}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          display: "inline-block",
                          color: "text.secondary",
                          mr: "0.75rem",
                        }}
                      >
                        {message.fileMsg.fileSize}
                      </Typography>
                      {message.fileMsg.progress != 100 && (
                        <Typography
                          variant="body2"
                          sx={{
                            display: "inline-block",
                            color: "text.secondary",
                          }}
                        >
                          {`${message.fileMsg.progress.toFixed(0)}% done`}
                        </Typography>
                      )}
                    </div>
                  </Box>
                )}
                <Typography variant="body2" sx={{ ml: "0.25rem" }}>
                  {message.caption}
                </Typography>
              </>
            )}
            <Box sx={{ textAlign: "right", pr: "0.25rem", ml: "1rem" }}>
              <Typography
                variant="body2"
                sx={{
                  fontSize: 10,
                  color: "text.secondary",
                }}
              >
                {msgTime}
              </Typography>
            </Box>
          </Box>
        </Box>
      </React.Fragment>
    );
  });

  return (
    <Box
      ref={scroll}
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        flex: "1 1 auto",
        p: "6rem 4rem",
        overflowY: "auto",
        background: `linear-gradient(0deg, rgba(255, 255, 255, 0.93), rgba(255, 255, 255, 0.93)), fixed url(${imgURL})`,
        backgroundPosition: "center",
        backgroundSize: "contain",
        boxShadow: "inset 0 0 0 2000px rgba(211, 211, 211, 0.15)",
        "&::-webkit-scrollbar": {
          width: "0.2em",
        },
        "&::-webkit-scrollbar-track": {
          boxShadow: "inset 0 0 6px rgba(0,0,0,0.00)",
          webkitBoxShadow: "inset 0 0 6px rgba(0,0,0,0.00)",
        },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: "rgba(0,0,0,.1)",
          outline: "1px solid slategrey",
        },
      }}
      onScroll={updateScrollTop}
    >
      {msgList.length > 0 ? msgList : null}
      <span></span>
      <IconButton
        sx={{
          fontSize: "2.5rem",
          color: "text.secondary",
          position: "fixed",
          bottom: "6rem",
          right: "0.75rem",
          padding: "0",
          bgcolor: "white",
          border: "none",
          borderRadius: "50%",
          boxShadow:
            "rgba(0, 0, 0, 0.12) 0px 1px 3px, rgba(0, 0, 0, 0.24) 0px 1px 2px",
          zIndex: 100,
          transform: isScrollToBottomBtnActive
            ? "translateY(0)"
            : "translateY(100px)",
          opacity: isScrollToBottomBtnActive ? 1 : 0,
          transition: "all 0.5s ease",
        }}
        onClick={scrollToBottom}
      >
        <KeyboardArrowDownIcon
          sx={{
            fontSize: "2.5rem",
          }}
        />
      </IconButton>
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
          excUsers={chat.type === "private" ? chat.members : [user]}
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
  );
}

export default ChatMsgDisp;

ChatMsgDisp.propTypes = {
  chat: PropTypes.object,
  uploadTask: PropTypes.object,
  setMsgReply: PropTypes.func,
  scroll: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  ]),
  setSelectedChatId: PropTypes.func,
};
