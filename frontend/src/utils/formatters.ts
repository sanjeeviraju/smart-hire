export function formatExp(exp: number | null | undefined): string {
  if (!exp || exp === 0) return 'Fresher';

  const totalMonths = Math.round(exp * 12);

  if (totalMonths < 6) return 'Fresher';
  if (totalMonths < 12) return `${totalMonths} months`;

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  if (months === 0) return years === 1 ? '1 year' : `${years} years`;
  return months === 1 ? `${years} yr ${months} mo` : `${years} yr ${months} mos`;
}
