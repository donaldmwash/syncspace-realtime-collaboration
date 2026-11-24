"use client";

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { io, type Socket } from "socket.io-client";

const REALTIME_URL =
  process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:4000";
const ROOM_ID = "public-demo";

export function Workspace() {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const applyingRemote = useRef(false);

  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(
    "Your changes sync live with everyone in this room.",
  );

  useEffect(() => {
    const doc = new Y.Doc();
    docRef.current = doc;
    const content = doc.getText("content");
    const socket = io(REALTIME_URL, {
      transports: ["websocket"],
      auth: { roomId: ROOM_ID, displayName: "Guest editor" },
      reconnection: true,
    });
    socketRef.current = socket;

    function render() {
      const editor = editorRef.current;
      if (!editor) return;

      const nextValue = content.toString();
      if (editor.value === nextValue) return;

      // Preserve the current caret/selection while applying remote edits.
      const selectionStart = editor.selectionStart;
      const selectionEnd = editor.selectionEnd;
      editor.value = nextValue;
      const safeStart = Math.min(selectionStart, nextValue.length);
      const safeEnd = Math.min(selectionEnd, nextValue.length);
      editor.setSelectionRange(safeStart, safeEnd);
    }

    socket.on("connect", () => {
      setConnected(true);
      // Send any edits made while disconnected so the server can merge them.
      socket.emit("doc:update", Array.from(Y.encodeStateAsUpdate(doc)));
    });
    socket.on("disconnect", () => setConnected(false));

    socket.on("sync:init", (update: number[]) => {
      applyingRemote.current = true;
      Y.applyUpdate(doc, new Uint8Array(update), "remote");
      applyingRemote.current = false;
      render();
    });

    socket.on("doc:update", (update: number[]) => {
      applyingRemote.current = true;
      Y.applyUpdate(doc, new Uint8Array(update), "remote");
      applyingRemote.current = false;
      render();
    });

    socket.on("presence:count", (count: number) => setPeers(count));

    doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin !== "remote" && socket.connected) {
        socket.emit("doc:update", Array.from(update));
      }
    });
    content.observe(render);

    return () => {
      socket.disconnect();
      doc.destroy();
      docRef.current = null;
      socketRef.current = null;
    };
  }, []);

  function onInput() {
    const editor = editorRef.current;
    const doc = docRef.current;
    if (applyingRemote.current || !editor || !doc) return;

    const ytext = doc.getText("content");
    const previous = ytext.toString();
    const next = editor.value;

    // Apply only the changed middle section instead of replacing the full
    // document on every keystroke. This preserves Yjs's concurrent-edit model.
    let prefix = 0;
    while (
      prefix < previous.length &&
      prefix < next.length &&
      previous[prefix] === next[prefix]
    ) {
      prefix += 1;
    }

    let suffix = 0;
    while (
      suffix < previous.length - prefix &&
      suffix < next.length - prefix &&
      previous[previous.length - 1 - suffix] ===
        next[next.length - 1 - suffix]
    ) {
      suffix += 1;
    }

    const deleteCount = previous.length - prefix - suffix;
    const insertion = next.slice(prefix, next.length - suffix);

    if (deleteCount === 0 && insertion.length === 0) return;

    doc.transact(() => {
      if (deleteCount > 0) ytext.delete(prefix, deleteCount);
      if (insertion.length > 0) ytext.insert(prefix, insertion);
    }, "human");
  }

  async function askAI() {
    const doc = docRef.current;
    if (!doc) return;

    setBusy(true);
    setNotice("AI is preparing a document edit…");
    try {
      const response = await fetch("/api/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: doc.getText("content").toString() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI request failed");

      const ytext = doc.getText("content");
      doc.transact(() => ytext.insert(ytext.length, data.insertion), "ai");
      setNotice(
        "AI inserted content through a Yjs transaction. Connected editors receive the same update.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "AI edit failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function shareRoom() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice("Room link copied. Anyone with the link can edit this shared room.");
    } catch {
      setNotice("Copy the page URL from your browser and send it to your participants.");
    }
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 38,
        }}
      >
        <div>
          <div style={{ fontSize: 13, letterSpacing: 3, color: "#8ea7d7" }}>
            SYNCSPACE / LIVE DOCUMENT
          </div>
          <h1 style={{ fontSize: 30, margin: "8px 0" }}>
            Think together. Build together.
          </h1>
        </div>
        <div
          role="status"
          style={{
            border: "1px solid #26334b",
            borderRadius: 30,
            padding: "10px 16px",
            fontSize: 13,
            color: connected ? "#8ce0b0" : "#f3c77a",
          }}
        >
          ● {connected ? "Connected" : "Connecting"} · {peers} participant
          {peers === 1 ? "" : "s"}
        </div>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 280px",
          gap: 20,
        }}
      >
        <div
          style={{
            background: "#101a2b",
            border: "1px solid #26334b",
            borderRadius: 18,
            padding: 28,
            minHeight: 480,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#8095b8",
              letterSpacing: 2,
              marginBottom: 20,
            }}
          >
            SHARED CANVAS / EVERYONE CAN EDIT
          </div>
          <textarea
            ref={editorRef}
            aria-label="Shared document"
            onInput={onInput}
            placeholder="Start writing here. Everyone in this room can edit this document…"
            spellCheck
            style={{
              display: "block",
              width: "100%",
              minHeight: 350,
              resize: "vertical",
              boxSizing: "border-box",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              fontFamily: "inherit",
              fontSize: 17,
              lineHeight: 1.8,
              color: "#e7eefb",
              background: "transparent",
              border: 0,
              outline: "none",
            }}
          />
          <div
            style={{
              borderTop: "1px solid #26334b",
              marginTop: 22,
              paddingTop: 14,
              fontSize: 12,
              color: "#7f91ae",
            }}
          >
            Changes are synchronised as Yjs document updates.
          </div>
        </div>

        <aside
          style={{
            background: "#101a2b",
            border: "1px solid #26334b",
            borderRadius: 18,
            padding: 20,
            height: "fit-content",
          }}
        >
          <div style={{ fontSize: 12, color: "#8095b8", letterSpacing: 2 }}>
            COLLABORATION
          </div>
          <h2 style={{ fontSize: 20, margin: "12px 0" }}>Invite your team</h2>
          <p style={{ fontSize: 13, color: "#a8b6ce", lineHeight: 1.7 }}>
            Share this room link with your participants. Everyone who opens it
            can edit the same document in real time.
          </p>
          <button
            onClick={shareRoom}
            style={{
              width: "100%",
              padding: 13,
              border: 0,
              borderRadius: 10,
              background: "#86a8ff",
              color: "#081020",
              fontWeight: 700,
              marginTop: 12,
              cursor: "pointer",
            }}
          >
            Copy participant link
          </button>

          <div style={{ borderTop: "1px solid #26334b", marginTop: 18, paddingTop: 16 }}>
            <div style={{ fontSize: 12, color: "#8095b8", letterSpacing: 2 }}>
              AI PARTICIPANT
            </div>
            <p style={{ fontSize: 13, color: "#a8b6ce", lineHeight: 1.7 }}>
              Ask AI to add a concise summary to the shared document.
            </p>
            <button
              disabled={busy}
              onClick={askAI}
              style={{
                width: "100%",
                padding: 13,
                border: 0,
                borderRadius: 10,
                background: busy ? "#52627f" : "#86a8ff",
                color: "#081020",
                fontWeight: 700,
                marginTop: 8,
                cursor: busy ? "wait" : "pointer",
              }}
            >
              {busy ? "Working…" : "@AI Insert summary"}
            </button>
          </div>

          <p
            aria-live="polite"
            style={{ fontSize: 12, color: "#8ea2c4", lineHeight: 1.6, marginTop: 16 }}
          >
            {notice}
          </p>
          <div style={{ borderTop: "1px solid #26334b", marginTop: 18, paddingTop: 16, fontSize: 12, color: "#8294b1" }}>
            ROOM: <strong style={{ color: "#dbe6f8" }}>{ROOM_ID}</strong>
            <br />
            Guest access · no registration
            <br />
            Anyone with the link can edit. Do not put confidential information here.
          </div>
        </aside>
      </section>

      <footer style={{ marginTop: 34, color: "#657895", fontSize: 12 }}>
        A shared collaborative document workspace with Yjs conflict-free
        synchronisation.
      </footer>
    </main>
  );
}
