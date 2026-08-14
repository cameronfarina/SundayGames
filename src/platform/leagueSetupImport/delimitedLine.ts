export const parseDelimitedLine = (
  line: string,
  delimiter: "," | "|",
  rowNumber: number,
): string[] => {
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === "\"" && inQuotes && nextCharacter === "\"") {
      cell += "\"";
      index += 1;
      continue;
    }

    if (character === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === delimiter && !inQuotes) {
      cells.push(cell.trim());
      cell = "";
      continue;
    }

    cell += character;
  }

  if (inQuotes) {
    throw new Error(`Unterminated quoted field in league setup import row ${rowNumber}.`);
  }

  cells.push(cell.trim());
  return cells;
};

export const hasUnquotedPipe = (line: string): boolean => {
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === "\"" && inQuotes && nextCharacter === "\"") {
      index += 1;
      continue;
    }

    if (character === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "|" && !inQuotes) return true;
  }

  return false;
};
