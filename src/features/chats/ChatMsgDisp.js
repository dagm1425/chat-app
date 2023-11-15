import React, { useEffect, useLayoutEffect, useState } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
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
  writeBatch,
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
  IconButton,
  Modal,
  CircularProgress,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import DeleteMsgDialogContent from "./DeleteMsgDialogContent";
import ReplyIcon from "@mui/icons-material/Reply";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import ChatMsgImgDisp from "./ChatMsgImgDisp";
import { selectChatMsgs, selectChats, setChatMsgs } from "./chatsSlice";
import { v4 as uuid } from "uuid";
import ChatMsg from "./ChatMsg";
import UsersSearch from "./UsersSearch";
import { formatDate } from "../../common/utils";

function ChatMsgDisp({ chat, uploadTask, setMsgReply, userStatuses, scroll }) {
  const user = useSelector(selectUser);
  const chats = useSelector(selectChats);
  const chatId = chat.chatId;
  const dispatch = useDispatch();
  const chatMsg = useSelector((state) => selectChatMsgs(state, chatId)) || [];
  const [isChatsLoading, setIsChatsLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [isDeleteMsgOpen, setIsDeleteMsgOpen] = useState(false);
  const [isForwardMsgOpen, setIsForwardMsgOpen] = useState(false);
  const [isImgModalOpen, setIsImgModalOpen] = useState(false);
  const [imgData, setImgData] = useState(null);
  const [msgId, setMsgId] = useState("");
  const [fileMsgId, setFileMsgId] = useState("");
  const [isScrollToBottomBtnActive, setIsScrollToBottomBtnActive] =
    useState(false);
  const msgDates = new Set();
  const imgURL =
    "https://blog.1a23.com/wp-content/uploads/sites/2/2020/02/pattern-9.svg";

  const showScrollToBottomBtn = () => {
    setIsScrollToBottomBtnActive(true);
  };

  const hideScrollToBottomBtn = () => {
    setIsScrollToBottomBtnActive(false);
  };

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

  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  const debouncedCallback = debounce(callback, 1000);

  useEffect(() => {
    const unsub = subscribeChatMsg();

    return () => {
      unsub();
    };
  }, [chatId]);

  useEffect(() => {
    updateUnreadMsg();
  }, [chatMsg]);

  useLayoutEffect(() => {
    const list = scroll.current.children;
    const target = list.item(list.length - 2);
    const observer = new IntersectionObserver(debouncedCallback, {
      passive: true,
    });

    if (!target) return;
    observer.observe(target);

    return () => observer.disconnect();
  }, [chatId]);

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
      const msgsWithDateObject = sortedMessages.map((msg) => {
        const timestamp = msg.timestamp?.toDate().toISOString();
        return { ...msg, timestamp };
      });
      const newMessages = msgsWithDateObject.filter(
        (msg) => !chatMsg.find((existingMsg) => existingMsg.id === msg.id)
      );
      setIsChatsLoading(false);
      if (newMessages.length) {
        dispatch(setChatMsgs({ chatId, chatMsg: msgsWithDateObject }));
      }
    });
  };

  const updateUnreadMsg = async () => {
    const querySnapshot = await getDocs(
      collection(db, "chats", `${chatId}`, "chatMessages")
    );
    const batch = writeBatch(db);

    querySnapshot.forEach((doc) => {
      const msgData = doc.data();
      const isUserMessage = msgData.from.uid === user.uid;
      const isMsgRead = msgData.isMsgRead;

      if (chat.type === "private") {
        if (!isUserMessage && !isMsgRead) {
          batch.update(doc.ref, { isMsgRead: true });
        }
      } else {
        if (!isUserMessage && !isMsgRead.includes(user.uid)) {
          batch.update(doc.ref, { isMsgRead: arrayUnion(user.uid) });
        }
      }
    });

    await batch.commit();
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
          p: "0.375rem 0.625rem",
          m: { xs: "0.75rem", sm: "1rem" },
          bgcolor: (theme) =>
            theme.palette.mode === "light"
              ? theme.palette.grey[200]
              : theme.palette.grey[800],
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

  const deleteMsg = async () => {
    handleDeleteMsgClose();

    const chatRef = doc(db, "chats", `${chatId}`);
    const messageRef = doc(chatRef, "chatMessages", `${msgId}`);
    const isMsgRecent = chat.recentMsg && chat.recentMsg.msgId === msgId;
    const msg = chatMsg.find((msg) => msg.msgId === msgId);
    const unreadCounts = { ...chat.unreadCounts };
    const readBy = msg.isMsgRead;
    const isUserMsg = msg.from.uid === user.uid;

    await deleteDoc(messageRef);

    if (isMsgRecent) {
      const secondLastMsg = { ...chatMsg[chatMsg.length - 2] };
      const timestamp = Timestamp.fromDate(new Date(secondLastMsg.timestamp));

      delete secondLastMsg.msgReply;
      await updateDoc(chatRef, { recentMsg: { ...secondLastMsg, timestamp } });
      await updateDoc(chatRef, { timestamp });
    }

    for (const uid in unreadCounts) {
      if (
        ((isUserMsg && uid !== user.uid) ||
          (!isUserMsg && uid !== msg.from.uid)) &&
        (typeof readBy === "boolean" ? !msg.isMsgRead : !readBy.includes(uid))
      ) {
        unreadCounts[uid]--;
      }
    }

    await updateDoc(chatRef, { unreadCounts });
  };

  const findPrivateChat = (privateChats, recipientUser) => {
    return privateChats.filter((chat) => {
      return (
        chat.members.filter(
          (member) =>
            member.uid === user.uid || member.uid === recipientUser.uid
        ).length == 2
      );
    });
  };

  const createNewMessage = (msg, msgId) => {
    return {
      ...msg,
      from: user,
      msgId,
      msgReply: null,
      timestamp: serverTimestamp(),
    };
  };

  const handleForwardMsg = async (recipientUser) => {
    handleMsgForwardClose();

    const msg = chatMsg.find((msg) => msg.msgId === msgId);
    const privateChats = chats.filter((chat) => chat.type === "private");
    const chatWithSelectedUser = findPrivateChat(privateChats, recipientUser);

    if (chatWithSelectedUser.length) {
      const chatId = chatWithSelectedUser[0].chatId;
      const unreadCounts = { ...chatWithSelectedUser[0].unreadCounts };
      const msgId = uuid();
      const msgRef = doc(db, "chats", `${chatId}`, "chatMessages", `${msgId}`);
      const chatRef = doc(db, "chats", `${chatId}`);
      const newMsg = createNewMessage(msg, msgId);

      for (const uid in unreadCounts) {
        if (uid !== user.uid) {
          unreadCounts[uid]++;
        }
      }

      await setDoc(msgRef, newMsg);
      delete newMsg.msgReply;
      await updateDoc(chatRef, {
        recentMsg: newMsg,
        timestamp: newMsg.timestamp,
        unreadCounts,
      });
    } else {
      const chatId = uuid();
      const chatRef = doc(db, "chats", `${chatId}`);
      let msgRef;
      const msgId = uuid();
      const newMsg = createNewMessage(msg, msgId);
      const newChat = {
        chatId,
        type: "private",
        createdBy: user,
        members: [user, recipientUser],
        timestamp: serverTimestamp(),
        recentMsg: null,
        drafts: [],
        unreadCounts: { [user.uid]: 0, [recipientUser.uid]: 1 },
      };

      await setDoc(chatRef, newChat);

      msgRef = doc(db, "chats", `${chatId}`, "chatMessages", `${msgId}`);

      await setDoc(msgRef, newMsg);
      delete newMsg.msgReply;
      await updateDoc(chatRef, {
        timestamp: newMsg.timestamp,
        recentMsg: newMsg,
      });
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

  const renderReadSign = (message) => {
    if (
      (chat.type === "private" &&
        message.from.uid === user.uid &&
        message.isMsgRead) ||
      (chat.type === "public" &&
        message.from.uid === user.uid &&
        message.isMsgRead.length)
    ) {
      return <DoneAllIcon sx={{ fontSize: "0.875rem", opacity: 0.9 }} />;
    } else return "";
  };

  const msgList = chatMsg.map((message) => {
    const msgDate = formatDate(message.timestamp);

    return (
      <React.Fragment key={message.msgId}>
        {msgDates.has(msgDate) ? null : renderMsgDate(msgDate)}
        <ChatMsg
          message={message}
          user={user}
          chat={chat}
          chatMsg={chatMsg}
          fileMsgId={fileMsgId}
          setFileMsgId={setFileMsgId}
          renderReadSign={renderReadSign}
          handleMsgClick={handleMsgClick}
          openImgModal={openImgModal}
          cancelUpload={cancelUpload}
          downloadFile={downloadFile}
          scroll={scroll}
          scrollToMsg={scrollToMsg}
        />
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
        p: { xs: "4.5rem 0.75rem", sm: "6rem 4rem" },
        overflowY: "auto",
        background: (theme) =>
          theme.palette.mode === "light"
            ? `linear-gradient(0deg, rgba(255, 255, 255, 0.93), rgba(255, 255, 255, 0.93)), fixed url(${imgURL})`
            : `linear-gradient(0deg, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), fixed url(${imgURL})`,
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
    >
      {isChatsLoading ? (
        <Box sx={{ height: "100vh", display: "grid", placeItems: "center" }}>
          <CircularProgress />
        </Box>
      ) : msgList.length > 0 ? (
        msgList
      ) : null}
      <span></span>
      <IconButton
        sx={{
          fontSize: "2.5rem",
          color: "text.secondary",
          position: "fixed",
          bottom: "6rem",
          right: "0.75rem",
          padding: "0",
          bgcolor: "background.default",
          border: "none",
          borderRadius: "50%",
          boxShadow: 2,
          zIndex: 100,
          // transform: isScrollToBottomBtnActive
          //   ? "translateY(0)"
          //   : "translateY(100px)",
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
        <DialogTitle sx={{ fontWeight: "normal" }}>Delete message?</DialogTitle>
        <DeleteMsgDialogContent
          deleteMsg={deleteMsg}
          onClose={handleDeleteMsgClose}
        />
      </Dialog>
      <Dialog open={isForwardMsgOpen} onClose={handleMsgForwardClose}>
        <DialogTitle sx={{ fontWeight: "normal" }}>Forward message</DialogTitle>
        <UsersSearch
          excUsers={chat.type === "private" ? chat.members : [user]}
          handleItemClick={handleForwardMsg}
          onClose={handleMsgForwardClose}
          userStatuses={userStatuses}
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
  userStatuses: PropTypes.objectOf(PropTypes.string),
  scroll: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  ]),
  setSelectedChatId: PropTypes.func,
};
