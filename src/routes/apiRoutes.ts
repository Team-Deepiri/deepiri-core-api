import express, { Request, Response } from 'express';
import authenticateJWT from '../middleware/authenticateJWT';
import { signUp, loginUser, getUserData } from '../controllers/dataController';
import flags from '../utils/flags';

const router = express.Router();

router.get('/ping', (req: Request, res: Response) => {
  res.send('Pong');
});

router.post('/sign-up', signUp);
router.post('/login', loginUser);

router.get('/user', authenticateJWT, getUserData);

router.get('/flags', (req: Request, res: Response) => {
  res.json({ success: true, data: flags.getAll() });
});

export default router;

