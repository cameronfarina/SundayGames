import { readFile } from "node:fs/promises";
import * as Ajv2020Module from "ajv/dist/2020.js";
import * as addFormatsModule from "ajv-formats";
import { parse } from "yaml";

const [schemaPath, blueprintPath = "render.yaml", ...extraArguments] = process.argv.slice(2);
if (schemaPath === undefined || extraArguments.length > 0) {
  throw new Error(
    "Usage: tsx scripts/validate-render-blueprint.ts <render-schema.json> [render.yaml]",
  );
}

const schema = JSON.parse(await readFile(schemaPath, "utf8")) as object;
const blueprint = parse(await readFile(blueprintPath, "utf8")) as unknown;
const ajv = new Ajv2020Module.Ajv2020({ allErrors: true, strict: false });
const addFormats = addFormatsModule.default as unknown as (instance: Ajv2020Module.Ajv2020) => void;
addFormats(ajv);
const validate = ajv.compile(schema);

if (!validate(blueprint)) {
  throw new Error(`Invalid Render Blueprint:\n${ajv.errorsText(validate.errors, { separator: "\n" })}`);
}

console.log(`${blueprintPath} is valid against ${schemaPath}.`);
