import { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        organizationId: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

export {};
