const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const startOfLocalDay = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

export const daysInMonth = (year: number, monthIndex: number): number => {
  return new Date(year, monthIndex + 1, 0).getDate();
};

export const addMonths = (date: Date, months: number): Date => {
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth() + months;
  const targetDay = date.getDate();
  const lastDay = daysInMonth(targetYear, targetMonth);

  return new Date(targetYear, targetMonth, Math.min(targetDay, lastDay));
};

export const daysBetween = (fromDate: Date, toDate: Date): number => {
  const fromUtc = Date.UTC(
    fromDate.getFullYear(),
    fromDate.getMonth(),
    fromDate.getDate()
  );
  const toUtc = Date.UTC(
    toDate.getFullYear(),
    toDate.getMonth(),
    toDate.getDate()
  );

  return Math.round((toUtc - fromUtc) / MS_PER_DAY);
};

export const formatDate = (date: Date): string => {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime())
    ? date
    : new Date();
  const day = String(safeDate.getDate()).padStart(2, '0');
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const year = safeDate.getFullYear();

  return `${day}.${month}.${year}`;
};

export const formatDateForFileName = (date: Date): string => {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime())
    ? date
    : new Date();
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const day = String(safeDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const parseTurkishDate = (value: string): Date | null => {
  const match = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const year = Number(match[3]);
  const parsed = startOfLocalDay(new Date(year, monthIndex, day));

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};
