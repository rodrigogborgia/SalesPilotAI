import { compare } from 'bcryptjs';
import jwt, { JsonWebTokenError, JwtPayload } from 'jsonwebtoken';

import prisma from '../../lib/prisma';
import { isUserRole, UserRole } from '../../shared/domainEnums';

export type LoginInput = {
  email: string;
  password: string;
};

type AccessTokenPayload = JwtPayload & {
  sub: string;
  organizationId: string;
  role: UserRole;
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters.');
  }

  return secret;
}

export const authService = {
  async login(payload: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() },
      include: { organization: true }
    });

    if (
      !user ||
      user.status !== 'active' ||
      !user.passwordHash ||
      !(await compare(payload.password, user.passwordHash))
    ) {
      return null;
    }

    const token = jwt.sign(
      {
        organizationId: user.organizationId,
        role: user.role
      },
      getJwtSecret(),
      {
        subject: user.id,
        expiresIn: '12h'
      }
    );

    return {
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization.name
      }
    };
  },

  verifyToken(token: string): AccessTokenPayload | null {
    const secret = getJwtSecret();

    try {
      const payload = jwt.verify(token, secret);

      if (
        typeof payload === 'string' ||
        typeof payload.sub !== 'string' ||
        typeof payload.organizationId !== 'string' ||
        !isUserRole(payload.role)
      ) {
        return null;
      }

      return {
        ...payload,
        sub: payload.sub,
        organizationId: payload.organizationId,
        role: payload.role
      };
    } catch (error) {
      if (error instanceof JsonWebTokenError) {
        return null;
      }

      throw error;
    }
  }
};
