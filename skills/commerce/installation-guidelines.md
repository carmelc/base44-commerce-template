# Installation Guidelines

How to install the Base44 Commerce Template into an existing Base44 app. This file lives inside the **commerce skill** folder and is installed into the app at `skills/commerce/installation-guidelines.md`. Once the files are in place, continue with [`post-installation.md`](./post-installation.md) (embedding the admin pages, `AGENTS.md` registration); day-2 guidance lives in [`skills/commerce/SKILL.md`](./SKILL.md), alongside the API references in [`skills/commerce/docs/`](./docs/).

> **If you are a Base44 agent working inside the runtime, read this first:**
> - **Skip the `npx base44` commands.** The runtime deploys functions and pushes entities automatically the moment you write the files — writing a resource file *is* the deploy.
> - **Don't grant admin roles.** Granting a user the `admin` role is not an install step for you; instead, validate that the admin-role gating (see [`post-installation.md`](./post-installation.md)) is preserved when you merge the admin routes into the app's router.
> - **Don't read the whole codebase up front.** Copy the files, wire the router, and open only what your current task touches.

---

## 1. Static installation (copying the files)

**Scripted.** Copy this entire repository into the target app at `examples/commerce/`, then run from the app root:

```bash
node examples/commerce/scripts/install.js
```

Relative to the script's own folder (`examples/commerce/scripts/`), it copies:

| From (template) | To (app) |
|---|---|
| `../base44/entities/commerce.*.jsonc` | `../../../base44/entities/` |
| `../base44/functions/commerce/` | `../../../base44/functions/commerce/` |
| `../base44/shared/commerce/` | `../../../base44/shared/commerce/` |
| `../base44/agents/commerce/` | `../../../base44/agents/commerce/` |
| `../src/commerce/admin/` | `../../../src/commerce/admin/` |
| `../skills/commerce/` | `../../../skills/commerce/` |

Directories are merged: files owned by the template are overwritten (re-running after a template update is safe); everything else in your app is left untouched. The skill folder carries all the documentation — `SKILL.md`, this file, `post-installation.md`, the topic references in `references/` and the API docs in `docs/` — so the installed app gets it at `skills/commerce/` where agents pick it up natively; the template repo itself also stays under `examples/commerce/` for reference.

**Manual.** Equivalently, copy by hand:

1. Copy `base44/entities/commerce.*`, `base44/functions/commerce/*`, `base44/shared/commerce/*` and `base44/agents/commerce/*` into your app's `base44/` dir (merge, don't overwrite unrelated files). `shared/` is bundled into every function at deploy time.
2. Copy `src/commerce/admin/` → `src/commerce/admin/`.
3. Copy `skills/commerce/` → `skills/commerce/` (the commerce skill — `SKILL.md`, this file, `post-installation.md`, the `references/` topic guides and the `docs/` API references — for agents working on the app).

Confirm your `base44/config.jsonc` `entitiesDir`/`functionsDir` point at these folders (the defaults do).

## 2. Deploy and wire up

1. `npx base44 entities push` — creates/updates the 24 entity schemas. *(CLI path only — the Base44 runtime deploys on write.)*
2. `npx base44 functions deploy` — deploys the 14 functions. *(CLI path only.)*
3. `npx base44 agents push` — registers the `commerce/StoreAdmin` agent (§3). *(CLI path only.)*
4. `npm i sonner recharts remark-gfm` (if not already present) and verify the shadcn primitives listed in [`src/commerce/admin/README.md`](../../src/commerce/admin/README.md) exist in your app.
5. Mount the admin router (see [`post-installation.md`](./post-installation.md)).
6. Grant your user the `admin` role.
7. Open `/admin` → **Initialize store defaults** on the first-run setup screen (runs `commerce/seed-store`).

Check the install at any time:

```js
const { data } = (await base44.functions.invoke("commerce/admin-tools", { action: "status" })).data;
// → { template_version, seeded, settings_groups, counts: {...}, checks: [...] }
```

`commerce/seed-store` is **idempotent** and starts with a **canary schema check**: it probe-writes one record per entity it will touch and deletes it. If you've modified an entity schema incompatibly, it aborts with HTTP 422 `schema_incompatible` and writes nothing:

```json
{ "success": false, "code": "schema_incompatible",
  "errors": [{ "entity": "Product", "error": "..." }] }
```

The admin setup screen surfaces these errors verbatim. Sample catalog data is only created when `with_sample_data: true` **and** the store has zero products.

---

## 3. The StoreAdmin agent (admin copilot)

The template ships an AI copilot for store operators:

- **Agent definition** — [`base44/agents/commerce/StoreAdmin.jsonc`](../../base44/agents/commerce/StoreAdmin.jsonc), registered as **`commerce/StoreAdmin`** (the folder namespaces the agent, exactly like functions). The hosted runtime registers it when the file lands; on the CLI path run `npx base44 agents push`.
- **Tools** — the `commerce/*` backend functions attached directly (`commerce/admin-products`, `commerce/admin-orders`, …, `commerce/seed-store`, plus read-only `commerce/storefront-catalog` for enumerating product variations). Tool calls run **with the chatting user's credentials**, so `requireAdmin()` in every admin function still authorizes the actual user — the agent has no entity tools and no service-role shortcut; a non-admin chatting with it gets `401/403` from every admin operation.
- **No `model` field, on purpose.** The platform's default-model path accepts slash-namespaced tool names; explicitly setting a `model` currently rejects them (LLM tool names must match `^[a-zA-Z0-9_-]{1,128}$`). If you set a model, the bot fails at message time with a `tools.0.custom.name` error.
- **Variant safety** — the agent is instructed to never auto-pick a variation: for variable products it fetches `{product, variations}` via `commerce/storefront-catalog get-product`, presents the variations as a table, and asks the operator which `variation_id` to use before touching an order, stock, or download grant.
- **Bot UI** — `src/commerce/admin/bot/` (chat panel; "StoreAdmin bot" launcher at the bottom of the admin sidebar). Responses render as GitHub-flavored markdown via `react-markdown` + `remark-gfm`, so agent-produced tables (`| col |` with `|---|` separators) display properly. The panel lives behind the same `AuthGuard` as the rest of the admin.

**Do not weaken the tool set.** The agent's power comes only from the admin functions' own `requireAdmin()` layer — don't add entity tools or service-role calls to the agent config, and keep `commerce/storefront-*` tools limited to the read-only catalog.

---

## 4. Next steps

Continue with [`post-installation.md`](./post-installation.md): embedding the admin pages (router mount, admin-role enforcement) and registering the template + skill in the app's `AGENTS.md`. After that, [`skills/commerce/SKILL.md`](./SKILL.md) is the map for all day-2 work.
