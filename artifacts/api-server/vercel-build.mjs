import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { build as esbuild } from "esbuild";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(artifactDir, "../..");
const outRoot = path.join(repoRoot, ".vercel/output");
const funcDir = path.join(outRoot, "functions/api/index.func");
const staticDir = path.join(outRoot, "static");
const siteDist = path.join(repoRoot, "artifacts/gridora/dist/public");

await rm(outRoot, { recursive: true, force: true });
await mkdir(funcDir, { recursive: true });

await esbuild({
  entryPoints: [path.join(artifactDir, "src/vercel.ts")],
  platform: "node",
  bundle: true,
  format: "esm",
  outdir: funcDir,
  outExtension: { ".js": ".mjs" },
  entryNames: "index",
  logLevel: "info",
  external: ["pg-native"],
  banner: {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';
globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
`,
  },
});

await writeFile(
  path.join(funcDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      supportsResponseStreaming: true,
    },
    null,
    2,
  ),
);
await writeFile(
  path.join(funcDir, "package.json"),
  JSON.stringify({ type: "module" }),
);

await cp(siteDist, staticDir, { recursive: true });

await writeFile(
  path.join(outRoot, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "/api/(.*)", dest: "/api/index" },
        { handle: "filesystem" },
        { src: "/(.*)", dest: "/index.html" },
      ],
    },
    null,
    2,
  ),
);

console.log("Vercel output ready in .vercel/output");
