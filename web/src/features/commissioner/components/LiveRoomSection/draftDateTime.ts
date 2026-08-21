const MILLISECONDS_PER_MINUTE = 60_000;

export const isoInstantToDateTimeLocal = (instant: string): string => {
  const date = new Date(instant);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * MILLISECONDS_PER_MINUTE);
  return localDate.toISOString().slice(0, 16);
};

export const dateTimeLocalToIsoInstant = (
  localDateTime: string,
  originalInstant?: string,
): string => {
  if (
    originalInstant !== undefined
    && isoInstantToDateTimeLocal(originalInstant) === localDateTime
  ) {
    return originalInstant;
  }

  const instant = new Date(localDateTime).toISOString();
  if (isoInstantToDateTimeLocal(instant) !== localDateTime) {
    throw new Error(
      `That time does not exist in ${browserTimeZone()} because the clocks change. Choose another time.`,
    );
  }

  return instant;
};

export const browserTimeZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;
