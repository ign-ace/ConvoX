import express from "express";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

// Get all groups
router.get("/", async (req, res) => {
  try {
    const groups = await prisma.group.findMany({
      where: {
        users: {
          some: {
            id: req.user.userId,
          },
        },
      },
      include: {
        users: true,
      },
    });
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: "Error fetching groups" });
  }
});

// Get a single group
router.get("/:id", async (req, res) => {
  try {
    const group = await prisma.group.findFirst({
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
    if (group) {
      res.json(group);
    } else {
      res.status(404).json({ error: "Group not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Error fetching group" });
  }
});

// Create a new group
router.post("/", async (req, res) => {
  try {
    const { name, description, userIds } = req.body;
    const currentUserId = req.user.userId;

    if (!userIds.includes(currentUserId)) {
      userIds.push(currentUserId);
    }

    const group = await prisma.group.create({
      data: {
        name,
        description,
        users: {
          connect: userIds.map((id) => ({ id })),
        },
      },
      include: {
        users: true,
      },
    });
    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ error: "Error creating group" });
  }
});

// Update a group
router.put("/:id", async (req, res) => {
  try {
    const { name, description, userIds } = req.body;
    const group = await prisma.group.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        description,
        users: {
          set: userIds.map((id) => ({ id })),
        },
      },
      include: {
        users: true,
      },
    });
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: "Error updating group" });
  }
});

// Delete a group
router.delete("/:id", async (req, res) => {
  try {
    await prisma.group.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Error deleting group" });
  }
});

// Add a user to a group
router.post("/:id/users", async (req, res) => {
  try {
    const { userId } = req.body;
    const group = await prisma.group.update({
      where: { id: parseInt(req.params.id) },
      data: {
        users: {
          connect: { id: userId },
        },
      },
      include: {
        users: true,
      },
    });
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: "Error adding user to group" });
  }
});

// Remove a user from a group
router.delete("/:id/users/:userId", async (req, res) => {
  try {
    const group = await prisma.group.update({
      where: { id: parseInt(req.params.id) },
      data: {
        users: {
          disconnect: { id: parseInt(req.params.userId) },
        },
      },
      include: {
        users: true,
      },
    });
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: "Error removing user from group" });
  }
});

export default router;
