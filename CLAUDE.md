# CLAUDE.md

## Project

An interactive, client-only simulator for AWS VPC Lattice: multi-VPC/multi-account service networking, SigV4 IAM auth, and weighted canary routing. There is no backend — all "traffic," logs, and policy evaluation are simulated client-side from static data in `src/data/`. The Terraform under `terraform/` is rendered in-app (via `TerraformViewer`) as reference content, but it is also genuinely `terraform apply`-able against two real AWS accounts as a real, cost-bearing, ephemeral learning stack — see [terraform/DEPLOYING.md](terraform/DEPLOYING.md). Its variable *defaults* stay as placeholder account IDs (`111111111111` / `222222222222`) for the illustrative/in-app reading path; real account IDs for an actual deploy go in a gitignored `terraform.tfvars`, never committed. Changes to `src/data/terraformBlueprints.ts` (the in-app copy) and the files under `terraform/` (the deployable copy) are not kept in sync automatically — update both if you touch one.

## Stack

React 19 + TypeScript, Vite 6, Tailwind CSS v4 (via `@tailwindcss/vite`), `lucide-react` icons, `motion` for animation.

## Commands

- `npm run dev` — Vite dev server on port 3000
- `npm run build` — production build
- `npm run preview` — preview the production build
- `npm run lint` — type-checks only (`tsc --noEmit`); no test suite or CI configured

## Architecture

- [src/App.tsx](src/App.tsx) — tab shell (Topology Simulator / IAM Policy Lab / Terraform Blueprints / AWS CLI Playbook), holds the shared `SimulationConfig` and `LogEntry[]` state, applies quick presets.
- [src/components/NetworkTopology.tsx](src/components/NetworkTopology.tsx) — animates a simulated request through client → Lattice endpoint → service network → target group, derives the auth allow/deny outcome and emits `LogEntry`s.
- [src/components/IAMPolicyTester.tsx](src/components/IAMPolicyTester.tsx) — editable Service Network / Service auth policy JSON tied into the same `SimulationConfig`.
- [src/components/TerraformViewer.tsx](src/components/TerraformViewer.tsx) — renders the static blueprints from `src/data/terraformBlueprints.ts` (mirrors the files under `terraform/`).
- [src/components/CLITerminal.tsx](src/components/CLITerminal.tsx) — renders canned AWS CLI command/output pairs from `src/data/cliCommands.ts`.
- [src/types.ts](src/types.ts) — shared types: `SimulationConfig`, `LogEntry`, `CliCommand`, `TerraformFile`.
- [Makefile](Makefile) — repo-root wrapper around the Terraform lifecycle plus real `aws vpc-lattice`/`ram`/`ssm` calls against an actually-deployed stack (`terraform -chdir=terraform`, IDs/ARNs resolved live via `terraform output`); this is the deployable path's analog of the in-app AWS CLI Playbook, not something the app itself calls.

## Conventions

- Functional components with `useState`/`useEffect`, no external state library.
- Styling is Tailwind utility classes inline (dark, editorial theme); no CSS modules.
- No test framework is set up — verify changes by running `npm run dev` and exercising the UI manually.

## Known leftovers

`@google/genai`, `express`, and `dotenv` in `package.json`, plus `GEMINI_API_KEY`/`APP_URL` in `.env.example`, are unused scaffolding inherited from the Google AI Studio template — nothing in `src/` imports them. Don't assume a Gemini/server integration exists; treat this as a static frontend.
