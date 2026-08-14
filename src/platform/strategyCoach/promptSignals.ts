export const desiredWrCountFrom = (promptText: string): number | undefined => {
  const match = /\b(?:i\s+)?(?:want|need|draft|get)\s+(\d+)\s+(?:(?:good|starting|value|high[-\s]floor|solid)\s+)*wrs?\b/i
    .exec(promptText);
  if (!match?.[1]) return undefined;

  const count = Number(match[1]);
  return Number.isInteger(count) && count > 0 ? count : undefined;
};

export const globalMaxPriceFrom = (promptText: string): number | undefined => {
  const match = /\b(?:no|without|avoid)\s+(?:players?|one|anyone)\s+(?:over|above)\s*\$?(\d+)\b/i.exec(promptText);
  if (!match?.[1]) return undefined;

  const price = Number(match[1]);
  return Number.isInteger(price) && price >= 0 ? price : undefined;
};

export const hasAvoidEliteIntent = (promptText: string): boolean =>
  /\b(?:nothing\s+elite|not\s+(?:looking\s+for\s+)?elite|avoid\s+elite|no\s+elite|good\s+but\s+not\s+great)\b/i
    .test(promptText);

export const hasValueIntent = (promptText: string): boolean =>
  /\b(?:balanced|value|wait\s+later|high[-\s]floor|good\s+wrs?|spend\s+their\s+money)\b/i
    .test(promptText);

export const globalMaxExcludesKeeperFrom = (promptText: string): boolean =>
  /\b(?:besides|except)\s+(?:my\s+)?keeper\b/i.test(promptText);

export const rb2WindowFrom = (promptText: string): string => {
  const lowerPrompt = promptText.toLowerCase();
  const rb2Index = lowerPrompt.indexOf("rb2");
  if (rb2Index === -1) return "";

  const wrIndex = lowerPrompt.indexOf("for wr", rb2Index);
  const endIndex = wrIndex === -1 ? Math.min(promptText.length, rb2Index + 320) : wrIndex;

  return promptText.slice(rb2Index, endIndex);
};
