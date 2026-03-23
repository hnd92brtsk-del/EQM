import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const rootDir = process.cwd();
const srcDir = join(rootDir, "src");
const exts = new Set([".ts", ".tsx"]);

const englishUiHints = [
  "label=",
  "title=",
  "placeholder=",
  "helperText=",
  "DialogTitle",
  "Typography",
  "Alert",
  "MenuItem",
  "Tab ",
  "InputLabel",
  "AppButton",
  "Button",
];

const englishValueRegex = /"([A-Za-z][^"\\]{2,})"|'([A-Za-z][^'\\]{2,})'/g;
const cyrillicRegex = /[А-Яа-яЁё]/;
const allowedEnglishTokens = new Set([
  "admin",
  "engineer",
  "viewer",
  "light",
  "dark",
  "true",
  "false",
  "small",
  "medium",
  "large",
  "outlined",
  "contained",
  "text",
  "primary",
  "secondary",
  "error",
  "warning",
  "success",
  "info",
  "default",
  "ghost",
  "select",
  "connect",
  "pan",
  "props",
  "data",
  "gateway",
  "subnets",
  "vlans",
  "all",
  "free",
  "used",
  "reserved",
  "service",
  "up",
  "down",
  "active",
  "triggered",
  "disabled",
  "core",
  "distribution",
  "access",
  "security",
  "datacenter",
  "wan",
  "edge",
  "circular",
  "rounded",
  "square",
  "small",
  "medium",
  "large",
]);

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (entry === "i18n" || entry === "node_modules" || entry === "dist") {
        if (entry === "i18n") {
          files.push(...walk(full));
        }
        continue;
      }
      files.push(...walk(full));
      continue;
    }
    if (!exts.has(full.slice(full.lastIndexOf(".")))) {
      continue;
    }
    if (full.includes(`${join("src", "i18n", "locales")}`)) {
      continue;
    }
    files.push(full);
  }
  return files;
}

function findEnglishLiterals(line) {
  if (!englishUiHints.some((hint) => line.includes(hint))) {
    return [];
  }
  const literals = [];
  let match;
  while ((match = englishValueRegex.exec(line)) !== null) {
    const value = match[1] || match[2] || "";
    if (allowedEnglishTokens.has(value)) {
      continue;
    }
    if (/^[A-Za-z0-9_./:()[\]-]+$/.test(value)) {
      continue;
    }
    literals.push(value);
  }
  return literals;
}

function auditFile(filePath) {
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  const hits = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) {
      return;
    }

    if (cyrillicRegex.test(line)) {
      hits.push({
        line: index + 1,
        kind: "cyrillic",
        snippet: trimmed.slice(0, 220),
      });
      return;
    }

    const englishLiterals = findEnglishLiterals(line);
    if (englishLiterals.length) {
      hits.push({
        line: index + 1,
        kind: "english-ui",
        snippet: trimmed.slice(0, 220),
      });
    }
  });

  return hits;
}

const files = walk(srcDir);
const report = files
  .map((filePath) => ({ filePath, hits: auditFile(filePath) }))
  .filter((entry) => entry.hits.length > 0)
  .sort((a, b) => b.hits.length - a.hits.length || a.filePath.localeCompare(b.filePath));

if (!report.length) {
  console.log("No hardcoded i18n candidates found.");
  process.exit(0);
}

console.log("Hardcoded i18n candidates:");
for (const entry of report) {
  console.log(`\n${relative(rootDir, entry.filePath)} (${entry.hits.length})`);
  for (const hit of entry.hits.slice(0, 12)) {
    console.log(`  ${hit.line} [${hit.kind}] ${hit.snippet}`);
  }
  if (entry.hits.length > 12) {
    console.log(`  ... ${entry.hits.length - 12} more`);
  }
}
