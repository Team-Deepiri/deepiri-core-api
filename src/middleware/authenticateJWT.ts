import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import { secureLog } from '../utils/secureLogger';
import { jwtConfig } from '../config/jwtConfig';
import { tokenRevocationService } from '../services/tokenRevocationService';

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

    const token = authHeader.replace('Bearer ', '').trim();
    
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
      return;
    }

    // Verify token with proper configuration
    const decoded = jwt.verify(
      token, 
      jwtConfig.secret,
      {
        algorithms: [jwtConfig.algorithm],
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      }
    ) as JWTPayload & { jti?: string };
    
    // Additional validation
    if (!decoded.userId || !decoded.email) {
      res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token payload.'
      });
      return;
    }

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

    // Check token revocation
    if (decoded.jti) {
      const isRevoked = await tokenRevocationService.isTokenRevoked(decoded.jti);
      if (isRevoked) {
        res.status(401).json({
          success: false,
          message: 'Access denied. Token has been revoked.'
        });
        return;
      }
    }

    // Set user context
    (req as any).user = {
      id: decoded.userId,
      userId: decoded.userId,
      email: decoded.email,
      roles: decoded.roles || ['user']
    };

    next();

  } catch (error: any) {
    secureLog('error', 'JWT authentication error:', {
      error: error.message,
      name: error.name,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    
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

    // Generic error - don't expose details
    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.'
    });
  }
};

export default authenticateJWT;

