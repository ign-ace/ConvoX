import express from "express";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

// Get all conversations
router.get("/", async (req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        users: {
          some: {
            id: req.user.userId,
          },
        },
      },
      include: {
        users: true,
        messages: {
          include: {
            user: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: "Error fetching conversations" });
  }
});

// Get a single conversation
router.get("/:id", async (req, res) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: parseInt(req.params.id),
        users: {
          some: {
            id: req.user.userId,
          },
        },
      },
      include: {
        users: true,
        messages: {
          include: {
            user: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });
    if (conversation) {
      res.json(conversation);
    } else {
      res.status(404).json({ error: "Conversation not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Error fetching conversation" });
  }
});

// Create a new conversation
router.post("/", async (req, res) => {
  try {
    const { title, userIds, isOneToOne } = req.body;
    const currentUserId = req.user.userId;

    if (!userIds.includes(currentUserId)) {
      userIds.push(currentUserId);
    }

    if (isOneToOne && userIds.length !== 2) {
      return res.status(400).json({
        error: "One-to-one conversations must have exactly two users",
      });
    }

    const conversation = await prisma.conversation.create({
      data: {
        title,
        isOneToOne,
        users: {
          connect: userIds.map((id) => ({ id })),
        },
      },
      include: {
        users: true,
      },
    });
    res.status(201).json(conversation);
  } catch (error) {
    res.status(500).json({ error: "Error creating conversation" });
  }
});

// Update a conversation
router.put("/:id", async (req, res) => {
  try {
    const { title, userIds } = req.body;
    const conversation = await prisma.conversation.update({
      where: { id: parseInt(req.params.id) },
      data: {
        title,
        users: {
          set: userIds.map((id) => ({ id })),
        },
      },
      include: {
        users: true,
      },
    });
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: "Error updating conversation" });
  }
});

// Send message
router.post("/:id/messages", async (req, res) => {
  try {
    const { content } = req.body;
    const conversationId = parseInt(req.params.id);
    const userId = req.user.userId;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        users: {
          some: {
            id: userId,
          },
        },
      },
      include: {
        users: true,
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const newMessage = await prisma.message.create({
      data: {
        content,
        userId,
        conversationId,
      },
      include: {
        user: true,
      },
    });

    // Emit the message to all users in the conversation
    const io = req.app.get("io");
    if (conversation.isOneToOne) {
      conversation.users.forEach((user) => {
        io.to(`user_${user.id}`).emit("message_received", newMessage);
      });
    } else {
      io.to(`conversation_${conversationId}`).emit(
        "message_received",
        newMessage
      );
    }

    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ error: "Error sending message" });
  }
});

// Delete a conversation
router.delete("/:id", async (req, res) => {
  try {
    await prisma.conversation.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Error deleting conversation" });
  }
});

// Get all one-to-one conversations for a user
router.get("/one-to-one/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const conversations = await prisma.conversation.findMany({
      where: {
        isOneToOne: true,
        users: {
          some: {
            id: userId,
          },
        },
      },
      include: {
        users: true,
        messages: {
          include: {
            user: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1, // Get only the last message
        },
      },
    });
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: "Error fetching one-to-one conversations" });
  }
});

export default router;
