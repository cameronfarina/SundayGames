const csvEscape = (value: string): string =>
  /[",\n\r]/.test(value) ? `"${value.replaceAll("\"", "\"\"")}"` : value;

export const liveDraftCommandsCsv = (commands: readonly string[]): string =>
  `index,command\n${commands.map((command, index) => `${index + 1},${csvEscape(command)}`).join("\n")}\n`;

export const parseCsvRows = (content: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (inQuotes) {
      if (character === "\"" && content[index + 1] === "\"") {
        field += "\"";
        index += 1;
      } else if (character === "\"") {
        inQuotes = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === "\"") {
      inQuotes = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(candidate => candidate.some(fieldValue => fieldValue.trim()));
};
