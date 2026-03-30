import React from "react";
import PropTypes from "prop-types";
import {
  Avatar,
  Box,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { useSelector } from "react-redux";
import LocalPhoneIcon from "@mui/icons-material/LocalPhone";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import CallMadeIcon from "@mui/icons-material/CallMade";
import CallReceivedIcon from "@mui/icons-material/CallReceived";
import { selectChats } from "./chatsSlice";
import { selectUser } from "../user/userSlice";
import { format } from "date-fns";

const CALL_HISTORY_GROUP_WINDOW_MS = 10 * 60 * 1000;

const getTimestampMs = (value) => {
  if (!value) return 0;

  if (typeof value === "string" || value instanceof Date) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  if (typeof value?.toDate === "function") {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime())
      ? parsed.getTime()
      : 0;
  }

  const seconds = Number.isFinite(value?.seconds) ? value.seconds : null;
  const nanoseconds = Number.isFinite(value?.nanoseconds)
    ? value.nanoseconds
    : 0;
  if (Number.isFinite(seconds)) {
    return seconds * 1000 + Math.floor(nanoseconds / 1000000);
  }

  return 0;
};

const getTimestampLabel = (timestampMs) => {
  if (!timestampMs) return "Unknown time";
  return format(new Date(timestampMs), "MMMM d 'at' h:mm a");
};

const getRowTitle = (chat, user) => {
  if (!chat) return "Unknown chat";
  if (chat.type === "private") {
    const otherMember = chat.members?.find((member) => member.uid !== user.uid);
    return otherMember?.displayName || "Unknown user";
  }
  return chat.displayName || "Group chat";
};

const getRowAvatar = (chat, user) => {
  if (!chat) {
    return {
      src: "",
      label: "?",
      bgColor: "grey.500",
    };
  }

  if (chat.type === "private") {
    const otherMember = chat.members?.find((member) => member.uid !== user.uid);
    return {
      src: otherMember?.photoURL || "",
      label: (otherMember?.displayName || "U").charAt(0).toUpperCase(),
      bgColor: "primary.main",
    };
  }

  return {
    src: "",
    label: (chat.displayName || "G").charAt(0).toUpperCase(),
    bgColor: chat.avatarBgColor || "primary.main",
  };
};

const getDirectionMeta = (entry, user) => {
  const fromUid = entry.fromUid || entry.from?.uid || entry.initiatorUid;
  const isOutgoing = fromUid === user.uid;
  const isMissedCall = entry.statusByUid?.[user.uid] === "Missed call";

  return {
    isOutgoing,
    isMissedCall,
  };
};

