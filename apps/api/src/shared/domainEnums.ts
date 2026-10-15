export const UserRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  SALES: 'SALES',
  SUPPORT: 'SUPPORT',
  CLIENT_OPERATOR: 'CLIENT_OPERATOR'
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export function isUserRole(value: unknown): value is UserRole {
  return Object.values(UserRole).some((role) => role === value);
}

export const SupportTicketStatus = {
  RECEIVED: 'RECEIVED',
  DIAGNOSING: 'DIAGNOSING',
  SCHEDULED: 'SCHEDULED',
  REPAIRING: 'REPAIRING',
  RESOLVED: 'RESOLVED'
} as const;
