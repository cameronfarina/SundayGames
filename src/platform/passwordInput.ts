import { StringDecoder } from "node:string_decoder";

export interface PasswordInput extends AsyncIterable<string | Uint8Array> {
  isTTY?: boolean;
}

const maximumPasswordInputBytes = 4_096;

export const readSinglePassword = async (stdin: PasswordInput): Promise<string> => {
  if (stdin.isTTY === true) throw new Error("Interactive input is not supported.");

  const decoder = new StringDecoder("utf8");
  let input = "";
  let inputBytes = 0;

  for await (const chunk of stdin) {
    inputBytes += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.byteLength;
    if (inputBytes > maximumPasswordInputBytes) throw new Error("Password input is too large.");
    input += typeof chunk === "string"
      ? chunk
      : decoder.write(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
  }
  input += decoder.end();

  const password = input.endsWith("\r\n")
    ? input.slice(0, -2)
    : input.endsWith("\n")
      ? input.slice(0, -1)
      : input;
  if (password.length === 0 || password.includes("\n") || password.includes("\r")) {
    throw new Error("Exactly one non-empty line is required.");
  }

  return password;
};
