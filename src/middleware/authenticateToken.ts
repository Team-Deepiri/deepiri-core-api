import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/jwt'

export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.setHeader('WWW-Authenticate', 'Bearer error="invalid_request"')
    res.status(401).json({
      success: false,
      error: 'No token provided',
      code: 'NO_TOKEN',
    })
    return
  }

  const token = authHeader.slice(7).trim()

  try {
    const decoded = verifyAccessToken(token)

    // Attach user context to request
    ;(req as any).user = {
      id: decoded.userId,
      userId: decoded.userId,
      email: decoded.email,
      roles: decoded.roles || ['user'],
    }

    next()
  } catch (error: any) {
    if (error?.message === 'Access token expired') {
      res.setHeader(
        'WWW-Authenticate',
        'Bearer error="invalid_token", error_description="expired"'
      )
      res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      })
      return
    }

    res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"')
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
    })
  }
}
