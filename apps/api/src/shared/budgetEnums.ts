export const BudgetStatus = {
  SENT: '01 - Enviado',
  FOLLOW_UP: '02 - En Seguimiento',
  WON: '03 - Ganado',
  LOST: '04 - Perdido',
  STANDBY: '05 - Stand-By'
} as const;

export type BudgetStatus = (typeof BudgetStatus)[keyof typeof BudgetStatus];

export const BudgetLossReason = {
  HIGH_PRICE: 'Precio elevado',
  DELIVERY_TIME: 'Plazo de entrega',
  REPAIRED_CURRENT_EQUIPMENT: 'Reparó equipo actual',
  NO_BUDGET: 'Sin presupuesto',
  COLD_LEAD: 'Lead frío / Sin respuesta'
} as const;

export type BudgetLossReason = (typeof BudgetLossReason)[keyof typeof BudgetLossReason];

export function isBudgetStatus(value: unknown): value is BudgetStatus {
  return Object.values(BudgetStatus).some((status) => status === value);
}

export function isBudgetLossReason(value: unknown): value is BudgetLossReason {
  return Object.values(BudgetLossReason).some((reason) => reason === value);
}
