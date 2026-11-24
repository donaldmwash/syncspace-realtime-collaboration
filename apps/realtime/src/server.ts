import { createServer } from "node:http";
import { Server } from "socket.io";

type ChatMessage = {
  id: string;
  sender: string;
  senderId: string;
  text: string;
  createdAt: string;
  editedAt?: string;
};

const httpServer = createServer((_, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ service: "syncspace-realtime", status: "ok" }));
});

const io = new Server(httpServer, {
  cors: {
    origin: process.env.WEB_ORIGIN?.split(",") ?? "*",
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 1e6,
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

  socket.on("chat:send", (payload: { text?: unknown }) => {
    if (typeof payload?.text !== "string") return;
    const text = payload.text.trim().slice(0, 2000);
    if (!text) return;

    const message: ChatMessage = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      sender: displayName,
      senderId: authorId,
      text,
      createdAt: new Date().toISOString(),
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
