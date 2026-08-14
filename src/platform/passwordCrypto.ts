import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";

interface ScryptPolicy {
  cost: number;
  blockSize: number;
  parallelization: number;
}

interface ParsedPasswordHash {
  policy: ScryptPolicy;
  salt: string;
  derivedKey: string;
}

export type PasswordValidationIssue = "too_short" | "too_long";

const currentPolicy: ScryptPolicy = { cost: 32_768, blockSize: 8, parallelization: 3 };
const legacyPolicy: ScryptPolicy = { cost: 16_384, blockSize: 8, parallelization: 1 };
const supportedPolicies = [currentPolicy, legacyPolicy];
const saltBytes = 16;
const keyBytes = 64;
const maximumMemoryBytes = 64 * 1_024 * 1_024;
const minimumPasswordCharacters = 15;
const maximumPasswordBytes = 1_024;
const unknownAccountSalt = Buffer.alloc(saltBytes).toString("base64url");

export const passwordValidationIssue = (password: string): PasswordValidationIssue | null => {
  if (Buffer.byteLength(password, "utf8") > maximumPasswordBytes) return "too_long";
  if ([...password].length < minimumPasswordCharacters) return "too_short";
  return null;
};

export const createPasswordHashSync = (password: string): string => {
  const salt = randomBytes(saltBytes).toString("base64url");
  return formatPasswordHash(currentPolicy, salt, derivePasswordKeySync(password, salt, currentPolicy));
};

export const createPasswordHash = async (password: string): Promise<string> => {
  const salt = randomBytes(saltBytes).toString("base64url");
  return formatPasswordHash(currentPolicy, salt, await derivePasswordKey(password, salt, currentPolicy));
};

export const verifyPasswordHashSync = (password: string, storedHash: string): boolean => {
  const parsed = parsePasswordHash(storedHash);
  if (parsed === null || passwordValidationIssue(password) === "too_long") return false;
  return keysMatch(derivePasswordKeySync(password, parsed.salt, parsed.policy), parsed.derivedKey);
};

export const verifyPasswordHash = async (password: string, storedHash: string): Promise<boolean> => {
  const parsed = parsePasswordHash(storedHash);
  if (parsed === null || passwordValidationIssue(password) === "too_long") return false;
  return keysMatch(await derivePasswordKey(password, parsed.salt, parsed.policy), parsed.derivedKey);
};

export const passwordHashNeedsRehash = (storedHash: string): boolean => {
  const parsed = parsePasswordHash(storedHash);
  return parsed === null || !policiesMatch(parsed.policy, currentPolicy);
};

export const consumeUnknownPasswordVerification = async (password: string): Promise<void> => {
  await derivePasswordKey(password, unknownAccountSalt, currentPolicy);
};

const formatPasswordHash = (policy: ScryptPolicy, salt: string, derivedKey: string): string => [
  "scrypt",
  String(policy.cost),
  String(policy.blockSize),
  String(policy.parallelization),
  salt,
  derivedKey,
].join("$");

const parsePasswordHash = (storedHash: string): ParsedPasswordHash | null => {
  const parts = storedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const policy = supportedPolicies.find(candidate =>
    parts[1] === String(candidate.cost)
    && parts[2] === String(candidate.blockSize)
    && parts[3] === String(candidate.parallelization));
  const salt = parts[4];
  const derivedKey = parts[5];
  if (policy === undefined || !isCanonicalBase64(salt, saltBytes) || !isCanonicalBase64(derivedKey, keyBytes)) {
    return null;
  }
  return { policy, salt, derivedKey };
};

const isCanonicalBase64 = (value: string | undefined, bytes: number): value is string => {
  if (value === undefined || !/^[A-Za-z0-9_-]+$/.test(value)) return false;
  const decoded = Buffer.from(value, "base64url");
  return decoded.length === bytes && decoded.toString("base64url") === value;
};

const scryptOptions = (policy: ScryptPolicy) => ({
  N: policy.cost,
  r: policy.blockSize,
  p: policy.parallelization,
  maxmem: maximumMemoryBytes,
});

const policiesMatch = (left: ScryptPolicy, right: ScryptPolicy): boolean =>
  left.cost === right.cost
  && left.blockSize === right.blockSize
  && left.parallelization === right.parallelization;

const derivePasswordKey = (password: string, salt: string, policy: ScryptPolicy): Promise<string> =>
  new Promise((resolve, reject) => {
    scrypt(password, salt, keyBytes, scryptOptions(policy), (error, derivedKey) => {
      if (error !== null) reject(error);
      else resolve(derivedKey.toString("base64url"));
    });
  });

const derivePasswordKeySync = (password: string, salt: string, policy: ScryptPolicy): string =>
  scryptSync(password, salt, keyBytes, scryptOptions(policy)).toString("base64url");

const keysMatch = (candidateKey: string, storedKey: string): boolean => {
  const candidate = Buffer.from(candidateKey, "base64url");
  const stored = Buffer.from(storedKey, "base64url");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
};
