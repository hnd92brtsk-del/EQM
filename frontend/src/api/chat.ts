import { apiFetch } from "./client";
import type { Message } from "../types";

export async function sendChat(messages: Message[], isAdmin = false) {
  const url = isAdmin ? "/chat/admin" : "/chat";
  const data = await apiFetch<{ content: string }>(url, {
    method: "POST",
    body: JSON.stringify({ messages })
  });
  return data.content;
}
