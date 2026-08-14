export const maybeUnref = (timer: ReturnType<typeof setTimeout>): void => {
  if (
    typeof timer === "object" && timer !== null && "unref" in timer &&
    typeof timer.unref === "function"
  ) timer.unref();
};
