import express, { Response, NextFunction } from 'express';
import taskService from '../services/taskService';
import authenticateJWT from '../middleware/authenticateJWT';
import { secureLog } from '../utils/secureLogger';
import { AuthenticatedRequest } from '../types';

const router = express.Router();

router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tasks = await taskService.getUserTasks(req.user!.id, req.query);
    res.json({ success: true, data: tasks });
  } catch (error: any) {
    secureLog('error', 'Error fetching tasks:', error);
    next(error);
  }
});

router.get('/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const task = await taskService.getTaskById(req.params.id, req.user!.id);
    res.json({ success: true, data: task });
  } catch (error: any) {
    secureLog('error', 'Error fetching task:', error);
    next(error);
  }
});

router.post('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const task = await taskService.createTask(req.user!.id, req.body);
    res.status(201).json({ success: true, data: task });
  } catch (error: any) {
    secureLog('error', 'Error creating task:', error);
    next(error);
  }
});

router.patch('/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const task = await taskService.updateTask(req.params.id, req.user!.id, req.body);
    res.json({ success: true, data: task });
  } catch (error: any) {
    secureLog('error', 'Error updating task:', error);
    next(error);
  }
});

router.delete('/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await taskService.deleteTask(req.params.id, req.user!.id);
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error: any) {
    secureLog('error', 'Error deleting task:', error);
    next(error);
  }
});

router.post('/:id/complete', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const task = await taskService.completeTask(req.params.id, req.user!.id, req.body);
    res.json({ success: true, data: task });
  } catch (error: any) {
    secureLog('error', 'Error completing task:', error);
    next(error);
  }
});

export default router;

