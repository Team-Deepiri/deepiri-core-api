import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { Server as HttpServer } from 'http';

interface CustomError extends Error {
  statusCode?: number;
  code?: number;
  errors?: Record<string, { message: string }>;
}

export const errorHandler = (err: CustomError, req: Request, res: Response, next: NextFunction): void => {
  const requestId = (req as any).requestId || 'unknown';
  
  logger.error('Request error occurred', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: (req as any).user?.userId,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack
    }
  });

  let error: CustomError = { ...err };
  error.message = err.message;

  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 } as CustomError;
  }

  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 } as CustomError;
  }

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors || {}).map((val: any) => val.message).join(', ');
    error = { message, statusCode: 400 } as CustomError;
  }

  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 } as CustomError;
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 } as CustomError;
  }

  if (err.statusCode === 429) {
    const message = 'Too many requests, please try again later';
    error = { message, statusCode: 429 } as CustomError;
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  const errorResponse: any = {
    success: false,
    message,
    requestId,
    timestamp: new Date().toISOString()
  };

  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.context = {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    };
  }

  res.status(statusCode).json(errorResponse);
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const notFoundHandler = (req: Request, res: Response): void => {
  const requestId = (req as any).requestId || 'unknown';
  
  logger.warn('Route not found', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  res.status(404).json({
    success: false,
    message: 'Route not found',
    requestId,
    timestamp: new Date().toISOString(),
    path: req.url
  });
};

export const gracefulShutdown = (server: HttpServer) => {
  return (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    
    server.close((err?: Error) => {
      if (err) {
        logger.error('Error during server shutdown:', err);
        process.exit(1);
      }
      
      logger.info('Server closed successfully');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };
};

