export const formatNewsTimestamp = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return undefined;
  const day = date.toLocaleDateString();
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .replace(" ", "")
    .toLowerCase();
  return `${day}, ${time}`;
};
