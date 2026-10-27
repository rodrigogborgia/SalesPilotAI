export type ManualFollowUpStatus = 'scheduled' | 'completed' | 'won' | 'lost' | 'cancelled';

export type ManualFollowUp = {
  id: string;
  customer: string;
  contactName?: string | null;
  contactTitle?: string | null;
  email?: string | null;
  phone: string;
  reason: string;
  dueAt: string;
  priority: 'Alta' | 'Media' | 'Baja';
  owner: 'David' | 'Luciana';
  status: ManualFollowUpStatus;
  result: string;
  createdAt: string;
  completedAt: string | null;
  refCode?: string | null;
  updatedAt?: string;
  lead?: {
    customerName: string;
    contactTitle: string | null;
    contactPhone: string | null;
    email: string | null;
    companyName: string | null;
    notes: string | null;
    updatedAt: string;
  } | null;
};

export const MANUAL_FOLLOW_UPS_STORAGE_KEY = 'salespilot_manual_followups';

function isManualFollowUp(value: unknown): value is ManualFollowUp {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' &&
    typeof item.customer === 'string' &&
    typeof item.phone === 'string' &&
    typeof item.reason === 'string' &&
    typeof item.dueAt === 'string' &&
    Number.isFinite(Date.parse(item.dueAt)) &&
    (item.priority === 'Alta' || item.priority === 'Media' || item.priority === 'Baja') &&
    (item.owner === 'David' || item.owner === 'Luciana') &&
    (item.status === 'scheduled' || item.status === 'completed' || item.status === 'won' || item.status === 'lost' || item.status === 'cancelled') &&
    typeof item.result === 'string' &&
    typeof item.createdAt === 'string' &&
    Number.isFinite(Date.parse(item.createdAt)) &&
    (item.completedAt === null || (typeof item.completedAt === 'string' && Number.isFinite(Date.parse(item.completedAt)))) &&
    (item.refCode === undefined || item.refCode === null || typeof item.refCode === 'string');
}

export function parseManualFollowUps(raw: string): ManualFollowUp[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.some((item) => !isManualFollowUp(item))) {
    throw new Error('El almacenamiento de seguimientos tiene un formato inválido.');
  }
  return parsed;
}
