export const salesCadence = [
  { day: 2, message: 'Primer contacto de seguimiento · 48 horas.' },
  { day: 7, message: 'Segundo seguimiento comercial.' },
  { day: 14, message: 'Tercer seguimiento comercial.' },
  { day: 21, message: 'Cuarto seguimiento comercial.' },
  { day: 30, message: 'Quinto seguimiento comercial.' },
  { day: 45, message: 'Sexto seguimiento comercial.' },
  { day: 60, message: 'Séptimo seguimiento comercial.' }
] as const;

const dayInMilliseconds = 24 * 60 * 60 * 1000;

export type CadenceItem = {
  id: string;
  dueAt: Date;
  cadenceOffsetDays: number;
};

export function shiftCadenceDate(dueAt: Date, deltaMilliseconds: number) {
  return new Date(dueAt.getTime() + deltaMilliseconds);
}

export function rebaseCadenceDates<T extends CadenceItem>(
  completedAt: Date,
  completedOffsetDays: number,
  upcoming: T[]
) {
  return upcoming.map((item) => ({
    id: item.id,
    previousDueAt: item.dueAt,
    newDueAt: new Date(
      completedAt.getTime() +
      (item.cadenceOffsetDays - completedOffsetDays) * dayInMilliseconds
    )
  }));
}
