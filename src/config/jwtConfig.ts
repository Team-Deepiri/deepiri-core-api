import { config } from 'dotenv';

config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    'JWT_SECRET must be set and at least 32 characters long. ' +
    'Set JWT_SECRET in environment variables before starting the application.'
  );
}

export const jwtConfig = {
  secret: JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  algorithm: 'HS256' as const,
  issuer: process.env.JWT_ISSUER || 'deepiri-api',
  audience: process.env.JWT_AUDIENCE || 'deepiri-client',
};