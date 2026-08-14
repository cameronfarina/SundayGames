import { parseProductionProvisioningDocument } from "../productionProvisioning.js";
import { buildProductionProvisioningDocument } from "./buildDocument.js";
import { buildProvisioningCatalog } from "./catalog.js";
import { validateProductionOwnerAccountMapping } from "./parseMappingDocument.js";

export const generateProductionProvisioningDocument = async (
  input: unknown,
): Promise<string> => {
  const mapping = validateProductionOwnerAccountMapping(input);
  const catalog = await buildProvisioningCatalog();
  const rawDocument = buildProductionProvisioningDocument(mapping, catalog);
  const content = `${JSON.stringify(rawDocument, null, 2)}\n`;
  parseProductionProvisioningDocument(content);
  return content;
};
