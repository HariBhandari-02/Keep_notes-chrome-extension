#!/usr/bin/env -S node --experimental-strip-types
// ==============================================================================
// SonarQube Issue Fetcher
//
// Pulls issues from SonarQube's REST API, grouped per-file, into JSON
// files for remediation and review.
//
// Usage:
//   pnpm sonar:fetch [options]
//   node scripts/sonar-fetch.ts [options]
//
// Options:
//   -u, --url <url>         SonarQube server URL (default: $SONAR_HOST_URL or http://localhost:9000)
//   -t, --token <token>     SonarQube authentication token (default: $SONAR_TOKEN)
//   -p, --project <key>     Sonar project key (default: sonar.projectKey from sonar-project.properties)
//   -q, --qualities <list>  Software qualities to fetch (default: RELIABILITY,SECURITY,MAINTAINABILITY)
//   -o, --out-dir <dir>     Output directory for sonar-issues.json (default: ./sonar)
//       --profile <name>    Label only, recorded in the output (e.g. "static" or "full")
//       --min-coverage <n>  Minimum overall coverage percentage (default: 80)
//       --fail-on <level>   Fail on issues at or above this severity: BLOCKER, HIGH, MEDIUM,
//                           LOW, INFO, or NONE (default: INFO — any open issue fails)
//       --skip-coverage     Do not check coverage
//       --skip-gate         Do not check the SonarQube quality gate
//   -h, --help              Show this help message
//
// Environment: reads SONAR_HOST_URL / SONAR_TOKEN from environment,
// falling back to .env.sonar.local / .env.sonar / .env.
//
// Exit code: 0 when the quality gate passes, coverage meets the minimum, and no
// issues at or above --fail-on are open; 1 otherwise.
// ==============================================================================

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(SCRIPT_DIR, "..");

interface CliOptions {
  url: string;
  token: string;
  project: string;
  outDir: string;
  profile: string;
  qualities: string;
  minCoverage: number;
  failOn: string;
  skipCoverage: boolean;
  skipGate: boolean;
}

interface SonarImpact {
  softwareQuality: string;
  severity: string;
}

interface SonarRawIssue {
  key: string;
  rule: string;
  type: string;
  severity: string;
  component: string;
  line?: number;
  message: string;
  status: string;
  cleanCodeAttribute?: string;
  cleanCodeAttributeCategory?: string;
  impacts?: SonarImpact[];
}

interface SonarMeasure {
  metric: string;
  value?: string;
}

interface SonarGateCondition {
  status: string;
  metricKey: string;
  comparator: string;
  errorThreshold: string;
  actualValue?: string;
}

interface SonarGateStatus {
  status: string;
  conditions: SonarGateCondition[];
}

