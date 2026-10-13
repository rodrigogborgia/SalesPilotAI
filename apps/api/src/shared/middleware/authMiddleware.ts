import { UserRole } from '@prisma/client';
import { RequestHandler } from 'express';

import prisma from '../../lib/prisma';
import { authService } from '../../modules/auth/auth.service';

export const authMiddleware: RequestHandler = async (req, res, next) => {
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

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        organizationId: true,
        role: true,
        status: true
      }
    });

    if (!user || user.status !== 'active') {
      res.status(401).json({ message: 'La sesión ya no está activa.' });
      return;
    }

    req.auth = {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role
    };
    next();
  } catch (error) {
    next(error);
  }
};

export function requireRoles(...roles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.auth) {
      res.status(401).json({ message: 'Autenticación requerida.' });
      return;
    }

    if (!roles.includes(req.auth.role)) {
      res.status(403).json({ message: 'No tienes permiso para acceder a este recurso.' });
      return;
    }

    next();
  };
}

export const internalPanelAccess = requireRoles(
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.SALES
);

export const ticketAccess = requireRoles(
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.SALES,
  UserRole.SUPPORT,
  UserRole.CLIENT_OPERATOR
);
