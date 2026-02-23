import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { v4 as uuid } from "uuid";

const formatCallDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

export const sendOneToOneCallHistoryMsg = async ({
  db,
  chatId,
  initiatorInfo,
  statusByUid,
  durationSeconds,
  isVideoCall,
  senderUid,
}) => {
  if (!db || !chatId || !initiatorInfo || !statusByUid) {
    throw new Error("[callHistory] Missing required args");
  }

  const chatRef = doc(db, "chats", chatId);
  const chatSnap = await getDoc(chatRef);
  if (!chatSnap.exists()) {
    throw new Error("[callHistory] Chat document not found");
  }

  const chatData = chatSnap.data();
  const unreadCounts = { ...(chatData.unreadCounts || {}) };
  const msgId = uuid();
  const timestamp = serverTimestamp();

  const newMsg = {
    msgId,
    type: "call",
    callData: {
      status: statusByUid,
      duration: formatCallDuration(durationSeconds),
      isVideoCall: !!isVideoCall,
      chat: {
        chatId: chatData.chatId || chatId,
        members: chatData.members || [],
      },
    },
    from: initiatorInfo,
    msgReply: null,
    isMsgDelivered: true,
    isMsgRead: false,
    timestamp,
  };

  await setDoc(doc(chatRef, "chatMessages", msgId), newMsg);

  for (const uid in unreadCounts) {
    if (uid !== senderUid) {
      unreadCounts[uid] = (unreadCounts[uid] || 0) + 1;
    }
  }

  await updateDoc(chatRef, {
    recentMsg: newMsg,
    timestamp,
    unreadCounts,
  });
};
