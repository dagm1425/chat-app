/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  Avatar,
  Box,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import { v4 as uuid } from "uuid";
import UsersSearchBar from "./UsersSearchBar";
import { selectChats } from "./chatsSlice";

function ForwardMsgDialogContent({ chatId, msg, onClose }) {
  const user = useSelector(selectUser);
  const chats = useSelector(selectChats);
  const chat = chats.find((chat) => chat.chatId === chatId);
  const [users, setUsers] = useState([]);
  const [searchValue, setSearchValue] = useState("");
  const otherPrivateChatMember = chat.members.filter(
    (member) => member.uid !== user.uid
  )[0];

  useEffect(() => {
    const unsub = subscribeUsers();

    return () => {
      unsub();
    };
  }, []);

  const subscribeUsers = () => {
    return onSnapshot(collection(db, "users"), (snapshot) => {
      const users = [];
      snapshot.forEach((doc) => {
        users.push(doc.data());
      });
      setUsers(users);
    });
  };

  const usersExcUserAndOtherPrivateChatMember = (users) => {
    return users.filter(
      (otherUser) =>
        otherUser.uid !== user.uid &&
        otherUser.uid !== otherPrivateChatMember.uid
    );
  };

  const filteredUsers = (users) => {
    if (searchValue === "") return usersExcUserAndOtherPrivateChatMember(users);

    const re = new RegExp(searchValue, "gi");

    return usersExcUserAndOtherPrivateChatMember(users).filter((user) => {
      return user.displayName.match(re);
    });
  };

  const handleForwardMsg = async (recipientUser, msg) => {
    onClose();

    const chatWithSelectedUser = chats.filter((chat) => {
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
      const chatRef = doc(db, "chats", `${chatId}`);
      const message = {
        ...msg,
        from: user,
        msgId: msgId,
        msgReply: null,
        timestamp: serverTimestamp(),
      };

      await setDoc(msgRef, message);

      await updateDoc(chatRef, {
        recentMsg: message,
      });
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
      let chatRef;
      let msgRef;

      await setDoc(doc(db, "chats", `${chatId}`), {
        chatId: `${chatId}`,
        displayName: recipientUser.displayName,
        photoURL: recipientUser.photoURL,
        type: "private",
        createdBy: user,
        recentMsg: {},
        members: [user, recipientUser],
      });

      msgRef = doc(db, "chats", `${chatId}`, "chatMessages", `${msgId}`);
      chatRef = doc(db, "chats", `${chatId}`);

      await setDoc(msgRef, message);

      await updateDoc(chatRef, {
        recentMsg: message,
      });
    }
  };

  const usersList = filteredUsers(users).map((user) => {
    return (
      <ListItem key={user.uid} disableGutters>
        <ListItemButton autoFocus onClick={() => handleForwardMsg(user, msg)}>
          <ListItemAvatar>
            <Avatar src={user.photoURL} />
          </ListItemAvatar>
          <ListItemText primary={user.displayName} />
        </ListItemButton>
      </ListItem>
    );
  });

  return (
    <Box sx={{ textAlign: "center" }}>
      <UsersSearchBar value={searchValue} setSearchValue={setSearchValue} />
      <List>{usersList}</List>
    </Box>
  );
}

export default ForwardMsgDialogContent;
