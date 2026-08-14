import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("CLI player evidence coverage", () => {
  it("prints coverage gates for the prioritized evidence queue", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "evidence:coverage",
        "--",
        "--scenario=expected",
        "--limit=40",
        "--runs=2",
        "--seed-prefix=evidence-coverage-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const audit = JSON.parse(stdout) as {
      summary: {
        status: string;
        playerCount: number;
        highPriorityMissingCount: number;
        provenanceCompleteEvidenceRate: number;
      };
      gates: {
        summary: {
          status: string;
          gateCount: number;
        };
        items: {
          key: string;
          status: string;
        }[];
      };
      missingPlayers: {
        player: string;
      }[];
    };

    expect(audit.summary.playerCount).toBeGreaterThan(0);
    expect(audit.summary.status).toBe("fail");
    expect(audit.summary.highPriorityMissingCount).toBe(1);
    expect(audit.gates.summary).toMatchObject({
      status: "fail",
      gateCount: 4,
    });
    expect(audit.gates.items.map(gate => gate.key)).toEqual([
      "high-priority-missing",
      "evidence-coverage-rate",
      "complete-evidence-rate",
      "evidence-provenance-rate",
    ]);
    expect(audit.summary.provenanceCompleteEvidenceRate).toBe(1);
    expect(audit.missingPlayers.map(player => player.player)).toEqual([
      "Jaxon Smith-Njigba",
      "Bucky Irving",
    ]);
  }, 15000);

  it("keeps downstream coverage audits raw when default evidence is disabled", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "evidence:coverage",
        "--",
        "--scenario=expected",
        "--limit=40",
        "--runs=2",
        "--seed-prefix=evidence-coverage-test",
        "--no-default-evidence",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const audit = JSON.parse(stdout) as {
      summary: {
        status: string;
        highPriorityMissingCount: number;
        evidenceRowCount: number;
      };
      missingPlayers: {
        player: string;
      }[];
    };

    expect(audit.summary.status).toBe("fail");
    expect(audit.summary.highPriorityMissingCount).toBeGreaterThan(0);
    expect(audit.summary.evidenceRowCount).toBe(0);
    expect(audit.missingPlayers.some(player => player.player === "Drake London")).toBe(true);
  }, 15000);
});