function CallsHistoryDialogContent({ onClose, startCall }) {
  const chats = useSelector(selectChats);
  const user = useSelector(selectUser);

  const chatsById = React.useMemo(() => {
    return chats.reduce((acc, chat) => {
      acc[chat.chatId] = chat;
      return acc;
    }, {});
  }, [chats]);

  const groupedCallHistoryRows = React.useMemo(() => {
    const rows = [];

    chats.forEach((chat) => {
      const history = Array.isArray(chat.callHistory) ? chat.callHistory : [];
      history.forEach((entry) => {
        rows.push({
          ...entry,
          chatId: entry.chatId || chat.chatId,
          timestampMs: getTimestampMs(entry.timestamp),
        });
      });
    });

    rows.sort((a, b) => b.timestampMs - a.timestampMs);
    const groupedRows = [];

    rows.forEach((entry) => {
      const entryDirectionMeta = getDirectionMeta(entry, user);
      const lastGroup = groupedRows[groupedRows.length - 1];

      if (!lastGroup) {
        groupedRows.push({
          ...entry,
          groupedCount: 1,
        });
        return;
      }

      const lastDirectionMeta = getDirectionMeta(lastGroup, user);
      const isSameDirection =
        entryDirectionMeta.isOutgoing === lastDirectionMeta.isOutgoing;
      const isSameMissedState =
        entryDirectionMeta.isMissedCall === lastDirectionMeta.isMissedCall;
      const isSameChat = entry.chatId === lastGroup.chatId;
      const isSameCallType = entry.isVideoCall === lastGroup.isVideoCall;
      const isInsideWindow =
        lastGroup.timestampMs - entry.timestampMs <=
        CALL_HISTORY_GROUP_WINDOW_MS;

      if (
        isSameChat &&
        isSameCallType &&
        isSameDirection &&
        isSameMissedState &&
        isInsideWindow
      ) {
        lastGroup.groupedCount += 1;
        return;
      }

      groupedRows.push({
        ...entry,
        groupedCount: 1,
      });
    });

    return groupedRows;
  }, [chats, user]);

  const handleHistoryItemClick = (entry) => {
    const chat = chatsById[entry.chatId];
    if (!chat) {
      console.warn(
        `[CallsHistory] Missing chat for history item. chatId=${entry.chatId}`
      );
      return;
    }
    startCall(chat, !entry.isVideoCall);
    onClose();
  };

  return (
    <Box sx={{ width: { xs: "90vw", sm: 342 }, maxWidth: 342, pb: "0.5rem" }}>
      <List
        sx={{
          maxHeight: 460,
          overflowY: "auto",
          px: "0.25rem",
          pt: 0,
          pb: 0,
        }}
      >
        {groupedCallHistoryRows.length ? (
          groupedCallHistoryRows.map((entry) => {
            const chat = chatsById[entry.chatId];
            const avatar = getRowAvatar(chat, user);
            const title = getRowTitle(chat, user);
            const directionMeta = getDirectionMeta(entry, user);
            const subtitle = getTimestampLabel(entry.timestampMs);

            return (
              <ListItem key={`${entry.chatId}-${entry.entryId}`} disablePadding>
                <ListItemButton
                  onClick={() => handleHistoryItemClick(entry)}
                  sx={{
                    px: "0.75rem",
                    py: "0.45rem",
                    gap: "0.5rem",
                    borderRadius: 1,
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: 42 }}>
                    <Avatar
                      src={avatar.src}
                      sx={{ bgcolor: avatar.bgColor, width: 38, height: 38 }}
                    >
                      {!avatar.src ? avatar.label : null}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    disableTypography
                    sx={{ my: 0 }}
                    primary={
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 500,
                          lineHeight: 1.1,
                          fontSize: "0.97rem",
                        }}
                      >
                        {title}
                      </Typography>
                    }
                    secondary={
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.15rem",
                          mt: "0.2rem",
                          color: "text.secondary",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {directionMeta.isOutgoing ? (
                          <CallMadeIcon
                            sx={{
                              fontSize: "0.95rem",
                              color: directionMeta.isMissedCall
                                ? "error.main"
                                : "primary.main",
                            }}
                          />
                        ) : (
                          <CallReceivedIcon
                            sx={{
                              fontSize: "0.95rem",
                              color: directionMeta.isMissedCall
                                ? "error.main"
                                : "primary.main",
                            }}
                          />
                        )}
                        <Typography
                          variant="caption"
                          sx={{
                            color: "inherit",
                            fontSize: "0.85rem",
                            lineHeight: 1.2,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {entry.groupedCount > 1
                            ? `(${entry.groupedCount}) `
                            : ""}
                          {subtitle}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemIcon
                    sx={{
                      minWidth: 24,
                      justifyContent: "flex-end",
                      ml: "0.25rem",
                    }}
                  >
                    {entry.isVideoCall ? (
                      <VideoCallIcon
                        color="action"
                        sx={{ fontSize: "1.75rem" }}
                      />
                    ) : (
                      <LocalPhoneIcon
                        color="action"
                        sx={{ fontSize: "1.75rem" }}
                      />
                    )}
                  </ListItemIcon>
                </ListItemButton>
              </ListItem>
            );
          })
        ) : (
          <Box
            sx={{
              minHeight: 200,
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              px: "1rem",
            }}
          >
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              No call history yet.
            </Typography>
          </Box>
        )}
      </List>
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          mt: "0.65rem",
          px: "1rem",
          pb: "0.25rem",
        }}
      >
        <Button onClick={onClose}>Close</Button>
      </Box>
    </Box>
  );
}

export default CallsHistoryDialogContent;

CallsHistoryDialogContent.propTypes = {
  onClose: PropTypes.func.isRequired,
  startCall: PropTypes.func.isRequired,
};