const SEVERITY_ORDER: Record<string, number> = {
  BLOCKER: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

const LEGACY_SEVERITY_MAP: Record<string, string> = {
  BLOCKER: "BLOCKER",
  CRITICAL: "HIGH",
  MAJOR: "MEDIUM",
  MINOR: "LOW",
  INFO: "INFO",
};

const DEFAULT_QUALITIES = ["RELIABILITY", "SECURITY", "MAINTAINABILITY"];
const SEVERITY_LIST = ["BLOCKER", "HIGH", "MEDIUM", "LOW", "INFO"];

function printUsage(): void {
  console.log(`Usage: pnpm sonar:fetch [options]
       node scripts/sonar-fetch.ts [options]

Options:
  -u, --url <url>         SonarQube server URL (default: $SONAR_HOST_URL or http://localhost:9002)
  -t, --token <token>     SonarQube authentication token (default: $SONAR_TOKEN)
  -p, --project <key>     Sonar project key (default: sonar.projectKey from sonar-project.properties)
  -q, --qualities <list>  Software qualities to fetch (default: RELIABILITY,SECURITY,MAINTAINABILITY)
  -o, --out-dir <dir>     Output directory for sonar-issues.json (default: ./sonar)
      --profile <name>    Label only, recorded in the output (e.g. "static" or "full")
      --min-coverage <n>  Minimum overall coverage percentage (default: 80)
      --fail-on <level>   Fail on issues at or above this severity: BLOCKER, HIGH, MEDIUM,
                          LOW, INFO, or NONE (default: INFO — any open issue fails)
      --skip-coverage     Do not check coverage
      --skip-gate         Do not check the SonarQube quality gate
  -h, --help              Show this help message

Environment Variables (also read from .env.sonar.local / .env.sonar / .env):
  SONAR_HOST_URL          URL of the SonarQube server (e.g., http://localhost:9002)
  SONAR_TOKEN             User or project analysis token`);
}

function loadEnvVar(name: string): string {
  for (const file of [join(ROOT_DIR, ".env.sonar.local"), join(ROOT_DIR, ".env.sonar"), join(ROOT_DIR, ".env")]) {
    if (!existsSync(file)) continue;
    const line = readFileSync(file, "utf8")
      .split("\n")
      .find((l) => l.trim().startsWith(`${name}=`));
    if (line) {
      return line
        .slice(line.indexOf("=") + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");
    }
  }
  return "";
}

function loadProjectKeyFromProperties(): string {
  const propsPath = join(ROOT_DIR, "sonar-project.properties");
  if (!existsSync(propsPath)) return "";
  const line = readFileSync(propsPath, "utf8")
    .split("\n")
    .find((l) => l.trim().startsWith("sonar.projectKey="));
  return line ? line.slice(line.indexOf("=") + 1).trim() : "";
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    url: process.env.SONAR_HOST_URL || loadEnvVar("SONAR_HOST_URL") || "http://localhost:9002",
    token: process.env.SONAR_TOKEN || loadEnvVar("SONAR_TOKEN") || "",
    project: loadProjectKeyFromProperties(),
    outDir: join(ROOT_DIR, "sonar"),
    profile: "",
    qualities: DEFAULT_QUALITIES.join(","),
    minCoverage: 80,
    failOn: "INFO",
    skipCoverage: false,
    skipGate: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--":
        continue;
      case "-u":
      case "--url":
        options.url = argv[++i];
        break;
      case "-t":
      case "--token":
        options.token = argv[++i];
        break;
      case "-p":
      case "--project":
        options.project = argv[++i];
        break;
      case "-q":
      case "--qualities":
        options.qualities = argv[++i];
        break;
      case "-o":
      case "--out-dir":
        options.outDir = join(process.cwd(), argv[++i]);
        break;
      case "--profile":
        options.profile = argv[++i];
        break;
      case "--min-coverage":
        options.minCoverage = Number(argv[++i]);
        break;
      case "--fail-on":
        options.failOn = (argv[++i] || "").toUpperCase();
        break;
      case "--skip-coverage":
        options.skipCoverage = true;
        break;
      case "--skip-gate":
        options.skipGate = true;
        break;
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        printUsage();
        process.exit(1);
    }
  }

  if (!options.project) {
    console.error(
      "Error: no Sonar project key found. Pass --project <key> or add sonar.projectKey to sonar-project.properties."
    );
    process.exit(1);
  }

  if (!Number.isFinite(options.minCoverage) || options.minCoverage < 0 || options.minCoverage > 100) {
    console.error("Error: --min-coverage must be a number between 0 and 100.");
    process.exit(1);
  }

  if (options.failOn !== "NONE" && !(options.failOn in SEVERITY_ORDER)) {
    console.error(`Error: --fail-on must be one of ${SEVERITY_LIST.join(", ")}, or NONE.`);
    process.exit(1);
  }

  return options;
}

