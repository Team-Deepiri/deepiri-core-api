import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import mongoose from 'mongoose';
import { createServer, Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import promClient from 'prom-client';
import { v4 as uuidv4 } from 'uuid';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

// Import types
import { CustomSocket } from './types';

// Import services
import adventureService from './services/adventureService';
import userService from './services/userService';
import eventService from './services/eventService';
import notificationService from './services/notificationService';
import aiOrchestrator from './services/aiOrchestrator';
import cacheService from './services/cacheService';

// Import routes
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import userItemRoutes from './routes/userItemRoutes';
import adventureRoutes from './routes/adventureRoutes';
import agentRoutes from './routes/agentRoutes';
import eventRoutes from './routes/eventRoutes';
import notificationRoutes from './routes/notificationRoutes';
import externalRoutes from './routes/externalRoutes';
import logsRoutes from './routes/logsRoutes';
import taskRoutes from './routes/taskRoutes';
import challengeRoutes from './routes/challengeRoutes';
import gamificationRoutes from './routes/gamificationRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import integrationRoutes from './routes/integrationRoutes';

// Import middleware
import authenticateJWT from './middleware/authenticateJWT';
import { errorHandler, notFoundHandler, gracefulShutdown } from './middleware/errorHandler';
import { secureLog } from './utils/secureLogger';
import ipFilter from './middleware/ipFilter';
import sanitize from './middleware/sanitize';
import rateBot from './middleware/rateBot';
import auditLogger from './middleware/auditLogger';

dotenv.config();

const app: Express = express();
const server: HttpServer = createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true
  },
  // Enhanced Socket.IO configuration for real-time updates
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  allowEIO3: true, // Allow Engine.IO v3 clients
  // Configure transport options
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  perMessageDeflate: {
    threshold: 1024,
    concurrencyLimit: 10,
    memLevel: 7
  }
});

const PORT: number = parseInt(process.env.PORT || '5000', 10);

// CORS (handle before logging/limiting)
const corsAllowedOrigins: string[] = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CORS_ORIGIN
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || corsAllowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['x-request-id']
}));
app.options(/.*/, cors());

// CORS configuration (allow 3000 + 5173 + env)
const allowedOrigins: string[] = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CORS_ORIGIN
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['x-request-id']
}));
app.options(/.*/, cors());

// Security middleware
app.use(helmet());
app.use(compression());
app.use(ipFilter());
app.use(sanitize());
app.use(rateBot());
app.use(auditLogger());

// Rate limiting (skip preflight)
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10), // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip preflight, auth routes, and all requests in non-production envs
  skip: (req: Request) => {
    if (req.method === 'OPTIONS') return true;
    if (process.env.NODE_ENV !== 'production') return true;
    // when mounted at '/api/', req.path begins with '/auth' for auth endpoints
    return req.path && req.path.startsWith('/auth');
  }
});
app.use('/api/', limiter);

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      io?: SocketIOServer;
    }
  }
}

// Logging
app.use((req: Request, res: Response, next: NextFunction) => {
  req.requestId = uuidv4();
  res.setHeader('x-request-id', req.requestId);
  next();
});

app.use(morgan(':method :url :status :res[content-length] - :response-time ms :req[x-request-id]', {
  stream: { write: (message: string) => secureLog('info', message.trim()) }
}));

// Metrics
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics();
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code']
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.path, code: res.statusCode });
  });
  next();
});

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// OpenAPI docs (disabled by default in production)
const swaggerEnabled = process.env.SWAGGER_ENABLED === 'true' || process.env.NODE_ENV !== 'production';
if (swaggerEnabled) {
  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: '3.0.0',
      info: { title: 'Deepiri API', version: '3.0.0' }
    },
    apis: []
  });
  app.use('/api-docs', (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    next();
  }, swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: false }));
}

