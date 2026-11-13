#!/usr/bin/env -S node --experimental-strip-types
// ==============================================================================
// SonarQube Quality Gate Setup
//
// Creates (or updates) a "Keep Notes Quality Gate" that enforces overall
// coverage, new-code coverage, and zero open issues. The gate is then assigned
// to the project so `sonar.qualitygate.wait=true` fails the scan when any
// condition is not met.
//
// This is a one-time administration step and needs a SonarQube USER token with
// "Administer Quality Gates" permission. The project analysis token used for
// scanning cannot change quality gates.
//
// Usage:
//   node scripts/sonar-gate.ts [options]
//
// Options:
//   -u, --url <url>         SonarQube server URL (default: $SONAR_HOST_URL or http://localhost:9002)
//   -t, --token <token>     SonarQube user token (default: $SONAR_ADMIN_TOKEN or $SONAR_TOKEN)
//   -p, --project <key>     Sonar project key (default: sonar.projectKey from sonar-project.properties)
//   -g, --gate <name>       Quality gate name (default: Keep Notes Quality Gate)
//       --min-coverage <n>  Minimum overall and new-code coverage (default: 80)
//   -h, --help              Show this help message
//
// Environment: reads SONAR_HOST_URL / SONAR_ADMIN_TOKEN / SONAR_TOKEN from the
// environment, falling back to .env.sonar.local / .env.sonar / .env.
// ==============================================================================

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(SCRIPT_DIR, "..");
const DEFAULT_GATE = "Keep Notes Quality Gate";

interface CliOptions {
  url: string;
  token: string;
  project: string;
  gate: string;
  minCoverage: number;
}

interface Condition {
  id: string;
  metric: string;
  op: string;
  error: string;
}

interface DesiredCondition {
  metric: string;
  op: string;
  error: string;
}

function usage(): void {
  console.log(`Usage: node scripts/sonar-gate.ts [options]

Options:
  -u, --url <url>         SonarQube server URL (default: $SONAR_HOST_URL or http://localhost:9002)
  -t, --token <token>     SonarQube user token (default: $SONAR_ADMIN_TOKEN or $SONAR_TOKEN)
  -p, --project <key>     Sonar project key (default: sonar.projectKey from sonar-project.properties)
  -g, --gate <name>       Quality gate name (default: ${DEFAULT_GATE})
      --min-coverage <n>  Minimum overall and new-code coverage (default: 80)
  -h, --help              Show this help message`);
}

