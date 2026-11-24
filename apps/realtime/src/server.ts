import { createServer } from "node:http";
import { Server } from "socket.io";
import { randomUUID } from "node:crypto";

type ChatMessage = {
  id: string;
  sender: string;
  senderId: string;
  text: string;
  createdAt: string;
  editedAt?: string;
  attachment?: { id: string; name: string; size: number; type: string };
  replyTo?: { id: string; sender: string; text: string; attachmentName?: string };
};

type StoredFile = { roomId: string; name: string; type: string; bytes: Buffer };
const storedFiles = new Map<string, StoredFile>();
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const BLOCKED_EXTENSIONS = [".exe", ".dll", ".bat", ".cmd", ".com", ".msi", ".sh", ".ps1", ".app", ".dmg", ".apk", ".jar", ".scr"];

const httpServer = createServer((req, res) => {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;
  if (req.method === "GET" && pathname.startsWith("/files/")) {
    const fileId = pathname.slice("/files/".length);
    const file = storedFiles.get(fileId);
    if (!file) { res.writeHead(404); res.end("File not found"); return; }
    const safeName = file.name.replaceAll(String.fromCharCode(13), "_").replaceAll(String.fromCharCode(10), "_").replaceAll('"', "_");
    const inline = file.type.startsWith("image/") || file.type === "application/pdf";
    res.writeHead(200, {
      "content-type": file.type,
      "content-length": file.bytes.length,
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "access-control-allow-origin": process.env.WEB_ORIGIN?.split(",").join(", ") || "*",
    });
    res.end(file.bytes);
    return;
  }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ service: "syncspace-realtime", status: "ok" }));
});

const io = new Server(httpServer, {
  cors: {
    origin: process.env.WEB_ORIGIN?.split(",") ?? "*",
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 8e6,
});

const roomMessages = new Map<string, ChatMessage[]>();

io.on("connection", (socket) => {
  const roomId = String(socket.handshake.auth.roomId || "public-demo").slice(0, 100);
  const rawName = String(socket.handshake.auth.displayName || "Guest");
  const displayName = rawName.replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 32) || "Guest";
  const authorId = String(socket.handshake.auth.authorId || socket.id).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || socket.id;

  socket.join(roomId);
  socket.emit("chat:history", roomMessages.get(roomId) ?? []);
  io.to(roomId).emit(
    "presence:count",
    io.sockets.adapter.rooms.get(roomId)?.size ?? 1,
  );

  socket.on("chat:send", (payload: { text?: unknown; replyToId?: unknown }) => {
    if (typeof payload?.text !== "string") return;
    const text = payload.text.trim().slice(0, 2000);
    if (!text) return;

    const history = roomMessages.get(roomId) ?? [];
    const repliedMessage = typeof payload.replyToId === "string" ? history.find((item) => item.id === payload.replyToId) : undefined;
    const replyTo = repliedMessage ? {
      id: repliedMessage.id,
      sender: repliedMessage.sender,
      text: repliedMessage.text.slice(0, 180),
      ...(repliedMessage.attachment ? { attachmentName: repliedMessage.attachment.name } : {}),
    } : undefined;
    const message: ChatMessage = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      sender: displayName,
      senderId: authorId,
      text,
      createdAt: new Date().toISOString(),
      ...(replyTo ? { replyTo } : {}),
    };

    history.push(message);
    if (history.length > 200) history.splice(0, history.length - 200);
    roomMessages.set(roomId, history);
    io.to(roomId).emit("chat:message", message);
  });

  socket.on("chat:upload", (payload: { name?: unknown; type?: unknown; data?: unknown }) => {
    if (typeof payload?.name !== "string" || typeof payload?.type !== "string" || typeof payload?.data !== "string") return;
    const name = payload.name.replaceAll("/", "_").replaceAll(String.fromCharCode(92), "_").replaceAll(String.fromCharCode(13), "_").replaceAll(String.fromCharCode(10), "_").trim().slice(0, 180);
    if (!name || BLOCKED_EXTENSIONS.some((extension) => name.toLowerCase().endsWith(extension))) { socket.emit("chat:upload-error", "This file type is not allowed."); return; }
    const prefix = `data:${payload.type};base64,`;
    if (!payload.type.includes("/") || !payload.data.startsWith(prefix) || !/^[A-Za-z0-9+/]+=*$/.test(payload.data.slice(prefix.length))) {
      socket.emit("chat:upload-error", "The selected file could not be read."); return;
    }
    const bytes = Buffer.from(payload.data.slice(prefix.length), "base64");
    if (!bytes.length || bytes.length > MAX_FILE_SIZE) { socket.emit("chat:upload-error", "Files must be 5 MB or smaller."); return; }
    if (storedFiles.size >= 500) { socket.emit("chat:upload-error", "The room has reached its temporary attachment limit."); return; }
    const id = randomUUID();
    storedFiles.set(id, { roomId, name, type: payload.type, bytes });
    const message: ChatMessage = {
      id: `file-${id}`, sender: displayName, senderId: authorId, text: "",
      createdAt: new Date().toISOString(),
      attachment: { id, name, size: bytes.length, type: payload.type },
    };
    const history = roomMessages.get(roomId) ?? [];
    history.push(message);
    if (history.length > 200) history.splice(0, history.length - 200);
    roomMessages.set(roomId, history);
    io.to(roomId).emit("chat:message", message);
  });

  socket.on("chat:edit", (payload: { id?: unknown; text?: unknown }) => {
    if (typeof payload?.id !== "string" || typeof payload?.text !== "string") return;
    const text = payload.text.trim().slice(0, 2000);
    if (!text) return;
    const history = roomMessages.get(roomId) ?? [];
    const message = history.find((item) => item.id === payload.id);
    if (!message || message.senderId !== authorId) return;
    message.text = text;
    message.editedAt = new Date().toISOString();
    io.to(roomId).emit("chat:message-updated", message);
  });

  socket.on("chat:delete", (payload: { id?: unknown }) => {
    if (typeof payload?.id !== "string") return;
    const history = roomMessages.get(roomId) ?? [];
    const message = history.find((item) => item.id === payload.id);
    if (!message || message.senderId !== authorId) return;
    roomMessages.set(roomId, history.filter((item) => item.id !== payload.id));
    io.to(roomId).emit("chat:message-deleted", { id: payload.id });
  });

  socket.on("chat:clear-mine", () => {
    const history = roomMessages.get(roomId) ?? [];
    const remaining = history.filter((item) => item.senderId !== authorId);
    const deletedIds = history.filter((item) => item.senderId === authorId).map((item) => item.id);
    roomMessages.set(roomId, remaining);
    if (deletedIds.length) io.to(roomId).emit("chat:messages-deleted", { ids: deletedIds });
  });

  socket.on("disconnect", () => {
    io.to(roomId).emit(
      "presence:count",
      io.sockets.adapter.rooms.get(roomId)?.size ?? 0,
    );
  });
});

const port = Number(process.env.PORT || 4000);
httpServer.listen(port, () =>
  console.log(JSON.stringify({ level: "info", event: "realtime_started", port })),
);
