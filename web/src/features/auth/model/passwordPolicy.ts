export const minimumPasswordCharacters = 6;
export const passwordInputPattern = String.raw`(?=.*[0-9])(?=.*[\p{P}\p{S}]).{6,}`;
export const passwordRequirements =
  "Use at least 6 characters, including a number (0–9) and a punctuation or symbol character.";
