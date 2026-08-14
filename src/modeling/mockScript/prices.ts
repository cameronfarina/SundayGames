const normalizedPriceSpec = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\$/g, "")
    .replace(/\s+(?:by|step)\s+/g, ":")
    .replace(/\s+to\s+/g, "-")
    .replace(/\b(?:a|an|the|price|band|range|sweep|dollars?)\b/g, "")
    .replace(/\s+/g, "");

export const pricesFromSpec = (value: string): number[] | undefined => {
  const spec = normalizedPriceSpec(value);
  const rangeMatch = /^(\d+)-(\d+)(?::(\d+))?$/.exec(spec);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    const step = Number(rangeMatch[3] ?? 1);
    if (
      !Number.isInteger(start) || !Number.isInteger(end) || !Number.isInteger(step) ||
      start < 1 || end < start || step < 1
    ) return undefined;

    const prices: number[] = [];
    for (let price = start; price <= end; price += step) prices.push(price);
    return prices;
  }

  const prices = spec
    .split(/[,/]+/)
    .map(part => Number(part))
    .filter(price => Number.isInteger(price) && price >= 1);
  return prices.length > 0 ? [...new Set(prices)] : undefined;
};
