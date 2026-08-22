export const isAllowedSundayGamesUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    if (url.origin === "https://sundaygames.io") return true;
    return url.protocol === "http:"
      && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
};
