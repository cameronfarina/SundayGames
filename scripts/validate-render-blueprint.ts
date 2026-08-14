import { readFile } from "node:fs/promises";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parse } from "yaml";

const defaultSchemaPath = "scripts/render-blueprint.schema.json";
const [
  schemaPath = defaultSchemaPath,
  blueprintPath = "render.yaml",
  ...extraArguments
] = process.argv.slice(2);

if (extraArguments.length > 0) {
  throw new Error(
    "Usage: tsx scripts/validate-render-blueprint.ts [render-schema.json] [render.yaml]",
  );
}

const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const blueprint = parse(await readFile(blueprintPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addFormat("uri", value => URL.canParse(value));
const validate = ajv.compile(schema);

if (!validate(blueprint)) {
  throw new Error(`Invalid Render Blueprint:\n${ajv.errorsText(validate.errors, { separator: "\n" })}`);
}

console.log(`${blueprintPath} is valid against ${schemaPath}.`);
