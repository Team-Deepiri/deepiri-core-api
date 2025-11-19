import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import logger from '../utils/logger';

interface JWTPayload {
  userId: string;
  email: string;
  roles?: string[];
}

const authenticateJWT = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
      return;
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as JWTPayload;
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Access denied. User not found.'
      });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({
        success: false,
        message: 'Access denied. Account is deactivated.'
      });
      return;
    }

    (req as any).user = {
      id: decoded.userId,
      userId: decoded.userId,
      email: decoded.email,
      roles: decoded.roles || ['user']
    };

    next();

  } catch (error: any) {
    logger.error('JWT authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token.'
      });
      return;
    }
    
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Access denied. Token expired.'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.'
    });
  }
};

export default authenticateJWT;

