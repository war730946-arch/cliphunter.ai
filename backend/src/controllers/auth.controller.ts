import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import prisma from "../lib/prisma";
import { generateToken } from "../middlewares/auth.middleware";
import { AppError } from "../middlewares/error.middleware";
import {
  registerSchema,
  loginSchema,
} from "../validations/auth.validation";
import { logger } from "../utils/logger";

const SALT_ROUNDS = 12;

/**
 * POST /api/auth/register
 */
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      throw new AppError(firstError.message, 400);
    }

    const { name, email, password } = parsed.data;

    // Check for duplicate email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError("An account with this email already exists", 409);
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: { name, email, password_hash },
      select: {
        id: true,
        name: true,
        email: true,
        created_at: true,
      },
    });

    // Generate JWT
    const token = generateToken(user.id, user.email);

    logger.info(`User registered: ${user.email}`);

    res.status(201).json({
      status: "success",
      data: { user },
      token,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 */
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      throw new AppError(firstError.message, 400);
    }

    const { email, password } = parsed.data;

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new AppError("Invalid email or password", 401);
    }

    // Generate JWT
    const token = generateToken(user.id, user.email);

    logger.info(`User logged in: ${user.email}`);

    res.json({
      status: "success",
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          created_at: user.created_at,
        },
      },
      token,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 */
export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.user!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    res.json({
      status: "success",
      data: { user },
    });
  } catch (err) {
    next(err);
  }
}
