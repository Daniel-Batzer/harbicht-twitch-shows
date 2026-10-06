#!/usr/bin/env node
// PreToolUse guard: blocks Claude from touching real environment files
// (.env, .env.local, .env.production, ...). Only .env.example is allowed.
//
// Secondary layer: permissions.deny in .claude/settings.json is the primary
// protection for file tools. This hook mainly covers Bash, which deny rules
// can't see into, and re-checks the file tools as defense in depth.
//
// Contract (Claude Code hooks): JSON on stdin, exit 2 + stderr blocks the
// tool call. Any other failure would fail open, so every error path exits 2.
// This is a guardrail against accidents, not a security boundary: the Bash
// check matches text, not parsed shell.

import fs from "node:fs";
import path from "node:path";

const ALLOWED_ENV_FILE = ".env.example";

// Names a glob must not be able to match.
const SAMPLE_PROTECTED_NAMES = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.production",
  ".env.production.local",
  ".env.test",
  ".env.test.local",
];

// tool_input keys whose string values are treated as file system paths.
const PATH_KEY_PATTERN = /(path|paths|dir|directory|file|filename|notebook)$/i;

const DENY_MESSAGE_FOOTER =
  "Real environment files (.env, .env.local, .env.*) are owned by the developer. " +
  "Do not try another way to read, write, or inspect them. " +
  "If a variable is needed, add a placeholder to .env.example and ask the developer " +
  "to set the real value in their local env file themselves, naming the exact variable.";

function deny(toolName, target) {
  process.stderr.write(
    `Blocked by project env-file guard: ${toolName} tried to access "${target}". ${DENY_MESSAGE_FOOTER}\n`,
  );
  process.exit(2);
}

function readStdin() {
  return fs.readFileSync(0, "utf8");
}

function isProtectedEnvName(fileName) {
  const name = fileName.toLowerCase();
  if (name === ALLOWED_ENV_FILE) return false;
  return name === ".env" || name.startsWith(".env.");
}

function globToRegExp(globSegment) {
  let source = "";
  let braceDepth = 0;
  for (const char of globSegment) {
    if (char === "*") source += "[^/]*";
    else if (char === "?") source += "[^/]";
    else if (char === "[") source += "[";
    else if (char === "]") source += "]";
    else if (char === "{") {
      source += "(?:";
      braceDepth += 1;
    } else if (char === "}" && braceDepth > 0) {
      source += ")";
      braceDepth -= 1;
    } else if (char === "," && braceDepth > 0) source += "|";
    else source += char.replace(/[.+^$()|\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`, "i");
}

// Glob tools skip dotfiles unless the pattern names the dot explicitly,
// so only segments that start with "." (or a brace group) are checked.
function globCouldMatchEnv(pattern) {
  const lastSegment = pattern.split("/").pop() ?? "";
  if (!lastSegment.startsWith(".") && !lastSegment.startsWith("{")) return false;
  if (isProtectedEnvName(lastSegment)) return true;

  let matcher;
  try {
    matcher = globToRegExp(lastSegment);
  } catch {
    return true; // Unparseable glob near ".env": fail closed.
  }
  return SAMPLE_PROTECTED_NAMES.some((name) => matcher.test(name));
}

function pathTargetsEnvFile(rawPath, cwd) {
  const resolved = path.resolve(cwd, rawPath);
  if (isProtectedEnvName(path.basename(resolved))) return true;
  if (globCouldMatchEnv(rawPath)) return true;

  // Catch symlinks that point at an env file.
  if (fs.existsSync(resolved)) {
    const real = fs.realpathSync(resolved);
    if (isProtectedEnvName(path.basename(real))) return true;
  }
  return false;
}

function collectPathCandidates(toolName, toolInput) {
  const candidates = [];

  function visit(value, key) {
    if (typeof value === "string") {
      const isPathField = key !== undefined && PATH_KEY_PATTERN.test(key);
      const isGlobField = key === "glob" || (toolName === "Glob" && key === "pattern");
      if (isPathField || isGlobField) candidates.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) visit(item, key);
    } else if (value && typeof value === "object") {
      for (const [childKey, childValue] of Object.entries(value)) visit(childValue, childKey);
    }
  }

  visit(toolInput, undefined);
  return candidates;
}

// Finds ".env..." words at a word or path boundary, e.g. "cat .env",
// "cp .env.example .env.local", "/abs/.env.test", "ls .env*", "$(cat .env)".
// Does not match "process.env.X", ".envrc", or "dotenv".
const ENV_REFERENCE_PATTERN = /(?:^|[\s'"=<>|;&(`:,{/])(\.env(?![A-Za-z0-9_-])[A-Za-z0-9_.*?[\]{},-]*)/gi;

function findEnvReferencesInCommand(command) {
  const references = [];
  for (const match of command.matchAll(ENV_REFERENCE_PATTERN)) {
    const reference = match[1].replace(/[},]+$/, "");
    if (reference.toLowerCase() !== ALLOWED_ENV_FILE) references.push(reference);
  }
  return references;
}

function main() {
  let input;
  try {
    input = JSON.parse(readStdin());
  } catch {
    deny("unknown tool", "(unparseable hook input; env guard denies for safety)");
  }

  const toolName = typeof input.tool_name === "string" ? input.tool_name : "unknown tool";
  const toolInput = input.tool_input ?? {};
  const cwd = typeof input.cwd === "string" ? input.cwd : process.cwd();

  if (toolName === "Bash" && typeof toolInput.command === "string") {
    const [firstReference] = findEnvReferencesInCommand(toolInput.command);
    if (firstReference) deny(toolName, firstReference);
  }

  for (const candidate of collectPathCandidates(toolName, toolInput)) {
    if (pathTargetsEnvFile(candidate, cwd)) deny(toolName, candidate);
  }

  process.exit(0);
}

try {
  main();
} catch (error) {
  deny("unknown tool", `(env guard crashed: ${error instanceof Error ? error.message : String(error)})`);
}
