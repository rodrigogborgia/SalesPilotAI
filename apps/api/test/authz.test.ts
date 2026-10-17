import assert from 'node:assert/strict';
import test from 'node:test';
import { RequestHandler } from 'express';

import {
  internalPanelAccess,
  requireRoles,
  ticketAccess
} from '../src/shared/middleware/authMiddleware';
import { UserRole } from '../src/shared/domainEnums';

function invoke(
  middleware: RequestHandler,
  role?: UserRole
): { statusCode?: number; nextCalled: boolean } {
  const state: { statusCode?: number; nextCalled: boolean } = { nextCalled: false };
  const req = {
    auth: role
      ? {
          userId: 'user-1',
          organizationId: 'org-1',
          role
        }
      : undefined
  };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json() {
      return this;
    }
  };

  middleware(req as never, res as never, () => {
    state.nextCalled = true;
  });

  return state;
}

test('client operator is denied access to internal CRM routes', () => {
  const result = invoke(internalPanelAccess, UserRole.CLIENT_OPERATOR);

  assert.equal(result.statusCode, 403);
  assert.equal(result.nextCalled, false);
});

test('client operator can access the ticket portal', () => {
  const result = invoke(ticketAccess, UserRole.CLIENT_OPERATOR);

  assert.equal(result.statusCode, undefined);
  assert.equal(result.nextCalled, true);
});

test('owners and sales users can access the internal panel', () => {
  for (const role of [UserRole.OWNER, UserRole.SALES]) {
    const result = invoke(internalPanelAccess, role);
    assert.equal(result.statusCode, undefined);
    assert.equal(result.nextCalled, true);
  }
});

test('only owners and admins can access admin routes', () => {
  const adminAccess = requireRoles(UserRole.OWNER, UserRole.ADMIN);

  for (const role of [UserRole.OWNER, UserRole.ADMIN]) {
    const result = invoke(adminAccess, role);
    assert.equal(result.statusCode, undefined);
    assert.equal(result.nextCalled, true);
  }

  const salesResult = invoke(adminAccess, UserRole.SALES);
  assert.equal(salesResult.statusCode, 403);
  assert.equal(salesResult.nextCalled, false);
});

test('unauthenticated requests are rejected by role guards', () => {
  for (const guard of [internalPanelAccess, requireRoles(UserRole.CLIENT_OPERATOR)]) {
    const result = invoke(guard);
    assert.equal(result.statusCode, 401);
    assert.equal(result.nextCalled, false);
  }
});
