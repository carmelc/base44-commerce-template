#!/usr/bin/env node
/**
 * Base44 Commerce Template — static installer.
 *
 * Assumes this entire template repository has been copied into the target
 * Base44 app at `<app-root>/examples/commerce/`, so this script runs from
 * `<app-root>/examples/commerce/scripts/`. From the app root:
 *
 *   node examples/commerce/scripts/install.js
 *
 * It copies the template's static file set into the app. Paths are relative
 * to this script's folder — the template root is `..` and the app root is
 * `../../..` (scripts → commerce → examples → app root):
 *
 *   ../base44/entities/commerce.*.jsonc  →  ../../../base44/entities/
 *   ../base44/functions/commerce/        →  ../../../base44/functions/commerce/
 *   ../base44/shared/commerce/           →  ../../../base44/shared/commerce/
 *   ../src/commerce/admin/               →  ../../../src/commerce/admin/
 *
 * Merge semantics: directories are merged — files owned by the template are
 * overwritten (so re-running after a template update is safe), everything
 * else in the app is left untouched.
 *
 * This is only the static part of the install. The remaining steps (deps,
 * mounting the /admin route, admin role, seeding) are described in
 * ../installation-guidelines.md; post-install guidance lives in
 * ../implementation-guidelines.md.
 *
 * Written with dynamic import() and process.argv[1] (instead of require/
 * __dirname) so it runs unchanged whether the host app's package.json is
 * CommonJS or "type": "module".
 */

(async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");

  const fail = (msg) => {
    console.error(`install.js: ${msg}`);
    process.exit(1);
  };

  const scriptArg = process.argv[1];
  if (!scriptArg) fail("cannot determine the script location (run as: node examples/commerce/scripts/install.js)");
  const scriptDir = path.dirname(path.resolve(scriptArg));
  const templateRoot = path.resolve(scriptDir, "..");        // <app>/examples/commerce
  const appRoot = path.resolve(scriptDir, "..", "..", ".."); // <app>

  // ── sanity checks ──────────────────────────────────────────────────────────
  const entitiesSrc = path.join(templateRoot, "base44", "entities");
  if (!fs.existsSync(entitiesSrc)) {
    fail(`template assets not found at ${path.join(templateRoot, "base44")} — is the repo intact?`);
  }
  if (!fs.existsSync(path.join(appRoot, "package.json"))) {
    fail(
      `no package.json at ${appRoot} — expected the template at <app-root>/examples/commerce/ ` +
      `so that the app root is three levels above this script's folder.`
    );
  }
  const relToApp = path.relative(appRoot, templateRoot).split(path.sep).join("/");
  if (relToApp !== "examples/commerce") {
    console.warn(
      `install.js: warning — template is installed at "${relToApp}" instead of "examples/commerce"; ` +
      `proceeding, but doc references assume examples/commerce.`
    );
  }

  // ── copy helpers (merge: overwrite template-owned files, keep the rest) ───
  let filesCopied = 0;
  const copyFile = (src, dest) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    filesCopied += 1;
  };
  const copyDir = (src, dest) => {
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, entry.name);
      const d = path.join(dest, entry.name);
      if (entry.isDirectory()) copyDir(s, d);
      else copyFile(s, d);
    }
  };

  // ── the static installation ───────────────────────────────────────────────
  const entityFiles = fs
    .readdirSync(entitiesSrc)
    .filter((n) => n.startsWith("commerce.") && n.endsWith(".jsonc"));
  if (entityFiles.length === 0) fail(`no commerce.*.jsonc entity schemas found in ${entitiesSrc}`);
  for (const name of entityFiles) {
    copyFile(path.join(entitiesSrc, name), path.join(appRoot, "base44", "entities", name));
  }
  console.log(`✓ entities   ${entityFiles.length} commerce.*.jsonc schemas → base44/entities/`);

  const dirJobs = [
    { label: "functions", from: ["base44", "functions", "commerce"], to: ["base44", "functions", "commerce"] },
    { label: "shared", from: ["base44", "shared", "commerce"], to: ["base44", "shared", "commerce"] },
    { label: "admin UI", from: ["src", "commerce", "admin"], to: ["src", "commerce", "admin"] },
  ];
  for (const job of dirJobs) {
    const src = path.join(templateRoot, ...job.from);
    if (!fs.existsSync(src)) fail(`missing template directory: ${src}`);
    const before = filesCopied;
    copyDir(src, path.join(appRoot, ...job.to));
    console.log(`✓ ${job.label.padEnd(10)} ${filesCopied - before} files → ${job.to.join("/")}/`);
  }

  console.log(`\nDone — ${filesCopied} files installed into ${appRoot}`);
  console.log(
    "\nNext steps (see examples/commerce/installation-guidelines.md):\n" +
    "  1. npm i sonner recharts (if not already present)\n" +
    '  2. Mount the admin router: <Route path="/admin/*" element={<AdminApp />} />\n' +
    "  3. Grant your user the admin role, open /admin and initialize store defaults\n" +
    "  4. Register the template in AGENTS.md (see implementation-guidelines.md §1)"
  );
})();
