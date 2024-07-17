import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

export const createUser = async (userData) => {
  const hashedPassword = await bcrypt.hash(userData.password, 10);
  return prisma.user.create({
    data: {
      ...userData,
      password: hashedPassword,
    },
  });
};

export const findUserByEmail = (email) => {
  return prisma.user.findUnique({ where: { email } });
};

export const validatePassword = (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};
