import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { ownerOrder, type Owner } from "../config/league.js";
import { loadCurrentPlayerCatalog } from "../src/platform/localDemoFixtures.js";
import {
  generateProductionProvisioningDocument,
  parseProductionOwnerAccountMappingDocument,
  type ProductionOwnerAccountMapping,
} from "../src/platform/generateProductionProvisioning.js";
import { parseProductionProvisioningDocument } from "../src/platform/productionProvisioning.js";

const passwordHashEnvFor = (owner: Owner): string =>
  `MOCKD_PROVISION_${owner.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_PASSWORD_HASH`;

const ownerMapping = (owner: Owner): ProductionOwnerAccountMapping => ({
  owner,
  email: `${owner.toLowerCase()}@example.com`,
  passwordHashEnv: passwordHashEnvFor(owner),
});

const completeInput = () => ({
  commissionerOwner: "Owner11",
  owners: ownerOrder.map(ownerMapping),
  selectedKeepers: keepers
    .filter(keeper => keeper.status === "confirmed")
    .map(keeper => ({ owner: keeper.owner, player: keeper.player })),
});

describe("production provisioning document generator", () => {
  it("generates the configured production league, complete catalog, and explicitly selected keepers", async () => {
    const content = await generateProductionProvisioningDocument(completeInput());
    const currentCatalog = await loadCurrentPlayerCatalog();
    const selectedKeepers = keepers.filter(keeper => keeper.status === "confirmed");
    const document = parseProductionProvisioningDocument(content);

    expect(document.accounts).toHaveLength(ownerOrder.length);
    expect(document.memberships).toHaveLength(ownerOrder.length);
    expect(document.season.teams).toHaveLength(ownerOrder.length);
    expect(document.catalog.map(player => player.name)).toEqual(currentCatalog.map(player => player.name));
    expect(document.catalog).toHaveLength(currentCatalog.length);
    expect(document.keepers).toHaveLength(selectedKeepers.length);
    expect(document.initialRosters).toHaveLength(selectedKeepers.length);
    expect(document.initialRosters.map(player => player.playerName)).toEqual(
      selectedKeepers.map(keeper => keeper.player),
    );
    expect(new Set(document.catalog.map(player => player.playerId)).size).toBe(document.catalog.length);
    expect(new Set(document.keepers.map(keeper => keeper.playerId))).toEqual(
      new Set(document.initialRosters.map(player => player.playerId)),
    );
  });

  it("produces byte-identical output and IDs regardless of mapping order", async () => {
    const input = completeInput();
    const forward = await generateProductionProvisioningDocument(input);
    const reversed = await generateProductionProvisioningDocument({
      ...input,
      owners: [...input.owners].reverse(),
      selectedKeepers: [...input.selectedKeepers].reverse(),
    });

    expect(reversed).toBe(forward);
  });

  it("does not roster unreviewed assumed keepers", async () => {
    const document = parseProductionProvisioningDocument(
      await generateProductionProvisioningDocument(completeInput()),
    );
    const assumedPlayerNames = keepers
      .filter(keeper => keeper.status === "assumed")
      .map(keeper => keeper.player);

    expect(document.initialRosters.map(player => player.playerName))
      .not.toEqual(expect.arrayContaining(assumedPlayerNames));
    expect(document.keepers).toHaveLength(keepers.filter(keeper => keeper.status === "confirmed").length);
  });

  it("includes an assumed keeper only when explicitly selected", async () => {
    const input = completeInput();
    const document = parseProductionProvisioningDocument(
      await generateProductionProvisioningDocument({
        ...input,
        selectedKeepers: [
          ...input.selectedKeepers,
          { owner: "Owner09", player: "Trey McBride" },
        ],
      }),
    );

    expect(document.initialRosters).toContainEqual(expect.objectContaining({
      playerName: "Trey McBride",
      price: 10,
      source: "keeper",
    }));
    expect(document.keepers).toContainEqual(expect.objectContaining({
      playerId: document.initialRosters.find(player => player.playerName === "Trey McBride")?.playerId,
      keeperCost: 10,
      previousCost: 8,
      status: "published",
    }));
  });

  it("requires an explicit keeper selection", async () => {
    const { selectedKeepers: _selectedKeepers, ...input } = completeInput();

    await expect(generateProductionProvisioningDocument(input))
      .rejects.toThrow(/selectedKeepers.*expected an array/i);
  });

  it("rejects duplicate and unknown keeper selections", async () => {
    const input = completeInput();
    const selectedKeeper = input.selectedKeepers[0];
    if (selectedKeeper === undefined) throw new Error("Expected a selected keeper test fixture.");

    await expect(generateProductionProvisioningDocument({
      ...input,
      selectedKeepers: [...input.selectedKeepers, selectedKeeper],
    })).rejects.toThrow(/duplicate keeper selection/i);
    await expect(generateProductionProvisioningDocument({
      ...input,
      selectedKeepers: [
        ...input.selectedKeepers,
        { owner: "Owner11", player: "Not A Configured Keeper" },
      ],
    })).rejects.toThrow(/does not exactly match a configured keeper/i);
  });

  it("includes environment variable references without accepting password hashes", async () => {
    const content = await generateProductionProvisioningDocument(completeInput());
    const document = parseProductionProvisioningDocument(content);

    expect(document.accounts.map(account => account.passwordHashEnv)).toEqual(
      ownerOrder.map(passwordHashEnvFor),
    );
    expect(content).not.toContain('"passwordHash":');

    const inputWithSecret = completeInput();
    await expect(generateProductionProvisioningDocument({
      ...inputWithSecret,
      owners: inputWithSecret.owners.map((mapping, index) => index === 0
        ? { ...mapping, passwordHash: "must-not-be-accepted" }
        : mapping),
    })).rejects.toThrow(/unexpected field.*passwordHash/i);
  });

  it("parses, normalizes, and canonically orders an owner mapping document", () => {
    const input = completeInput();
    const parsed = parseProductionOwnerAccountMappingDocument(JSON.stringify({
      ...input,
      owners: [...input.owners].reverse().map(mapping => ({
        ...mapping,
        email: mapping.email.toUpperCase(),
      })),
      selectedKeepers: [...input.selectedKeepers].reverse(),
    }));

    expect(parsed.owners.map(mapping => mapping.owner)).toEqual(ownerOrder);
    expect(parsed.owners.map(mapping => mapping.email)).toEqual(ownerOrder.map(owner =>
      `${owner.toLowerCase()}@example.com`
    ));
    expect(parsed.selectedKeepers).toEqual(input.selectedKeepers);
  });

  it("rejects malformed mapping JSON without echoing its content", () => {
    const secret = "do-not-echo-this-secret";
    expect(() => parseProductionOwnerAccountMappingDocument(`{${secret}`))
      .toThrow("Invalid production owner/account mapping at $: expected valid JSON.");
    try {
      parseProductionOwnerAccountMappingDocument(`{${secret}`);
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });

  it("rejects missing and unknown configured owners", async () => {
    const input = completeInput();

    await expect(generateProductionProvisioningDocument({
      ...input,
      owners: input.owners.slice(1),
    })).rejects.toThrow(/missing configured owner Owner01/i);
    await expect(generateProductionProvisioningDocument({
      ...input,
      owners: input.owners.map((mapping, index) => index === 0
        ? { ...mapping, owner: "Not In This League" }
        : mapping),
    })).rejects.toThrow(/unknown configured owner/i);
  });

  it.each([
    ["owner", (input: ReturnType<typeof completeInput>) => ({
      ...input,
      owners: input.owners.map((mapping, index) => index === 1
        ? { ...mapping, owner: input.owners[0]?.owner }
        : mapping),
    })],
    ["email", (input: ReturnType<typeof completeInput>) => ({
      ...input,
      owners: input.owners.map((mapping, index) => index === 1
        ? { ...mapping, email: input.owners[0]?.email.toUpperCase() }
        : mapping),
    })],
    ["passwordHashEnv", (input: ReturnType<typeof completeInput>) => ({
      ...input,
      owners: input.owners.map((mapping, index) => index === 1
        ? { ...mapping, passwordHashEnv: input.owners[0]?.passwordHashEnv }
        : mapping),
    })],
  ])("rejects duplicate %s mappings", async (_field, duplicateInputFor) => {
    await expect(generateProductionProvisioningDocument(duplicateInputFor(completeInput())))
      .rejects.toThrow(/duplicate/i);
  });

  it("rejects incomplete records and fixture markers", async () => {
    const input = completeInput();

    await expect(generateProductionProvisioningDocument({
      ...input,
      owners: input.owners.map((mapping, index) => index === 0
        ? { owner: mapping.owner, email: mapping.email }
        : mapping),
    })).rejects.toThrow(/passwordHashEnv/i);
    await expect(generateProductionProvisioningDocument({
      ...input,
      owners: input.owners.map(mapping => mapping.owner === "Owner11"
        ? { ...mapping, email: "commissioner@mockd.local" }
        : mapping),
    })).rejects.toThrow(/local E2E fixture marker/i);
  });
});
