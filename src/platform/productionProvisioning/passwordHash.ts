interface SupportedScryptPolicy {
  cost: string;
  blockSize: string;
  parallelization: string;
}

const supportedPolicies: readonly SupportedScryptPolicy[] = [
  { cost: "32768", blockSize: "8", parallelization: "3" },
  { cost: "16384", blockSize: "8", parallelization: "1" },
];
const saltBytes = 16;
const keyBytes = 64;

const isCanonicalBase64Url = (value: string | undefined, bytes: number): value is string => {
  if (value === undefined || !/^[A-Za-z0-9_-]+$/.test(value)) return false;
  const decoded = Buffer.from(value, "base64url");
  return decoded.length === bytes && decoded.toString("base64url") === value;
};

export const isSupportedPasswordHash = (passwordHash: string): boolean => {
  const parts = passwordHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const supported = supportedPolicies.some(policy =>
    parts[1] === policy.cost
    && parts[2] === policy.blockSize
    && parts[3] === policy.parallelization);
  return supported
    && isCanonicalBase64Url(parts[4], saltBytes)
    && isCanonicalBase64Url(parts[5], keyBytes);
};
