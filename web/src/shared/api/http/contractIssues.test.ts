import { z } from "zod";
import { describe, expect, it } from "vitest";
import { contractIssues } from "./contractIssues";

const issuesFrom = (schema: z.ZodType, value: unknown) => {
  const parsed = schema.safeParse(value);
  if (parsed.success) throw new Error("Expected the value to fail its schema.");
  return contractIssues(parsed.error);
};

describe("contractIssues", () => {
  it("names a nested field by its dotted path", () => {
    const schema = z.object({ account: z.object({ id: z.string() }) });

    expect(issuesFrom(schema, { account: {} }).map(issue => issue.path)).toEqual(["account.id"]);
  });

  it("carries the validator's own words about what was wrong", () => {
    const schema = z.object({ account: z.object({ id: z.string() }) });
    const [issue] = issuesFrom(schema, { account: {} });

    expect(issue?.message.length).toBeGreaterThan(0);
  });

  it("numbers a fault inside an array", () => {
    const schema = z.object({ ids: z.array(z.string()) });

    expect(issuesFrom(schema, { ids: ["ok", 2] }).map(issue => issue.path)).toEqual(["ids.1"]);
  });

  it("leaves the path empty for a fault in the value itself", () => {
    const schema = z.object({ total: z.number() }).refine(value => value.total > 0);

    expect(issuesFrom(schema, { total: 0 }).map(issue => issue.path)).toEqual([""]);
  });

  it("reports every fault, not just the first", () => {
    const schema = z.object({ a: z.string(), b: z.string() });

    expect(issuesFrom(schema, {}).map(issue => issue.path)).toEqual(["a", "b"]);
  });

  it("renders a symbol segment instead of throwing over the failure", () => {
    const key = Symbol("secret");
    const schema = z.custom<unknown>(() => false, { path: [key], message: "no" });

    expect(issuesFrom(schema, {}).map(issue => issue.path)).toEqual(["Symbol(secret)"]);
  });
});
