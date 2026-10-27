export const ENABLE_SOFIA_CHAT = false;

export type ViewMode = 'david' | 'luciana' | 'javier';

export function getViewMode(firstName: string, role: string): ViewMode {
  const normalizedName = firstName.trim().toLocaleLowerCase('es-AR');
  if (normalizedName === 'luciana') return 'luciana';
  if (normalizedName === 'david') return 'david';
  if (normalizedName === 'javier' || role === 'OWNER' || role === 'ADMIN') return 'javier';
  return 'david';
}
