import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";

export interface PlatformBrowserAsset {
  readonly body: Buffer;
  readonly cacheControl: string;
  readonly contentType: string;
}

export interface PlatformStaticWebAssets {
  readonly files: ReadonlyMap<string, PlatformBrowserAsset>;
  readonly indexHtml: string;
}

const immutableCacheControl = "public, max-age=31536000, immutable";

const contentTypes = new Map<string, string>([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

const contentTypeFor = (filePath: string): string =>
  contentTypes.get(extname(filePath).toLowerCase()) ?? "application/octet-stream";

const collectFiles = async (directory: string): Promise<readonly string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(entries.map(async entry => {
    const entryPath = join(directory, entry.name);
    return entry.isDirectory() ? await collectFiles(entryPath) : [entryPath];
  }));

  return paths.flat();
};

const publicPathFor = (rootDirectory: string, filePath: string): string =>
  `/${relative(rootDirectory, filePath).split(sep).join("/")}`;

export const loadPlatformStaticWebAssets = async (
  rootDirectory: string,
): Promise<PlatformStaticWebAssets> => {
  const indexHtml = await readFile(join(rootDirectory, "index.html"), "utf8");
  const filePaths = await collectFiles(rootDirectory);
  const files = new Map<string, PlatformBrowserAsset>();

  await Promise.all(filePaths.map(async filePath => {
    const publicPath = publicPathFor(rootDirectory, filePath);
    if (publicPath === "/index.html") return;
    files.set(publicPath, {
      body: await readFile(filePath),
      cacheControl: immutableCacheControl,
      contentType: contentTypeFor(filePath),
    });
  }));

  return { files, indexHtml };
};
