import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

import conversationsRouter from "./routes/conversations.js";
import groupsRouter from "./routes/groups.js";
import authRouter from "./routes/auth.js";
import { authenticateToken } from "./middlewares/auth.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
  },
});

const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.set("io", io);
app.use("/api/auth", authRouter);
app.use("/api/conversations", authenticateToken, conversationsRouter);
app.use("/api/groups", authenticateToken, groupsRouter);

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Authentication error"));
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error("Authentication error"));
    socket.userId = decoded.userId;
    next();
  });
});

io.on("connection", (socket) => {
  console.log(`User ${socket.userId} connected`);

  socket.on("join_conversation", (conversationId) => {
    socket.join(`conversation_${conversationId}`);
  });

  socket.on("leave_conversation", (conversationId) => {
    socket.leave(`conversation_${conversationId}`);
  });

  socket.on("join_group", (groupId) => {
    socket.join(`group_${groupId}`);
  });

  socket.on("leave_group", (groupId) => {
    socket.leave(`group_${groupId}`);
  });

  socket.on("new_message", async (messageData) => {
    try {
      const newMessage = await prisma.message.create({
        data: {
          content: messageData.content,
          userId: socket.userId,
          conversationId: messageData.conversationId,
          groupId: messageData.groupId,
        },
        include: {
          user: true,
          conversation: {
            include: {
              users: true,
            },
          },
        },
      });

      if (newMessage.conversationId) {
        const conversation = newMessage.conversation;
        if (conversation.isOneToOne) {
          // For one-to-one chat, emit to both users
          conversation.users.forEach((user) => {
            io.to(`user_${user.id}`).emit("message_received", {
              ...newMessage,
              conversation: undefined, // Remove circular reference
            });
          });
        } else {
          // For group conversations
          io.to(`conversation_${messageData.conversationId}`).emit(
            "message_received",
            {
              ...newMessage,
              conversation: undefined, // Remove circular reference
            }
          );
        }
      } else if (messageData.groupId) {
        io.to(`group_${messageData.groupId}`).emit(
          "message_received",
          newMessage
        );
      }
    } catch (error) {
      console.error("Error creating new message:", error);
    }
  });

  // handle user-specific rooms
  socket.join(`user_${socket.userId}`);

  socket.on("disconnect", () => {
    socket.leave(`user_${socket.userId}`);
    console.log(`User ${socket.userId} disconnected`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