function loadEnvVar(name: string): string {
  for (const file of [join(ROOT_DIR, ".env.sonar.local"), join(ROOT_DIR, ".env.sonar"), join(ROOT_DIR, ".env")]) {
    if (!existsSync(file)) continue;
    const line = readFileSync(file, "utf8")
      .split("\n")
      .find((entry) => entry.trim().startsWith(`${name}=`));
    if (line) {
      return line
        .slice(line.indexOf("=") + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");
    }
  }
  return "";
}

function loadProjectKey(): string {
  const properties = join(ROOT_DIR, "sonar-project.properties");
  if (!existsSync(properties)) return "";
  const line = readFileSync(properties, "utf8")
    .split("\n")
    .find((entry) => entry.trim().startsWith("sonar.projectKey="));
  return line ? line.slice(line.indexOf("=") + 1).trim() : "";
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    url: process.env.SONAR_HOST_URL || loadEnvVar("SONAR_HOST_URL") || "http://localhost:9002",
    token:
      process.env.SONAR_ADMIN_TOKEN ||
      loadEnvVar("SONAR_ADMIN_TOKEN") ||
      process.env.SONAR_TOKEN ||
      loadEnvVar("SONAR_TOKEN") ||
      "",
    project: loadProjectKey(),
    gate: DEFAULT_GATE,
    minCoverage: 80,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    switch (arg) {
      case "-u":
      case "--url":
        options.url = argv[++index];
        break;
      case "-t":
      case "--token":
        options.token = argv[++index];
        break;
      case "-p":
      case "--project":
        options.project = argv[++index];
        break;
      case "-g":
      case "--gate":
        options.gate = argv[++index];
        break;
      case "--min-coverage":
        options.minCoverage = Number(argv[++index]);
        break;
      case "-h":
      case "--help":
        usage();
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        usage();
        process.exit(1);
    }
  }

  if (!options.project) {
    console.error("Error: no Sonar project key found. Pass --project <key> or add sonar.projectKey to sonar-project.properties.");
    process.exit(1);
  }
  if (!options.token) {
    console.error("Error: no token found. Pass --token <token> or set SONAR_TOKEN.");
    process.exit(1);
  }
  if (!Number.isFinite(options.minCoverage) || options.minCoverage < 0 || options.minCoverage > 100) {
    console.error("Error: --min-coverage must be a number between 0 and 100.");
    process.exit(1);
  }

  return options;
}

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}` };
}

async function request<T>(url: URL, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, headers: authHeader(token) });
  const text = await response.text();
  const body = text ? (JSON.parse(text) as T & { errors?: { msg: string }[] }) : ({} as T);

  if (!response.ok) {
    const message = body.errors?.map((error) => error.msg).join("; ") || `HTTP ${response.status}`;
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `${message}. This command needs a SonarQube USER token with quality gate administration permission, ` +
          "not the project analysis token."
      );
    }
    throw new Error(message);
  }

  return body;
}

function form(data: Record<string, string>): RequestInit {
  return { method: "POST", body: new URLSearchParams(data) };
}

async function showGate(options: CliOptions): Promise<{ conditions: Condition[] } | null> {
  const url = new URL("/api/qualitygates/show", options.url);
  url.searchParams.set("name", options.gate);

  const response = await fetch(url, { headers: authHeader(options.token) });
  if (response.status === 404) return null;
  return (await request<{ conditions: Condition[] }>(url, options.token)) ?? null;
}

async function createGate(options: CliOptions): Promise<void> {
  const url = new URL("/api/qualitygates/create", options.url);
  await request(url, options.token, form({ name: options.gate }));
  console.log(`✓ Created quality gate "${options.gate}".`);
}

async function syncConditions(options: CliOptions): Promise<void> {
  const desired: DesiredCondition[] = [
    { metric: "coverage", op: "LT", error: String(options.minCoverage) },
    { metric: "new_coverage", op: "LT", error: String(options.minCoverage) },
    { metric: "new_violations", op: "GT", error: "0" },
    { metric: "code_smells", op: "GT", error: "0" },
    { metric: "bugs", op: "GT", error: "0" },
    { metric: "vulnerabilities", op: "GT", error: "0" },
    { metric: "duplicated_lines_density", op: "GT", error: "3" },
    { metric: "new_duplicated_lines_density", op: "GT", error: "3" },
    { metric: "new_security_hotspots_reviewed", op: "LT", error: "100" },
  ];

  const gate = await showGate(options);
  if (!gate) {
    await createGate(options);
  }

  const existing = (await showGate(options))?.conditions ?? [];
  for (const condition of desired) {
    const current = existing.find((entry) => entry.metric === condition.metric);

    if (current && current.op === condition.op && current.error === condition.error) {
      continue;
    }

    if (current) {
      const url = new URL("/api/qualitygates/update_condition", options.url);
      await request(
        url,
        options.token,
        form({ id: current.id, metric: condition.metric, op: condition.op, error: condition.error })
      );
      console.log(`✓ Updated ${condition.metric} ${condition.op} ${condition.error}.`);
      continue;
    }

    const url = new URL("/api/qualitygates/create_condition", options.url);
    await request(
      url,
      options.token,
      form({ gateName: options.gate, metric: condition.metric, op: condition.op, error: condition.error })
    );
    console.log(`✓ Added ${condition.metric} ${condition.op} ${condition.error}.`);
  }
}

async function assignGate(options: CliOptions): Promise<void> {
  const url = new URL("/api/qualitygates/select", options.url);
  await request(url, options.token, form({ gateName: options.gate, projectKey: options.project }));
  console.log(`✓ Assigned "${options.gate}" to project "${options.project}".`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  console.log("============================================================");
  console.log(" SonarQube Quality Gate Setup");
  console.log("============================================================");
  console.log(` Server URL   : ${options.url}`);
  console.log(` Project key  : ${options.project}`);
  console.log(` Quality gate : ${options.gate}`);
  console.log(` Coverage min : ${options.minCoverage}%`);
  console.log("============================================================\n");

  await checkConnection(options);
  await syncConditions(options);
  await assignGate(options);

  console.log("\n✓ Quality gate is configured. Run `npm run sonar` to scan and enforce it.");
}

async function checkConnection(options: CliOptions): Promise<void> {
  try {
    const response = await fetch(`${options.url}/api/system/status`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.error(`\n❌ Cannot connect to SonarQube at ${options.url}`);
    console.error(`   (${error instanceof Error ? error.message : String(error)})\n`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
