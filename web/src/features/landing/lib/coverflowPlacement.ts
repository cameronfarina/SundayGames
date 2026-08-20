/**
 * Where a carousel card sits relative to the card the viewer is looking at.
 * The stylesheet turns each placement into a transform, so the component never
 * computes pixel offsets and the phone layout can move the cards on its own.
 */
export type CoverflowPlacement =
  | "center"
  | "far-next"
  | "far-previous"
  | "next"
  | "previous";

export const coverflowPlacement = (index: number, activeIndex: number): CoverflowPlacement => {
  const step = index - activeIndex;
  if (step === 0) return "center";
  if (step === -1) return "previous";
  if (step === 1) return "next";
  return step < 0 ? "far-previous" : "far-next";
};

/** The first and last cards always stay in a side slot, so the centre card keeps a neighbour. */
export const firstActiveIndex = 1;

export const lastActiveIndex = (count: number): number => count - 2;