// Database connection
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/deepiri';
mongoose.connect(mongoUri)
.then(() => {
  secureLog('info', 'Connected to MongoDB');
})
.catch((error: Error) => {
  secureLog('error', 'MongoDB connection error:', error);
  process.exit(1);
});

// Initialize services
cacheService.initialize();
aiOrchestrator.initialize();

// Socket.IO connection handling
io.on('connection', (socket: CustomSocket) => {
  secureLog('info', `User connected: ${socket.id}`);
  
  // Send immediate connection confirmation
  socket.emit('connection_confirmed', {
    socketId: socket.id,
    timestamp: new Date().toISOString(),
    serverStatus: 'connected'
  });
  
  socket.on('join_user_room', (userId: string) => {
    socket.join(`user_${userId}`);
    secureLog('info', `User ${userId} joined their room`);
    socket.emit('room_joined', { room: `user_${userId}`, type: 'user' });
  });
  
  socket.on('join_adventure_room', (adventureId: string) => {
    socket.join(`adventure_${adventureId}`);
    secureLog('info', `User joined adventure room: ${adventureId}`);
    socket.emit('room_joined', { room: `adventure_${adventureId}`, type: 'adventure' });
  });

  // Multiplayer Collaboration Handlers
  socket.on('collaboration:join', (data: { roomId: string; userId: string; userInfo?: any }) => {
    const { roomId, userId, userInfo } = data;
    socket.join(`collaboration_${roomId}`);
    socket.to(`collaboration_${roomId}`).emit('collaborator:joined', {
      userId,
      ...userInfo,
      socketId: socket.id,
      joinedAt: new Date().toISOString()
    });
    secureLog('info', `User ${userId} joined collaboration room ${roomId}`);
  });

  socket.on('collaboration:leave', (data: { roomId: string }) => {
    const { roomId } = data;
    socket.to(`collaboration_${roomId}`).emit('collaborator:left', {
      socketId: socket.id,
      leftAt: new Date().toISOString()
    });
    socket.leave(`collaboration_${roomId}`);
  });

  socket.on('collaboration:update', (data: { roomId: string; update: any }) => {
    const { roomId, update } = data;
    socket.to(`collaboration_${roomId}`).emit('collaboration:state', update);
  });

  // Duel Handlers
  socket.on('duel:challenge', (data: { targetUserId: string; challengeConfig?: any; fromUserName?: string }) => {
    const { targetUserId, challengeConfig } = data;
    socket.to(`user_${targetUserId}`).emit('duel:invite', {
      id: `duel_${Date.now()}_${socket.id}`,
      fromUserId: socket.userId || socket.id,
      fromUserName: data.fromUserName || 'Unknown',
      challengeConfig,
      timestamp: Date.now()
    });
    secureLog('info', `Duel challenge sent from ${socket.id} to ${targetUserId}`);
  });

  socket.on('duel:accept', (data: { duelId: string; opponentUserId: string; challengeConfig?: { challengeType?: string; duration?: number } }) => {
    const { duelId } = data;
    // Create duel session
    const duelState = {
      id: duelId,
      participants: [
        { userId: socket.userId || socket.id, progress: 0 },
        { userId: data.opponentUserId, progress: 0 }
      ],
      challengeName: data.challengeConfig?.challengeType || 'Duel',
      startTime: Date.now(),
      endTime: Date.now() + (data.challengeConfig?.duration || 15 * 60 * 1000)
    };
    
    socket.emit('duel:start', duelState);
    socket.to(`user_${data.opponentUserId}`).emit('duel:start', duelState);
    secureLog('info', `Duel ${duelId} started`);
  });

  socket.on('duel:reject', (data: { duelId: string; fromUserId: string }) => {
    const { duelId } = data;
    socket.to(`user_${data.fromUserId}`).emit('duel:rejected', { duelId });
  });

  socket.on('duel:progress', (data: { duelId: string; progress: number }) => {
    const { duelId, progress } = data;
    socket.to(`duel_${duelId}`).emit('duel:update', {
      duelId,
      userId: socket.userId || socket.id,
      progress
    });
  });

  // Team/Guild Handlers
  socket.on('team:join', (data: { teamId: string; userId: string }) => {
    const { teamId, userId } = data;
    socket.join(`team_${teamId}`);
    socket.to(`team_${teamId}`).emit('team:member:joined', {
      userId,
      teamId,
      joinedAt: new Date().toISOString()
    });
    secureLog('info', `User ${userId} joined team ${teamId}`);
  });

  socket.on('team:leave', (data: { teamId: string }) => {
    const { teamId } = data;
    socket.to(`team_${teamId}`).emit('team:member:left', {
      userId: socket.userId || socket.id,
      teamId
    });
    socket.leave(`team_${teamId}`);
  });

  socket.on('team:mission:start', (data: { teamId: string; missionConfig?: { name?: string; duration?: number } }) => {
    const { teamId, missionConfig } = data;
    const mission = {
      id: `mission_${Date.now()}`,
      name: missionConfig?.name || 'Team Mission',
      teamId,
      startTime: Date.now(),
      endTime: Date.now() + (missionConfig?.duration || 60 * 60 * 1000),
      overallProgress: 0,
      contributions: []
    };
    io.to(`team_${teamId}`).emit('team:mission:started', mission);
  });

  socket.on('team:mission:progress', (data: { teamId: string; missionId: string; progress: number }) => {
    const { teamId, missionId, progress } = data;
    io.to(`team_${teamId}`).emit('team:mission:update', {
      missionId,
      userId: socket.userId || socket.id,
      progress,
      timestamp: Date.now()
    });
  });
  
  // Development mode: Enable file change notifications
  if (process.env.NODE_ENV !== 'production') {
    socket.on('file_changed', (data: any) => {
      socket.broadcast.emit('file_updated', data);
    });
    
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });
  }
  
  socket.on('disconnect', (reason: string) => {
    secureLog('info', `User disconnected: ${socket.id}, reason: ${reason}`);
  });
  
  socket.on('error', (error: Error) => {
    secureLog('error', `Socket.IO error for ${socket.id}:`, error);
  });
});

