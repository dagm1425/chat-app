import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PropTypes from "prop-types";
import Box from "@mui/material/Box";
import { useLocation, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectChatById, selectChats } from "./chatsSlice";
import ChatHeader from "./ChatHeader";
import ChatMsgDisp from "./ChatMsgDisp";
import ChatMsgInput from "./ChatMsgInput";
import { useMediaQuery } from "@mui/material";

const MAX_OPEN_CHATS_MOBILE = 8;
const MAX_OPEN_CHATS_DESKTOP = 25;

function ChatsSection({ setSelectedChatId, userStatuses, makeCall }) {
  const { id } = useParams();
  const chat = useSelector((state) => selectChatById(state, id));
  const chats = useSelector(selectChats);
  const chatById = useMemo(
    () => new Map(chats.map((item) => [item.chatId, item])),
    [chats]
  );
  const [uploadTask, setUploadTask] = useState(null);
  const [msgReply, setMsgReply] = useState(null);
  const [openChatIds, setOpenChatIds] = useState(() => (id ? [id] : []));
  const scrollRefsByChatId = useRef(new Map());

  const location = useLocation();
  const isMobile = useMediaQuery("(max-width:600px)");
  const maxOpenChats = isMobile
    ? MAX_OPEN_CHATS_MOBILE
    : MAX_OPEN_CHATS_DESKTOP;

  const getScrollRef = useCallback((chatId) => {
    if (!chatId) return null;
    if (!scrollRefsByChatId.current.has(chatId)) {
      scrollRefsByChatId.current.set(chatId, React.createRef());
    }
    return scrollRefsByChatId.current.get(chatId);
  }, []);

  useEffect(() => {
    const validIds = new Set(chats.map((item) => item.chatId));

    setOpenChatIds((prev) => {
      const filtered = prev.filter((chatId) => validIds.has(chatId));
      if (!id || !validIds.has(id)) {
        return filtered.slice(0, maxOpenChats);
      }
      const next = [id, ...filtered.filter((chatId) => chatId !== id)];
      return next.slice(0, maxOpenChats);
    });

    for (const [chatId] of scrollRefsByChatId.current) {
      if (!validIds.has(chatId)) {
        scrollRefsByChatId.current.delete(chatId);
      }
    }
  }, [chats, id, maxOpenChats]);

  useEffect(() => {
    setMsgReply(null);
  }, [id]);

  const activeScrollRef = getScrollRef(id);
  const warmChatIds = useMemo(() => {
    const warmed = openChatIds.filter((chatId) => chatById.has(chatId));

    // Include the active chat immediately on first visit so the message pane
    // does not disappear for one render while LRU state catches up.
    if (id && chatById.has(id) && !warmed.includes(id)) {
      return [id, ...warmed].slice(0, maxOpenChats);
    }

    return warmed;
  }, [chatById, id, maxOpenChats, openChatIds]);

  return !isMobile || (isMobile && location.pathname !== "/") ? (
    <Box
      sx={{
        ml: { xs: "0", sm: "30%", lg: "23%" },
        width: { xs: "100%", sm: "70%", lg: "77%" },
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: 0,
        height: "100%",
      }}
    >
      {chat && (
        <ChatHeader
          chat={chat}
          userStatuses={userStatuses}
          makeCall={makeCall}
        />
      )}

      {warmChatIds.map((chatId) => {
        const warmChat = chatById.get(chatId);
        if (!warmChat) return null;
        const scrollRef = getScrollRef(chatId);
        const isActive = chatId === id;

        return (
          <Box
            key={chatId}
            sx={{
              display: isActive ? "flex" : "none",
              flexDirection: "column",
              flex: "1 1 auto",
              minHeight: 0,
            }}
          >
            <ChatMsgDisp
              chat={warmChat}
              uploadTask={uploadTask}
              msgReply={msgReply}
              setMsgReply={setMsgReply}
              scroll={scrollRef}
              setSelectedChatId={setSelectedChatId}
              userStatuses={userStatuses}
              makeCall={makeCall}
              isActive={isActive}
            />
          </Box>
        );
      })}

      {chat && activeScrollRef && (
        <ChatMsgInput
          chat={chat}
          setUploadTask={setUploadTask}
          msgReply={msgReply}
          setMsgReply={setMsgReply}
          scroll={activeScrollRef}
        />
      )}
    </Box>
  ) : null;
}

export default ChatsSection;

ChatsSection.propTypes = {
  setSelectedChatId: PropTypes.func,
  userStatuses: PropTypes.objectOf(PropTypes.string),
  makeCall: PropTypes.func,
};
