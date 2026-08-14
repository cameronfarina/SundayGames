# Render Blueprint Schema

`render-blueprint.schema.json` is a vendored copy of Render's public Blueprint schema:

- Source: `https://render.com/schema/render.yaml.json`
- Retrieved: 2026-08-13
- SHA-256: `665539cb0c191856ba38d292b985a963880bb69b030d666e5fe7788e78e7e696`

Normal validation must use this checked-in copy. This keeps local development and CI deterministic and avoids making a mutable provider endpoint part of every build.

To evaluate a provider update, download it explicitly, review its diff, validate the repository Blueprint with the validator's schema override, and commit the schema plus the new SHA-256 together. Do not refresh it implicitly in CI.