// Make io available to routes
app.use((req: Request, res: Response, next: NextFunction) => {
  req.io = io;
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateJWT, userRoutes);
app.use('/api/user-items', authenticateJWT, userItemRoutes);
app.use('/api/adventures', authenticateJWT, adventureRoutes);
app.use('/api/events', authenticateJWT, eventRoutes);
app.use('/api/notifications', authenticateJWT, notificationRoutes);
app.use('/api/external', externalRoutes);
app.use('/api/agent', authenticateJWT, agentRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/tasks', authenticateJWT, taskRoutes);
app.use('/api/challenges', authenticateJWT, challengeRoutes);
app.use('/api/gamification', authenticateJWT, gamificationRoutes);
app.use('/api/analytics', authenticateJWT, analyticsRoutes);
app.use('/api/integrations', authenticateJWT, integrationRoutes);

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      cache: cacheService.getConnectionStatus() ? 'connected' : 'disconnected',
      ai: aiOrchestrator.isReady() ? 'ready' : 'initializing'
    }
  });
});

app.get('/metrics', async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
  } catch (err: any) {
    res.status(500).end(err.message);
  }
});

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../deepiri-web-frontend/dist')));
  
  // Catch all handler: send back React's index.html file
  app.get(/.*/, (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../../deepiri-web-frontend/dist/index.html'));
  });
}

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown handlers
process.on('SIGTERM', gracefulShutdown(server));
process.on('SIGINT', gracefulShutdown(server));

server.listen(PORT, () => {
  secureLog('info', `Deepiri Server is running on port ${PORT}`);
  secureLog('info', `Environment: ${process.env.NODE_ENV || 'development'}`);
});

export { app, server, io };
