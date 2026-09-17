import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ChatDialog from "./ChatDialog";

const sendChatMock = vi.fn();

vi.mock("../api/chat", () => ({
  sendChat: (...args: unknown[]) => sendChatMock(...args),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      username: "viewer",
      permissions: [],
    },
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("ChatDialog", () => {
  it("renders assistant HTML-like output as plain text", async () => {
    sendChatMock.mockResolvedValueOnce("<script>alert('x')</script><b>safe</b>");

    const { container } = render(<ChatDialog open onClose={() => undefined} />);

    fireEvent.change(screen.getByPlaceholderText("chat.placeholder"), {
      target: { value: "hello" },
    });
    fireEvent.click(screen.getByText("chat.send"));

    await waitFor(() => {
      expect(screen.getByText("<script>alert('x')</script><b>safe</b>")).toBeTruthy();
    });

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
  });
});
