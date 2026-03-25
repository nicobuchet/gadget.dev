import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, extname, join } from "node:path";
import { parse as parseYaml } from "yaml";

/**
 * Given a CLI input (file, directory, or suite file), returns an ordered
 * list of test file paths to run.
 */
export function resolveTestPaths(input: string): string[] {
  const absolutePath = resolve(input);

  if (!existsSync(absolutePath)) {
    throw new Error(`Path does not exist: ${absolutePath}`);
  }

  const stat = statSync(absolutePath);

  // Directory: find all *.test.yaml files recursively
  if (stat.isDirectory()) {
    return findTestFiles(absolutePath);
  }

  // File: check if it's a suite or a test
  if (stat.isFile()) {
    if (isSuiteFile(absolutePath)) {
      return resolveSuiteFiles(absolutePath);
    }
    return [absolutePath];
  }

  throw new Error(`Unsupported path type: ${absolutePath}`);
}

function findTestFiles(dir: string): string[] {
  const results: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTestFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".test.yaml")) {
      results.push(fullPath);
    }
  }

  return results.sort();
}

function isSuiteFile(filePath: string): boolean {
  if (extname(filePath) !== ".yaml" && extname(filePath) !== ".yml") {
    return false;
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    const raw = parseYaml(content);
    return (
      raw !== null &&
      typeof raw === "object" &&
      "tests" in raw &&
      Array.isArray(raw.tests) &&
      raw.tests.length > 0 &&
      typeof raw.tests[0] === "object" &&
      "file" in raw.tests[0]
    );
  } catch {
    return false;
  }
}

function resolveSuiteFiles(suitePath: string): string[] {
  const content = readFileSync(suitePath, "utf-8");
  const raw = parseYaml(content);
  const suiteDir = resolve(suitePath, "..");

  return (raw.tests as Array<{ file: string }>).map((ref) =>
    resolve(suiteDir, ref.file),
  );
}
