export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getMonthMatrix(activeMonth: Date): Array<Date | null> {
  const year = activeMonth.getFullYear();
  const month = activeMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const mondayBasedStart = (firstDay.getDay() + 6) % 7;
  const days: Array<Date | null> = [];

  for (let i = 0; i < mondayBasedStart; i += 1) {
    days.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(year, month, day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

export function getMonthRange(activeMonth: Date): { start: string; end: string } {
  const start = toDateKey(new Date(activeMonth.getFullYear(), activeMonth.getMonth(), 1));
  const end = toDateKey(new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 0));
  return { start, end };
}

export function formatMonth(activeMonth: Date): string {
  return activeMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

export function formatDisplayDate(dateKey: string): string {
  return fromDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
