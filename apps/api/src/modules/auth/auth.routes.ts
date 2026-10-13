import { Router } from 'express';

import { authService } from './auth.service';
import { authMiddleware } from '../../shared/middleware/authMiddleware';

export const authRoutes = Router();

authRoutes.post('/login', async (req, res, next) => {
  const body = req.body as { email?: unknown; password?: unknown };

  if (
    typeof body?.email !== 'string' ||
    typeof body.password !== 'string' ||
    !body.email.trim() ||
    !body.password
  ) {
    res.status(400).json({ message: 'Email y contraseña son obligatorios.' });
    return;
  }

  try {
    const result = await authService.login({
      email: body.email.trim(),
      password: body.password
    });

    if (!result) {
      res.status(401).json({ message: 'Email o contraseña incorrectos.' });
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

authRoutes.get('/me', authMiddleware, (req, res) => {
  res.status(200).json(req.auth);
});
