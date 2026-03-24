import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import { db } from "../../firebase";
import {
  deleteField,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { v4 as uuid } from "uuid";
import SendIcon from "@mui/icons-material/Send";
import CheckIcon from "@mui/icons-material/Check";
import {
  Box,
  Dialog,
  DialogTitle,
  IconButton,
  Popover,
  Typography,
  useMediaQuery,
  TextareaAutosize,
  useTheme,
} from "@mui/material";
import AttachmentIcon from "@mui/icons-material/Attachment";
import EmojiPicker from "emoji-picker-react";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import FileMsgDialogContent from "./FileMsgDialogContent";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import PhotoLibraryOutlinedIcon from "@mui/icons-material/PhotoLibraryOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import { notifyUser } from "../../common/toast/ToastProvider";
import { extractFirstUrl } from "../../common/utils";

const MAX_FILE_SIZE_BYTES = 5000000;
const MAX_VIDEO_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

function ChatMsgInput({
  chat,
  setUploadTask,
  msgReply,
  setMsgReply,
  msgEdit,
  setMsgEdit,
  scroll,
}) {
  const user = useSelector(selectUser);
  const chatId = chat.chatId;
  const userDraft = chat.drafts.find((draft) => draft.from.uid === user.uid);
  const [chatDrafts, setChatDrafts] = useState({
    chatId,
    userDraft,
    drafts: chat.drafts,
  });
  const [isEmojiPopoverOpen, setIsEmojiPopoverOpen] = useState(false);
  const [attachmentAnchorEl, setAttachmentAnchorEl] = useState(null);
  const emojiPickerContainerRef = useRef(null);
  const fileInput = useRef(null);
  const msgInputForm = useRef(null);
  const [fileMsg, setFileMsg] = useState(null);
  const [isFileMsgDialogOpen, setIsFileMsgDialogOpen] = useState(false);
  const inputRef = useRef(null);
  const editDraftBeforeStartRef = useRef(null);
  const prevMsgEditRef = useRef(null);
  const isMobile = useMediaQuery("(max-width: 600px)");
  const theme = useTheme();
  const isEditing = Boolean(msgEdit);

  useEffect(() => {
    const wasEditing = Boolean(prevMsgEditRef.current);
    if (wasEditing && inputRef.current) {
      inputRef.current.value = editDraftBeforeStartRef.current ?? "";
    }
    updateDraft();
    prevMsgEditRef.current = null;
    editDraftBeforeStartRef.current = null;
    setAttachmentAnchorEl(null);
    if (document.activeElement !== inputRef.current && !isMobile)
      inputRef.current.focus();
    setChatDrafts({
      chatId,
      userDraft,
      drafts: chat.drafts,
    });
  }, [chatId]);

  useEffect(() => {
    if (!inputRef.current || msgEdit) return;
    inputRef.current.value = chatDrafts.userDraft
      ? chatDrafts.userDraft.msg
      : "";
  }, [chatDrafts, msgEdit]);

  useEffect(() => {
    if (msgReply || msgEdit) inputRef.current?.focus();
  }, [msgReply, msgEdit]);

  useEffect(() => {
    if (!inputRef.current) return;

    const prevMsgEdit = prevMsgEditRef.current;
    const enteredEdit = !prevMsgEdit && msgEdit;
    const switchedEditTarget =
      prevMsgEdit &&
      msgEdit &&
      (prevMsgEdit.msgId !== msgEdit.msgId ||
        prevMsgEdit.fieldKey !== msgEdit.fieldKey);
    const exitedEdit = prevMsgEdit && !msgEdit;

    if (enteredEdit) {
      editDraftBeforeStartRef.current = inputRef.current.value;
      inputRef.current.value = msgEdit.initialValue || "";
      setAttachmentAnchorEl(null);
      inputRef.current.focus();
    } else if (switchedEditTarget) {
      inputRef.current.value = msgEdit.initialValue || "";
      inputRef.current.focus();
    } else if (exitedEdit) {
      if (editDraftBeforeStartRef.current !== null) {
        inputRef.current.value = editDraftBeforeStartRef.current;
      }
      editDraftBeforeStartRef.current = null;
    }

    prevMsgEditRef.current = msgEdit;
  }, [msgEdit]);

  useEffect(() => {
    if (!isEmojiPopoverOpen) return;
    const closeIfOutside = (event) => {
      if (
        emojiPickerContainerRef.current &&
        !emojiPickerContainerRef.current.contains(event.target)
      ) {
        setIsEmojiPopoverOpen(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsEmojiPopoverOpen(false);
    };

    document.addEventListener("mousedown", closeIfOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeIfOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isEmojiPopoverOpen]);

  const handleSendMsg = async (e) => {
    e.preventDefault();
    if (!inputRef.current) return;

    if (msgEdit) {
      const editSession = msgEdit;
      const nextValue = inputRef.current.value;
      const initialValue =
        typeof editSession.initialValue === "string"
          ? editSession.initialValue
          : "";

      if (editSession.fieldKey === "msg" && !nextValue.trim()) return;

      if (nextValue === initialValue) {
        setMsgEdit(null);
        return;
      }

      setMsgEdit(null);

      try {
        const messageRef = doc(
          db,
          "chats",
          `${chatId}`,
          "chatMessages",
          `${editSession.msgId}`
        );
        const chatRef = doc(db, "chats", `${chatId}`);
        const editedAt = serverTimestamp();
        const messageUpdate = {
          [editSession.fieldKey]: nextValue,
          isEdited: true,
          editedAt,
        };

        if (editSession.fieldKey === "msg") {
          const previousUrl = extractFirstUrl(initialValue);
          const nextUrl = extractFirstUrl(nextValue);

          if (!nextUrl) {
            if (previousUrl) {
              messageUpdate.linkPreviewStatus = deleteField();
              messageUpdate.linkPreviewFetchedAt = deleteField();
              messageUpdate.linkPreviewUrl = deleteField();
              messageUpdate.linkPreview = deleteField();
              messageUpdate.linkPreviewErrorCode = deleteField();
            }
          } else if (nextUrl !== previousUrl) {
            // Mark as pending so UI can show loading state until backend preview refresh completes.
            messageUpdate.linkPreviewStatus = "pending";
            messageUpdate.linkPreviewFetchedAt = deleteField();
            messageUpdate.linkPreviewUrl = nextUrl;
            messageUpdate.linkPreview = deleteField();
            messageUpdate.linkPreviewErrorCode = deleteField();
          }
        }

        await updateDoc(messageRef, messageUpdate);

        if (chat.recentMsg?.msgId === editSession.msgId) {
          await updateDoc(chatRef, {
            [`recentMsg.${editSession.fieldKey}`]: nextValue,
            "recentMsg.isEdited": true,
            "recentMsg.editedAt": editedAt,
          });
        }
      } catch (error) {
        console.error("[ChatMsgInput] Failed to edit message:", error);
        notifyUser("Failed to edit message. Please try again.", "error");
      }

      return;
    }

    if (!inputRef.current.value) return;

    const msg = inputRef.current.value;
    const msgId = uuid();
    const msgRef = doc(db, "chats", `${chatId}`, "chatMessages", `${msgId}`);
    const msgList = scroll.current.children;
    const i = isMobile ? msgList.length - 1 : msgList.length - 2;
    const lastMmsg = msgList.item(i);
    const chatRef = doc(db, "chats", `${chatId}`);
    let unreadCounts = { ...chat.unreadCounts };
    const newMsg = {
      msgId,
      type: "text",
      from: user,
      msg,
      msgReply,
      isMsgDelivered: true,
      timestamp: serverTimestamp(),
    };

    inputRef.current.value = "";
    if (msgReply) setMsgReply(null);
    lastMmsg.scrollIntoView({ behavior: "smooth" });

    await setDoc(msgRef, newMsg);
    delete newMsg.msgReply;
    await updateDoc(chatRef, { recentMsg: newMsg });
    await updateDoc(chatRef, { timestamp: newMsg.timestamp });

    for (const uid in unreadCounts) {
      if (uid !== user.uid) {
        unreadCounts[uid]++;
      }
    }

    await updateDoc(chatRef, { unreadCounts });
    resetDraft();
  };

  const openEmojiPicker = () => {
    setIsEmojiPopoverOpen((prev) => !prev);
  };

  const closeEmojiPicker = () => {
    setIsEmojiPopoverOpen(false);
  };

  const addEmoji = (emojiData) => {
    inputRef.current.value = inputRef.current.value.concat(emojiData.emoji);
    closeEmojiPicker();
  };

  const handleFileSelectClick = (e) => {
    if (msgEdit) return;
    setAttachmentAnchorEl(e.currentTarget);
  };

  const closeAttachmentPicker = () => {
    setAttachmentAnchorEl(null);
  };

  const triggerFilePicker = (accept) => {
    if (msgEdit) return;
    closeAttachmentPicker();
    if (!fileInput.current) return;
    fileInput.current.accept = accept;
    fileInput.current.multiple = false;
    fileInput.current.click();
  };

  const handleFileMsgDialogOpen = () => {
    setIsFileMsgDialogOpen(true);
  };

  const handleFileMsgDialogClose = () => {
    setIsFileMsgDialogOpen(false);
    fileInput.current.value = "";
  };

  const getReplyPreviewText = (replyMsg) => {
    if (replyMsg.msg) return replyMsg.msg;
    if (replyMsg.caption) return replyMsg.caption;
    if (replyMsg.type === "video") return "Video";
    return replyMsg.fileMsg.fileName;
  };

  const getEditPreviewText = () => {
    if (!msgEdit) return "";
    if (msgEdit.fieldKey === "msg") return msgEdit.initialValue || "Empty";
    return msgEdit.initialValue || "Empty caption";
  };

  const composerContextBarContainerSx = {
    width: "100%",
    bgcolor: "background.paper",
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: "0.75rem",
    px: "1.25rem",
    pt: "0.5rem",
    boxSizing: "border-box",
    borderRadius: "20px 20px 0 0",
  };
  const composerContextBarContentSx = {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "0.9em",
    px: "0.5rem",
    borderLeft: "4px solid",
    borderColor: "primary.main",
    borderTopLeftRadius: "0.25rem",
    borderBottomLeftRadius: "0.25rem",
    minWidth: 0,
  };
  const composerContextBarTitleSx = {
    fontSize: "inherit",
    fontWeight: "bold",
    lineHeight: "1.125rem",
  };
  const composerContextBarSubtitleSx = {
    fontSize: "inherit",
    lineHeight: "1.125rem",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
  const composerContextBarCloseSx = {
    marginLeft: "auto",
    "&.MuiButtonBase-root:hover": {
      bgcolor: "transparent",
    },
  };

  const renderComposerContextBar = ({
    title,
    subtitle,
    subtitleMaxWidth,
    icon,
    onClose,
  }) => (
    <Box sx={composerContextBarContainerSx}>
      <Box sx={composerContextBarContentSx}>
        {icon}
        <div>
          <Typography variant="body1" sx={composerContextBarTitleSx}>
            {title}
          </Typography>
          <Typography
            variant="body1"
            sx={{ ...composerContextBarSubtitleSx, maxWidth: subtitleMaxWidth }}
          >
            {subtitle}
          </Typography>
        </div>
      </Box>
      <IconButton
        disableRipple
        disableTouchRipple
        onClick={onClose}
        sx={composerContextBarCloseSx}
      >
        <CloseIcon sx={{ marginLeft: "auto" }} />
      </IconButton>
    </Box>
  );

  const getImageSize = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = function (e) {
        const img = new Image();
        img.src = e.target.result;

        img.onload = function () {
          const width = this.width;
          const height = this.height;
          resolve({ width, height });
        };
      };

      reader.readAsDataURL(file);
    });
  };

  const getVideoMetadata = (file) => {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const video = document.createElement("video");

      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const width = video.videoWidth;
        const height = video.videoHeight;
        const durationSec = Number.isFinite(video.duration)
          ? video.duration
          : 0;
        URL.revokeObjectURL(objectUrl);
        resolve({ width, height, durationSec });
      };
      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Unable to read video metadata"));
      };
      video.src = objectUrl;
    });
  };

  const handleFileSize = (file) => {
    const isVideo = file.type.startsWith("video/");
    if (isVideo && !ALLOWED_VIDEO_TYPES.has(file.type)) {
      notifyUser("Only MP4 and WebM videos are supported", "info");
      resetFileInput();
      throw new Error("Unsupported video format");
    }

    if (isVideo && file.size > MAX_VIDEO_SIZE_BYTES) {
      notifyUser("Video size should not exceed 8 MB", "info");
      resetFileInput();
      throw new Error("Video size exceeds the limit");
    }

    if (!isVideo && file.size > MAX_FILE_SIZE_BYTES) {
      notifyUser("File size should not exceed 5 MB", "info");
      resetFileInput();
      throw new Error("File size exceeds the limit");
    }
  };

  const resetFileInput = () => {
    fileInput.current.value = "";
  };

  const getFileData = async (file) => {
    if (file.type.includes("image")) {
      const dimensions = await getImageSize(file);
      return { file, imgSize: dimensions };
    } else if (ALLOWED_VIDEO_TYPES.has(file.type)) {
      const metadata = await getVideoMetadata(file);
      return { file, videoMeta: metadata };
    } else {
      return { file };
    }
  };

  const reviewFileMsg = async (e) => {
    try {
      e.preventDefault();

      const file = e.target.files[0];
      if (!file) return;

      handleFileSize(file);
      const fileData = await getFileData(file);

      setFileMsg(fileData);
      resetFileInput();
      handleFileMsgDialogOpen();
    } catch (error) {
      console.error("Error processing file:", error.message);
    }
  };

  const updateDraft = async () => {
    const inputValue = inputRef.current?.value || "";

    // Treat whitespace-only text as empty draft.
    if (!inputValue.trim()) {
      await resetDraft();
      return;
    }

    let draftsUpdate;

    if (!chatDrafts.userDraft) {
      draftsUpdate = [...chatDrafts.drafts, { from: user, msg: inputValue }];
    } else if (chatDrafts.userDraft.msg !== inputValue) {
      draftsUpdate = chatDrafts.drafts.map((draft) => {
        if (draft.from.uid === user.uid) {
          return { ...draft, msg: inputValue };
        } else return draft;
      });
    }

    if (!draftsUpdate) return;

    try {
      await updateDoc(doc(db, "chats", `${chatDrafts.chatId}`), {
        drafts: draftsUpdate,
      });
    } catch (error) {
      console.error("[ChatMsgInput] Failed to update draft:", error);
    }
  };

  const resetDraft = async () => {
    if (chatDrafts.userDraft) {
      const draftsUpdate = chatDrafts.drafts.filter(
        (draft) => draft.from.uid !== user.uid
      );
      try {
        await updateDoc(doc(db, "chats", `${chatDrafts.chatId}`), {
          drafts: draftsUpdate,
        });
      } catch (error) {
        console.error("[ChatMsgInput] Failed to reset draft:", error);
      }
      return;
    } else return;
  };

  return (
    <Box
      sx={{
        flex: "0 1 auto",
        position: { xs: "fixed", sm: "sticky" },
        width: { xs: "100%", sm: "initial" },
        bottom: "0",
        py: "0.75rem",
        bgcolor: "background.default",
        borderTop: "2px solid",
        borderColor: "background.paper",
      }}
    >
      <Box
        sx={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: { xs: "0.25rem", sm: "0.75rem" },
        }}
      >
        <Box
          ref={emojiPickerContainerRef}
          sx={{ position: "relative", display: "flex", alignItems: "center" }}
        >
          <IconButton
            disableRipple
            disableTouchRipple
            sx={{
              mr: { xs: "-0.625rem", sm: "-0.75rem" },
              "&.MuiButtonBase-root:hover": {
                bgcolor: "transparent",
              },
            }}
            onClick={openEmojiPicker}
          >
            <EmojiEmotionsIcon />
          </IconButton>

          <Box
            aria-hidden={!isEmojiPopoverOpen}
            sx={(theme) => ({
              position: "absolute",
              left: 0,
              bottom: "calc(100% + 8px)",
              width: { xs: "min(94vw, 360px)", sm: 360 },
              height: { xs: "min(56vh, 420px)", sm: 420 },
              maxHeight: "calc(100dvh - 120px)",
              zIndex: 1300,
              bgcolor: "background.paper",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              overflow: "hidden",
              boxShadow: theme.shadows[8],
              opacity: isEmojiPopoverOpen ? 1 : 0,
              pointerEvents: isEmojiPopoverOpen ? "auto" : "none",
              transformOrigin: "bottom right",
              transform: isEmojiPopoverOpen
                ? "translateY(0) scale(1)"
                : "translateY(8px) scale(0.985)",
              transition:
                "opacity 140ms ease, transform 140ms cubic-bezier(0.22, 1, 0.36, 1)",
              "& .epr-body": {
                scrollbarWidth: "thin",
                scrollbarColor: `${theme.palette.action.disabled} transparent`,
              },
              "& .epr-body::-webkit-scrollbar": {
                width: 8,
              },
              "& .epr-body::-webkit-scrollbar-track": {
                backgroundColor: "transparent",
              },
              "& .epr-body::-webkit-scrollbar-thumb": {
                backgroundColor: theme.palette.action.disabled,
                borderRadius: "8px",
              },
              "& .epr-body::-webkit-scrollbar-thumb:hover": {
                backgroundColor: theme.palette.text.disabled,
              },
            })}
          >
            <EmojiPicker
              onEmojiClick={addEmoji}
              lazyLoadEmojis={true}
              searchDisabled={true}
              width="100%"
              height="100%"
              style={{
                backgroundColor: "transparent",
                "--epr-bg-color": "transparent",
                "--epr-category-label-bg-color": "transparent",
                "--epr-reactions-bg-color": "transparent",
                "--epr-picker-border-color": "transparent",
                "--epr-preview-border-color": "transparent",
              }}
            />
          </Box>
        </Box>

        <input
          type="file"
          id="fileElem"
          onChange={reviewFileMsg}
          style={{ display: "none" }}
          ref={fileInput}
          multiple={false}
        />

        <IconButton
          disableRipple
          disableTouchRipple
          disabled={isEditing}
          onClick={handleFileSelectClick}
          sx={{
            "&.MuiButtonBase-root:hover": {
              bgcolor: "transparent",
            },
          }}
        >
          <AttachmentIcon />
        </IconButton>

        {Boolean(attachmentAnchorEl) && (
          <Popover
            anchorEl={attachmentAnchorEl}
            keepMounted
            open={Boolean(attachmentAnchorEl)}
            onClose={closeAttachmentPicker}
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
            transformOrigin={{ vertical: "bottom", horizontal: "left" }}
            PaperProps={{
              sx: {
                mb: 1,
                bgcolor: "background.paper",
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                minWidth: 150,
                p: 0.5,
              },
            }}
          >
            <Box
              role="button"
              onClick={() => triggerFilePicker("image/*,video/mp4,video/webm")}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                px: 1,
                py: 0.75,
                borderRadius: 1.25,
                cursor: "pointer",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <PhotoLibraryOutlinedIcon
                fontSize="small"
                sx={{ color: "action.active" }}
              />
              <Typography variant="body2">Photos and videos</Typography>
            </Box>
            <Box
              role="button"
              onClick={() =>
                triggerFilePicker(
                  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.csv,.zip,.rar,application/*"
                )
              }
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                px: 1,
                py: 0.75,
                borderRadius: 1.25,
                cursor: "pointer",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <DescriptionOutlinedIcon
                fontSize="small"
                sx={{ color: "action.active" }}
              />
              <Typography variant="body2">Files</Typography>
            </Box>
          </Popover>
        )}

        <Dialog
          open={isFileMsgDialogOpen}
          onClose={handleFileMsgDialogClose}
          disableRestoreFocus
        >
          <DialogTitle sx={{ fontWeight: "normal" }}>Send a file</DialogTitle>
          <FileMsgDialogContent
            chat={chat}
            user={user}
            fileMsg={fileMsg}
            setUploadTask={setUploadTask}
            onClose={handleFileMsgDialogClose}
            msgReply={msgReply}
            setMsgReply={setMsgReply}
            scroll={scroll}
          ></FileMsgDialogContent>
        </Dialog>

        <Box
          sx={{
            width: "65%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {isEditing
            ? renderComposerContextBar({
                title: "Edit message",
                subtitle: getEditPreviewText(),
                subtitleMaxWidth: "100%",
                icon: <EditIcon fontSize="small" />,
                onClose: () => setMsgEdit(null),
              })
            : msgReply &&
              renderComposerContextBar({
                title:
                  msgReply.from.uid === user.uid
                    ? "You"
                    : msgReply.from.displayName,
                subtitle: getReplyPreviewText(msgReply),
                subtitleMaxWidth: "100%",
                icon: msgReply.fileMsg ? (
                  <InsertDriveFileIcon fontSize="small" />
                ) : null,
                onClose: () => setMsgReply(null),
              })}
          <form
            style={{ width: "100%" }}
            onSubmit={handleSendMsg}
            ref={msgInputForm}
          >
            <TextareaAutosize
              style={{
                fontFamily: "inherit",
                fontSize: "1rem",
                color: theme.palette.text.primary,
                backgroundColor: theme.palette.background.paper,
                padding: "0.725rem 1.25rem",
                marginBottom: "-8px",
                width: "100%",
                border: "none",
                outline: "none",
                resize: "none",
                borderRadius: msgReply || isEditing ? "0 0 20px 20px" : "30px",
                boxSizing: "border-box",
              }}
              ref={inputRef}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.code !== "NumpadEnter")
                  return;
                if (event.ctrlKey || event.metaKey) {
                  // Ctrl/Cmd+Enter inserts newline (not submit) and triggers input
                  // so TextareaAutosize updates height immediately.
                  event.preventDefault();
                  const target = event.currentTarget;
                  const start = target.selectionStart;
                  const end = target.selectionEnd;
                  target.setRangeText("\n", start, end, "end");
                  target.dispatchEvent(new Event("input", { bubbles: true }));
                  return;
                }
                event.preventDefault();
                msgInputForm.current?.requestSubmit();
              }}
              placeholder="Message"
              maxRows={3}
            />
          </form>
        </Box>

        <IconButton
          disableRipple
          disableTouchRipple
          sx={{
            "&.MuiButtonBase-root:hover": {
              bgcolor: "transparent",
            },
          }}
          onClick={() => msgInputForm.current.requestSubmit()}
        >
          {isEditing ? <CheckIcon /> : <SendIcon />}
        </IconButton>
      </Box>
    </Box>
  );
}

export default ChatMsgInput;

ChatMsgInput.propTypes = {
  chat: PropTypes.object,
  setUploadTask: PropTypes.func,
  msgReply: PropTypes.object,
  setMsgReply: PropTypes.func,
  msgEdit: PropTypes.shape({
    msgId: PropTypes.string,
    type: PropTypes.string,
    fieldKey: PropTypes.oneOf(["msg", "caption"]),
    initialValue: PropTypes.string,
  }),
  setMsgEdit: PropTypes.func,
  scroll: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  ]),
};
