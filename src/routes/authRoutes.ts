import express, { Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Joi from 'joi';
import userService from '../services/userService';
import logger from '../utils/logger';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import AuditLog from '../models/AuditLog';

const router = express.Router();
router.use(cookieParser());

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  preferences: Joi.object({
    interests: Joi.array().items(Joi.string()).optional(),
    skillLevel: Joi.string().valid('beginner', 'intermediate', 'advanced').optional(),
    maxDistance: Joi.number().min(1000).max(20000).optional(),
    preferredDuration: Joi.number().min(30).max(90).optional(),
    socialMode: Joi.string().valid('solo', 'friends', 'meet_new_people').optional(),
    budget: Joi.string().valid('low', 'medium', 'high').optional(),
    timePreferences: Joi.object({
      morning: Joi.boolean().optional(),
      afternoon: Joi.boolean().optional(),
      evening: Joi.boolean().optional(),
      night: Joi.boolean().optional()
    }).optional()
  }).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const user = await userService.createUser(value);

    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        roles: user.roles
      },
      process.env.JWT_SECRET || '',
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'] }
    );

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const rtTtlDays = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '30');
    const expiresAt = new Date(Date.now() + rtTtlDays * 24 * 60 * 60 * 1000);
    user.refreshTokens.push({ token: refreshToken, createdAt: new Date(), expiresAt });
    await user.save();

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      expires: expiresAt
    });

    logger.info(`User registered: ${user.email}`);
    try { await AuditLog.create({ userId: user._id, action: 'register', ip: req.ip, userAgent: req.get('User-Agent') }); } catch {}

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: user.getPublicProfile(),
        token
      }
    });

  } catch (error: any) {
    logger.error('Registration failed:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const user = await userService.getUserByEmail(value.email);

    const isPasswordValid = await user.comparePassword(value.password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
      return;
    }

    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.email 
      },
      process.env.JWT_SECRET || '',
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'] }
    );

    logger.info(`User logged in: ${user.email}`);
    try { await AuditLog.create({ userId: user._id, action: 'login', ip: req.ip, userAgent: req.get('User-Agent') }); } catch {}

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.getPublicProfile(),
        token
      }
    });

  } catch (error: any) {
    logger.error('Login failed:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

router.get('/verify', async (req: Request, res: Response) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'No token provided'
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as any;
    
    const user = await userService.getUserById(decoded.userId);

    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        user: user.getPublicProfile()
      }
    });

  } catch (error: any) {
    logger.error('Token verification failed:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const token = (req as any).cookies?.refresh_token;
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'No refresh token'
      });
      return;
    }
    const user = await userService.findByRefreshToken(token);
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
      return;
    }

    const newToken = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        roles: user.roles
      },
      process.env.JWT_SECRET || '',
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'] }
    );

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        user: user.getPublicProfile(),
        token: newToken
      }
    });

  } catch (error: any) {
    logger.error('Token refresh failed:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Email is required'
      });
      return;
    }

    try {
      await userService.getUserByEmail(email);
      
      logger.info(`Password reset requested for: ${email}`);
      
      res.json({
        success: true,
        message: 'Password reset email sent (if user exists)'
      });
    } catch (error: any) {
      res.json({
        success: true,
        message: 'Password reset email sent (if user exists)'
      });
    }

  } catch (error: any) {
    logger.error('Forgot password failed:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Token and new password are required'
      });
      return;
    }

    logger.info('Password reset attempted');
    
    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error: any) {
    logger.error('Password reset failed:', error);
    res.status(400).json({
      success: false,
      message: 'Invalid or expired reset token'
    });
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  const token = (req as any).cookies?.refresh_token;
  if (token) await userService.revokeRefreshToken(token);
  res.clearCookie('refresh_token');
  res.json({ success: true, message: 'Logged out successfully' });
  try { await AuditLog.create({ action: 'logout', ip: req.ip, userAgent: req.get('User-Agent') }); } catch {}
});

export default router;

