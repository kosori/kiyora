/** One board's last change, as a library row shows it. */
export const changedAt = (updatedAt: number): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(updatedAt);
