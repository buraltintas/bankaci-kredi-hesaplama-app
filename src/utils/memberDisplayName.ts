export const memberDisplayName = (displayName: string, email: string): string => {
  const customName = displayName.trim();
  if (customName) return customName;

  return email.split('@', 1)[0]?.trim() || 'Bankacı';
};