function authHeader(token: string): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}` };
}

async function checkConnection(url: string): Promise<void> {
  try {
    const res = await fetch(`${url}/api/system/status`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.error(`\n❌ Error: Cannot connect to SonarQube server at ${url}`);
    console.error(`   (${err instanceof Error ? err.message : String(err)})`);
    console.error("\nMake sure the server is running and reachable, then try again.\n");
    process.exit(1);
  }
}

async function fetchAllPages<T, K extends string>(url: string, token: string, key: K): Promise<T[]> {
  const pageSize = 500;
  let pageIndex = 1;
  const results: T[] = [];

  for (;;) {
    const paged = new URL(url);
    paged.searchParams.set("p", String(pageIndex));
    paged.searchParams.set("ps", String(pageSize));

    const res = await fetch(paged, { headers: authHeader(token) });
    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("SonarQube rejected the request (401 Unauthorized). Check your token.");
      }
      if (res.status === 403) {
        throw new Error(`SonarQube returned HTTP 403 Forbidden for ${paged.pathname}. Permission denied.`);
      }
      throw new Error(`SonarQube returned HTTP ${res.status} for ${paged}`);
    }

    const body = (await res.json()) as { paging: { total: number } } & Record<K, T[]>;
    results.push(...body[key]);

    if (results.length >= body.paging.total || body[key].length === 0) break;
    pageIndex++;
  }

  return results;
}

async function fetchMeasures(url: string, token: string, project: string): Promise<Record<string, string>> {
  const endpoint = new URL("/api/measures/component", url);
  endpoint.searchParams.set("component", project);
  endpoint.searchParams.set(
    "metricKeys",
    "coverage,lines_to_cover,uncovered_lines,bugs,vulnerabilities,code_smells,duplicated_lines_density"
  );

  const res = await fetch(endpoint, { headers: authHeader(token) });
  if (!res.ok) {
    throw new Error(`SonarQube returned HTTP ${res.status} for ${endpoint.pathname}`);
  }

  const body = (await res.json()) as { component?: { measures?: SonarMeasure[] } };
  return Object.fromEntries((body.component?.measures ?? []).map((measure) => [measure.metric, measure.value ?? ""]));
}

async function fetchGateStatus(url: string, token: string, project: string): Promise<SonarGateStatus> {
  const endpoint = new URL("/api/qualitygates/project_status", url);
  endpoint.searchParams.set("projectKey", project);

  const res = await fetch(endpoint, { headers: authHeader(token) });
  if (!res.ok) {
    throw new Error(`SonarQube returned HTTP ${res.status} for ${endpoint.pathname}`);
  }

  const body = (await res.json()) as { projectStatus?: SonarGateStatus };
  if (!body.projectStatus) {
    throw new Error("SonarQube did not return a quality gate status.");
  }
  return body.projectStatus;
}

function issueSeverities(issue: SonarRawIssue): string[] {
  if (issue.impacts && issue.impacts.length > 0) {
    return issue.impacts.map((impact) => impact.severity.toUpperCase());
  }
  return [LEGACY_SEVERITY_MAP[issue.severity?.toUpperCase()] || issue.severity?.toUpperCase() || "MEDIUM"];
}

function stripProjectPrefix(component: string, projectKey: string): string {
  const prefix = `${projectKey}:`;
  return component.startsWith(prefix) ? component.slice(prefix.length) : component;
}

function resolveCleanCodeImpact(
  issue: SonarRawIssue,
  qualitiesFilter: string
): { softwareQuality: string; severity: string } {
  if (issue.impacts && issue.impacts.length > 0) {
    const filterList = qualitiesFilter ? qualitiesFilter.split(",").map((q) => q.trim().toUpperCase()) : [];

    const matching =
      filterList.length > 0
        ? issue.impacts.filter((imp) => filterList.includes(imp.softwareQuality.toUpperCase()))
        : issue.impacts;

    const candidates = matching.length > 0 ? matching : issue.impacts;

    const topImpact = candidates.reduce((prev, curr) =>
      (SEVERITY_ORDER[curr.severity.toUpperCase()] || 0) >= (SEVERITY_ORDER[prev.severity.toUpperCase()] || 0)
        ? curr
        : prev
    );

    return {
      softwareQuality: topImpact.softwareQuality.toUpperCase(),
      severity: topImpact.severity.toUpperCase(),
    };
  }

  return {
    softwareQuality:
      issue.type === "BUG" ? "RELIABILITY" : issue.type === "VULNERABILITY" ? "SECURITY" : "MAINTAINABILITY",
    severity: LEGACY_SEVERITY_MAP[issue.severity.toUpperCase()] || issue.severity.toUpperCase(),
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  console.log("============================================================");
  console.log(" SonarQube Issue Fetcher");
  console.log("============================================================");
  console.log(` Server URL   : ${options.url}`);
  console.log(` Project key  : ${options.project}`);
  console.log(` Qualities    : ${options.qualities || "ALL"}`);
  console.log(` Output dir   : ${options.outDir}`);
  console.log("============================================================\n");

  await checkConnection(options.url);

  console.log(`Fetching issues (${options.qualities || "ALL"})...`);
  const issuesUrl = new URL("/api/issues/search", options.url);
  issuesUrl.searchParams.set("componentKeys", options.project);
  issuesUrl.searchParams.set("resolved", "false");
  if (options.qualities) {
    issuesUrl.searchParams.set("impactSoftwareQualities", options.qualities);
  }

  let rawIssues: SonarRawIssue[] = [];
  try {
    rawIssues = await fetchAllPages<SonarRawIssue, "issues">(issuesUrl.toString(), options.token, "issues");
  } catch (err) {
    console.error(`\n❌ Error fetching issues: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }

  const bySeverity: Record<string, number> = {
    BLOCKER: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };

  const byQuality: Record<string, number> = {};
  const byQualityAndSeverity: Record<string, Record<string, number>> = {};
  for (const q of DEFAULT_QUALITIES) {
    byQuality[q] = 0;
    byQualityAndSeverity[q] = { BLOCKER: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  }

  const files: Record<
    string,
    {
      key: string;
      rule: string;
      softwareQuality: string;
      severity: string;
      line?: number;
      message: string;
      status: string;
    }[]
  > = {};

  for (const raw of rawIssues) {
    // const { softwareQuality, severity } = resolveCleanCodeImpact(raw, options.qualities);

    // Extract all impacts (or fall back to legacy type mapping)
    const impacts =
      raw.impacts && raw.impacts.length > 0
        ? raw.impacts.map((i) => ({
            softwareQuality: i.softwareQuality.toUpperCase(),
            severity: i.severity.toUpperCase(),
          }))
        : [
            {
              softwareQuality:
                raw.type === "BUG" ? "RELIABILITY" : raw.type === "VULNERABILITY" ? "SECURITY" : "MAINTAINABILITY",
              severity: LEGACY_SEVERITY_MAP[raw.severity?.toUpperCase()] || raw.severity?.toUpperCase() || "MEDIUM",
            },
          ];

    const file = stripProjectPrefix(raw.component, options.project);

    for (const impact of impacts) {
      const { softwareQuality, severity } = impact;

      bySeverity[severity] = (bySeverity[severity] || 0) + 1;
      byQuality[softwareQuality] = (byQuality[softwareQuality] || 0) + 1;

      if (!byQualityAndSeverity[softwareQuality]) {
        byQualityAndSeverity[softwareQuality] = { BLOCKER: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
      }
      byQualityAndSeverity[softwareQuality][severity] = (byQualityAndSeverity[softwareQuality][severity] || 0) + 1;

      (files[file] ??= []).push({
        key: raw.key,
        rule: raw.rule,
        softwareQuality,
        severity,
        line: raw.line,
        message: raw.message,
        status: raw.status,
      });
    }
  }

  const blockerOrHighCount = (bySeverity["BLOCKER"] || 0) + (bySeverity["HIGH"] || 0);
  const failThreshold = options.failOn === "NONE" ? Number.POSITIVE_INFINITY : SEVERITY_ORDER[options.failOn] || 0;
  const failingIssueCount = rawIssues.filter((issue) =>
    issueSeverities(issue).some((severity) => (SEVERITY_ORDER[severity] || 0) >= failThreshold)
  ).length;

  const failures: string[] = [];
  let coverage: number | undefined;
  let measures: Record<string, string> = {};
  let gateStatus: SonarGateStatus | undefined;

  if (!options.skipCoverage) {
    try {
      measures = await fetchMeasures(options.url, options.token, options.project);
      coverage = Number(measures.coverage ?? "0");
      if (!Number.isFinite(coverage) || coverage < options.minCoverage) {
        failures.push(`Coverage ${coverage.toFixed(1)}% is below the required ${options.minCoverage}%.`);
      }
    } catch (err) {
      failures.push(`Could not read coverage: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!options.skipGate) {
    try {
      gateStatus = await fetchGateStatus(options.url, options.token, options.project);
      if (gateStatus.status !== "OK") {
        failures.push(`Quality gate is ${gateStatus.status}.`);
      }
    } catch (err) {
      failures.push(`Could not read the quality gate: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (failingIssueCount > 0) {
    failures.push(
      `${failingIssueCount} open issue(s) at or above ${options.failOn} — remediation required.`
    );
  }

  const issuesOutput = {
    generatedAt: new Date().toISOString(),
    sonarHostUrl: options.url,
    projectKey: options.project,
    qualitiesFilter: options.qualities || "ALL",
    gateProfile: options.profile || undefined,
    totalIssues: rawIssues.length,
    coverage,
    minimumCoverage: options.skipCoverage ? undefined : options.minCoverage,
    qualityGateStatus: gateStatus?.status,
    bySeverity,
    byQuality,
    byQualityAndSeverity,
    blockerOrHighCount,
    files,
  };

  mkdirSync(options.outDir, { recursive: true });
  writeFileSync(join(options.outDir, "sonar-issues.json"), JSON.stringify(issuesOutput, null, 2));

  console.log("\n------------------------------------------------------------");
  console.log(` Issues found : ${rawIssues.length} (across ${Object.keys(files).length} files)\n`);
  console.log(" Breakdown by Software Quality & Severity:");
  for (const q of DEFAULT_QUALITIES) {
    const counts = byQualityAndSeverity[q];
    const total = byQuality[q] || 0;
    const name = (q.charAt(0) + q.slice(1).toLowerCase()).padEnd(15);
    const line = SEVERITY_LIST.map((s) => `${s.charAt(0) + s.slice(1).toLowerCase()}: ${counts[s] || 0}`).join(" | ");
    console.log(`  • ${name} (${String(total).padStart(2)} total) : ${line}`);
  }

  console.log("\n Overall by severity:");
  const totalSeverityLine = SEVERITY_LIST.map(
    (s) => `${s.charAt(0) + s.slice(1).toLowerCase()}: ${bySeverity[s] || 0}`
  ).join(" | ");
  console.log(`    ${totalSeverityLine}`);
  console.log(`  • Blocker / High total   : ${blockerOrHighCount}`);

  if (!options.skipCoverage) {
    const uncovered = measures.uncovered_lines ?? "?";
    const toCover = measures.lines_to_cover ?? "?";
    console.log(
      `  • Coverage               : ${coverage === undefined ? "unknown" : `${coverage.toFixed(1)}%`}`
    );
    console.log(`    Uncovered / total lines: ${uncovered} / ${toCover} (minimum ${options.minCoverage}%)`);
  }

  if (!options.skipGate) {
    console.log(`  • Quality gate           : ${gateStatus?.status ?? "unknown"}`);
    for (const condition of gateStatus?.conditions ?? []) {
      if (condition.status !== "OK") {
        console.log(
          `      ✗ ${condition.metricKey} ${condition.comparator} ${condition.errorThreshold}` +
            ` (actual: ${condition.actualValue ?? "?"})`
        );
      }
    }
  }

  console.log("------------------------------------------------------------");
  console.log(` Wrote: ${join(options.outDir, "sonar-issues.json")}`);
  console.log("============================================================\n");

  if (failures.length === 0) {
    console.log("✓ Quality gate passed: coverage, issues, and SonarQube gate are all clean.");
    process.exit(0);
  }

  for (const failure of failures) {
    console.log(`❌ ${failure}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
