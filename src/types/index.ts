import { Request } from 'express';

/**
 * Extended Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id?: string;
    userId?: string;
    name?: string;
    email?: string;
    [key: string]: any;
  };
  // These should already be on Request, but explicitly include them for TypeScript
  query: Request['query'];
  body: Request['body'];
  params: Request['params'];
  // Additional properties used in routes
  io?: any; // Socket.IO server instance
  requestId?: string; // Request ID for logging
}

/**
 * Extended Socket.IO Socket with custom properties
 * Using any to avoid import issues when socket.io types aren't available
 */
export interface CustomSocket {
  id: string;
  userId?: string;
  emit: (event: string, ...args: any[]) => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  join: (room: string) => void;
  leave: (room: string) => void;
  to: (room: string) => { emit: (event: string, ...args: any[]) => void };
  broadcast: { emit: (event: string, ...args: any[]) => void };
  disconnect: () => void;
  [key: string]: any;
}

/**
 * Extended AuthenticatedRequest for user item operations
 */
export interface UserItemRequest extends AuthenticatedRequest {
  item?: any;
  isOwner?: boolean;
  isShared?: boolean;
  isPublic?: boolean;
}

