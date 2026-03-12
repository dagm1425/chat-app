import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { v4 as uuid } from "uuid";
import { formatDurationMinutes } from "../../common/utils";

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
  const wasOngoingCall =
    typeof chatData?.call?.callData?.startTime?.toDate === "function";
  const shouldIncrementUnread =
    !wasOngoingCall && senderUid === initiatorInfo?.uid;
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
    timestamp,
  };

  await setDoc(doc(chatRef, "chatMessages", msgId), newMsg);

  if (shouldIncrementUnread) {
    for (const uid in unreadCounts) {
      if (uid !== senderUid) {
        unreadCounts[uid] = (unreadCounts[uid] || 0) + 1;
      }
    }
  }

  await updateDoc(chatRef, {
    recentMsg: newMsg,
    timestamp,
    unreadCounts,
  });
};

export const sendGroupCallSystemMsg = async ({
  chatRef,
  chatData,
  callData,
  senderUid,
}) => {
  if (!callData?.isGroupCall) return;

  const hasCallStartTime = typeof callData.startTime?.toDate === "function";
  const startTime = hasCallStartTime ? callData.startTime.toDate() : null;
  const durationSeconds = startTime
    ? Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 1000))
    : 0;
  const durationLabel = formatDurationMinutes(durationSeconds);
  const isVideoCall = !!callData.isVideoCall;

  const msgId = uuid();
  const msgRef = doc(chatRef, "chatMessages", msgId);
  const newMsg = {
    msgId,
    type: "call-system",
    from: callData.participantDetails?.[callData.initiator],
    msgReply: null,
    isMsgDelivered: true,
    timestamp: serverTimestamp(),
    callData: {
      kind: "group-start",
      isVideoCall,
      durationSeconds,
      durationLabel,
      initiatorUid: callData.initiator,
    },
  };
  const unreadCounts = { ...(chatData.unreadCounts || {}) };
  const msgSenderUid = newMsg.from?.uid;
  const shouldIncrementUnread =
    !hasCallStartTime && senderUid === callData.initiator;
  if (shouldIncrementUnread) {
    for (const uid in unreadCounts) {
      if (uid !== msgSenderUid) {
        unreadCounts[uid] = (unreadCounts[uid] || 0) + 1;
      }
    }
  }

  await setDoc(msgRef, newMsg);
  await updateDoc(chatRef, {
    recentMsg: newMsg,
    timestamp: newMsg.timestamp,
    unreadCounts,
  });
};
