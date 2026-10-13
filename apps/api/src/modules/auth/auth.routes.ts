import { Router } from 'express';

import { authService } from './auth.service';

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

authRoutes.get('/me', (req, res, next) => {
  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!token) {
    res.status(401).json({ message: 'Autenticación requerida.' });
    return;
  }

  try {
    const payload = authService.verifyToken(token);

    if (!payload) {
      res.status(401).json({ message: 'Token inválido o vencido.' });
      return;
    }

    res.status(200).json({
      id: payload.sub,
      organizationId: payload.organizationId,
      role: payload.role
    });
  } catch (error) {
    next(error);
  }
});
