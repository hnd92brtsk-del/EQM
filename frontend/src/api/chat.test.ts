import { describe, expect, it, vi } from "vitest";

import { sendChat } from "./chat";

const apiFetchMock = vi.fn();

vi.mock("./client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

describe("sendChat", () => {
  it("sends only user messages to the backend", async () => {
    apiFetchMock.mockResolvedValueOnce({ content: "reply" });

    const result = await sendChat([
      { role: "user", content: "question" },
      { role: "assistant", content: "answer" },
      { role: "user", content: "follow-up" },
    ]);

    expect(result).toBe("reply");
    expect(apiFetchMock).toHaveBeenCalledWith("/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          { role: "user", content: "question" },
          { role: "user", content: "follow-up" },
        ],
      }),
    });
  });
});
