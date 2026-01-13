import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Paper,
  TextField,
  Typography
} from "@mui/material";
import { useTranslation } from "react-i18next";

import { sendChat } from "../api/chat";
import { useAuth } from "../context/AuthContext";
import type { Message } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ChatDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  async function handleSend() {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    let updated: Message[] = [];
    setMessages((prev) => {
      updated = [...prev, userMessage];
      return updated;
    });
    setInput("");

    const reply = await sendChat(updated, isAdmin);
    const assistantMessage: Message = { role: "assistant", content: reply };
    setMessages((prev) => [...prev, assistantMessage]);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("chat.title")}</DialogTitle>
      <DialogContent>
        <Paper variant="outlined" sx={{ p: 2, mb: 2, maxHeight: 300, overflowY: "auto" }}>
          {messages.map((message, idx) => (
            <Box key={idx} sx={{ mb: 1 }}>
              <Typography
                variant="caption"
                color={message.role === "user" ? "primary" : "secondary"}
              >
                {message.role === "user" ? user?.username : "phi-3-mini-4k-instruct"}
              </Typography>
              <Typography>{message.content}</Typography>
            </Box>
          ))}
        </Paper>
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            fullWidth
            multiline
            maxRows={3}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t("chat.placeholder") ?? ""}
          />
          <Button onClick={handleSend} variant="contained">
            {t("chat.send")}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
