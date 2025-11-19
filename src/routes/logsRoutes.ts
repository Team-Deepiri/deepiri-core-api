import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import authenticateJWT from '../middleware/authenticateJWT';
import logger from '../utils/logger';

const router = express.Router();

interface AuthenticatedRequest extends Request {
  requestId?: string;
}

const isDocker = process.env.NODE_ENV === 'production' || process.env.DOCKER === 'true' || fs.existsSync('/.dockerenv');
const defaultLogsDir = isDocker ? '/app/logs' : path.join(process.cwd(), 'logs');
const envLogsDir = process.env.LOG_DIR;
let logsDir = defaultLogsDir;

if (envLogsDir && typeof envLogsDir === 'string') {
  if (path.isAbsolute(envLogsDir)) {
    if (isDocker && envLogsDir.startsWith('/app/')) {
      logsDir = envLogsDir;
    } else if (!isDocker) {
      logsDir = envLogsDir;
    }
  } else {
    logsDir = path.join(defaultLogsDir, envLogsDir);
  }
}

const readLogFile = (filePath: string, limit: number = 1000): any => {
  try {
    if (!fs.existsSync(filePath)) {
      return { error: 'Log file not found' };
    }

    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    
    let content = '';
    if (fileSize > 1024 * 1024) {
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(1024 * 1024);
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, fileSize - buffer.length);
      content = buffer.slice(0, bytesRead).toString('utf8');
      fs.closeSync(fd);
    } else {
      content = fs.readFileSync(filePath, 'utf8');
    }

    const lines = content.split('\n').filter(line => line.trim());
    const limitedLines = lines.slice(-limit);
    
    return {
      lines: limitedLines,
      totalLines: lines.length,
      fileSize: fileSize,
      lastModified: stats.mtime
    };
  } catch (error: any) {
    logger.error('Error reading log file:', error);
    return { error: 'Failed to read log file' };
  }
};

router.get('/', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type = 'combined', limit = '100' } = req.query;
    
    const validTypes = ['combined', 'error'];
    if (!validTypes.includes(type as string)) {
      res.status(400).json({
        success: false,
        message: 'Invalid log type. Must be "combined" or "error"',
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const parsedLimit = parseInt(limit as string);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 10000) {
      res.status(400).json({
        success: false,
        message: 'Invalid limit. Must be between 1 and 10000',
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const logFile = path.join(logsDir, `${type}.log`);
    const result = readLogFile(logFile, parsedLimit);

    if (result.error) {
      res.status(404).json({
        success: false,
        message: result.error,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
      return;
    }

    res.json({
      success: true,
      data: {
        type: type,
        lines: result.lines,
        totalLines: result.totalLines,
        fileSize: result.fileSize,
        lastModified: result.lastModified,
        limit: parsedLimit
      },
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Error in logs route:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/files', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  try {
    const files: any[] = [];
    
    if (fs.existsSync(logsDir)) {
      const logFiles = fs.readdirSync(logsDir).filter(file => file.endsWith('.log'));
      
      for (const file of logFiles) {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        
        files.push({
          name: file,
          size: stats.size,
          lastModified: stats.mtime,
          type: file.replace('.log', '')
        });
      }
    }

    res.json({
      success: true,
      data: {
        files: files,
        logsDirectory: logsDir
      },
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Error listing log files:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/search', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { q: query, type = 'combined', limit = '100' } = req.query;
    
    if (!query || (query as string).trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Search query is required',
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const validTypes = ['combined', 'error'];
    if (!validTypes.includes(type as string)) {
      res.status(400).json({
        success: false,
        message: 'Invalid log type. Must be "combined" or "error"',
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const parsedLimit = parseInt(limit as string);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
      res.status(400).json({
        success: false,
        message: 'Invalid limit. Must be between 1 and 1000',
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const logFile = path.join(logsDir, `${type}.log`);
    
    if (!fs.existsSync(logFile)) {
      res.status(404).json({
        success: false,
        message: 'Log file not found',
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    const matchingLines = lines.filter(line => 
      line.toLowerCase().includes((query as string).toLowerCase())
    ).slice(-parsedLimit);

    res.json({
      success: true,
      data: {
        query: query,
        type: type,
        matches: matchingLines,
        totalMatches: matchingLines.length,
        limit: parsedLimit
      },
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Error searching logs:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/', (req: Request, res: Response) => {
  res.status(204).end();
});

export default router;

