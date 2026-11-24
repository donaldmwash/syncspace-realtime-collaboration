"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

const REALTIME_URL =
  process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:4000";
const ROOM_ID = "public-demo";

type ChatMessage = {
  id: string;
  sender: string;
  senderId: string;
  text: string;
  createdAt: string;
};

export function Workspace() {
  const [name, setName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [joined, setJoined] = useState(false);
  const [connected, setConnected] = useState(false);
  const [participants, setParticipants] = useState(1);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("Choose a display name to join the conversation.");
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedName = window.localStorage.getItem("syncspace-display-name");
    if (savedName) setNameInput(savedName);
  }, []);

  useEffect(() => {
    if (!joined || !name) return;

    const socket = io(REALTIME_URL, {
      transports: ["websocket"],
      auth: { roomId: ROOM_ID, displayName: name },
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setNotice("You're connected. Say hello!");
    });
    socket.on("disconnect", () => {
      setConnected(false);
      setNotice("Connection lost. Reconnecting…");
    });
    socket.on("chat:history", (history: ChatMessage[]) => {
      setMessages(Array.isArray(history) ? history : []);
    });
    socket.on("chat:message", (message: ChatMessage) => {
      setMessages((current) =>
        current.some((item) => item.id === message.id)
          ? current
          : [...current, message].slice(-200),
      );
    });
    socket.on("presence:count", (count: number) => setParticipants(count));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [joined, name]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function joinChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = nameInput.trim().replace(/\s+/g, " ").slice(0, 32);
    if (!cleanName) {
      setNotice("Please enter the name you want other participants to see.");
      return;
    }
    window.localStorage.setItem("syncspace-display-name", cleanName);
    setName(cleanName);
    setJoined(true);
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    const socket = socketRef.current;
    if (!text || !socket?.connected) return;
    socket.emit("chat:send", { text });
    setDraft("");
  }

  async function shareChat() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice("Chat link copied. Send it to your friends.");
    } catch {
      setNotice("Copy this page's URL and send it to your friends.");
    }
  }

  function changeName() {
    socketRef.current?.disconnect();
    setJoined(false);
    setConnected(false);
    setMessages([]);
    setName("");
    setNotice("Choose a display name to join the conversation.");
  }

  return (
    <main style={{ minHeight: "100vh", padding: "32px 16px 48px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div>
            <div style={{ color: "#8ea7d7", fontSize: 12, letterSpacing: 3 }}>SYNCSPACE COMMUNITY</div>
            <h1 style={{ fontSize: 30, margin: "8px 0 4px" }}>The conversation room</h1>
            <p style={{ color: "#91a2bd", margin: 0, fontSize: 14 }}>A place for you and your friends to chat in real time.</p>
          </div>
          <div role="status" style={{ border: "1px solid #26334b", borderRadius: 30, padding: "10px 14px", color: connected ? "#8ce0b0" : "#f3c77a", fontSize: 13 }}>
            ● {joined ? (connected ? "Online" : "Connecting…") : "Not joined"} · {participants} here
          </div>
        </header>

        {!joined ? (
          <section style={{ maxWidth: 480, margin: "70px auto", background: "#101a2b", border: "1px solid #26334b", borderRadius: 20, padding: 28 }}>
            <div style={{ fontSize: 12, color: "#8ea7d7", letterSpacing: 2 }}>JOIN THE CHAT</div>
            <h2 style={{ fontSize: 24, margin: "12px 0" }}>What should we call you?</h2>
            <p style={{ color: "#a8b6ce", fontSize: 14, lineHeight: 1.7 }}>Your display name will appear above every message you send, so everyone knows who is speaking.</p>
            <form onSubmit={joinChat}>
              <label htmlFor="display-name" style={{ display: "block", color: "#c4d0e4", fontSize: 13, marginBottom: 8 }}>Your name</label>
              <input id="display-name" value={nameInput} onChange={(event) => setNameInput(event.target.value)} maxLength={32} placeholder="e.g. Donald" autoComplete="nickname" required style={{ width: "100%", padding: 14, borderRadius: 10, border: "1px solid #354663", background: "#0a1220", color: "#e7eefb", outline: "none" }} />
              <button type="submit" style={{ width: "100%", marginTop: 14, padding: 14, border: 0, borderRadius: 10, background: "#86a8ff", color: "#081020", fontWeight: 700 }}>Enter chat</button>
            </form>
            <p style={{ color: "#8294b1", fontSize: 12, marginTop: 16 }}>{notice}</p>
          </section>
        ) : (
          <section style={{ background: "#101a2b", border: "1px solid #26334b", borderRadius: 20, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid #26334b", flexWrap: "wrap" }}>
              <div>
                <strong style={{ color: "#e7eefb" }}>Community chat</strong>
                <div style={{ color: "#8294b1", fontSize: 12, marginTop: 4 }}>Signed in as {name} · {participants} participant{participants === 1 ? "" : "s"}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={shareChat} style={{ padding: "9px 12px", border: "1px solid #354663", borderRadius: 9, background: "transparent", color: "#cbd8ec" }}>Share chat</button>
                <button onClick={changeName} style={{ padding: "9px 12px", border: "1px solid #354663", borderRadius: 9, background: "transparent", color: "#cbd8ec" }}>Change name</button>
              </div>
            </div>

            <div aria-live="polite" style={{ height: "min(62vh, 620px)", minHeight: 360, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              {messages.length === 0 ? (
                <div style={{ margin: "auto", textAlign: "center", color: "#8294b1", maxWidth: 300 }}>
                  <div style={{ fontSize: 30, marginBottom: 10 }}>💬</div>
                  <strong style={{ color: "#dbe6f8" }}>The room is open</strong>
                  <p style={{ fontSize: 13, lineHeight: 1.6 }}>Send the first message and start the conversation.</p>
                </div>
              ) : messages.map((message) => {
                const mine = message.senderId === socketRef.current?.id;
                return (
                  <article key={message.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "min(78%, 600px)", minWidth: 120 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, margin: "0 4px 6px" }}>
                      <strong style={{ color: mine ? "#9db8ff" : "#8ce0b0", fontSize: 12 }}>{message.sender}{mine ? " (you)" : ""}</strong>
                      <time style={{ color: "#7184a3", fontSize: 10 }}>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                    </div>
                    <div style={{ background: mine ? "#20365c" : "#1a2940", color: "#e7eefb", borderRadius: 14, padding: "11px 14px", lineHeight: 1.6, fontSize: 14, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.text}</div>
                  </article>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={sendMessage} style={{ display: "flex", gap: 10, padding: 16, borderTop: "1px solid #26334b", background: "#0d1727" }}>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} placeholder={connected ? "Write a message…" : "Reconnecting…"} disabled={!connected} aria-label="Message" style={{ flex: 1, minWidth: 0, padding: 14, borderRadius: 10, border: "1px solid #354663", background: "#101a2b", color: "#e7eefb", outline: "none" }} />
              <button type="submit" disabled={!connected || !draft.trim()} style={{ padding: "0 20px", border: 0, borderRadius: 10, background: connected && draft.trim() ? "#86a8ff" : "#465675", color: "#081020", fontWeight: 700 }}>Send</button>
            </form>
            <div style={{ padding: "0 18px 12px", color: "#7184a3", fontSize: 11 }}>{notice} · Messages are currently kept in temporary server memory.</div>
          </section>
        )}
        <footer style={{ color: "#657895", fontSize: 12, marginTop: 20, textAlign: "center" }}>SYNCSPACE · Community chat · Room: {ROOM_ID}</footer>
      </div>
    </main>
  );
}
