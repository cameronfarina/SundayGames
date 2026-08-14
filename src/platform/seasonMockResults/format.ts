export const rounded = (value: number): number => Math.round(value * 10) / 10;

export const isStarterSlot = (slot: string): boolean => !/^(BENCH|IR)\d*$/u.test(slot);
