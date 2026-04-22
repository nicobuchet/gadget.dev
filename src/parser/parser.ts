import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  TestFileSchema,
  SuiteFileSchema,
  GadgetConfigSchema,
} from "./schema.js";
import { interpolateDeep } from "../utils/variables.js";
import type { TestCase, TestSuite, GadgetConfig } from "../types/index.js";

export function parseTestFile(filePath: string): TestCase {
  const absolutePath = resolve(filePath);
  const content = readFileSync(absolutePath, "utf-8");
  const raw = parseYaml(content);

  const parsed = TestFileSchema.parse(raw);

  // Interpolate variables into steps
  const steps = interpolateDeep(parsed.steps, parsed.variables);

  return {
    name: parsed.name,
    config: parsed.config,
    variables: parsed.variables,
    steps,
    filePath: absolutePath,
  };
}

export function parseSuiteFile(filePath: string): TestSuite {
  const absolutePath = resolve(filePath);
  const content = readFileSync(absolutePath, "utf-8");
  const raw = parseYaml(content);

  const parsed = SuiteFileSchema.parse(raw);
  const suiteDir = dirname(absolutePath);

  const tests = parsed.tests.map((ref) => {
    const testPath = resolve(suiteDir, ref.file);
    const testCase = parseTestFile(testPath);
    // Merge suite config as defaults (test-level overrides)
    return {
      ...testCase,
      config: { ...parsed.config, ...testCase.config },
    };
  });

  return {
    name: parsed.name,
    config: parsed.config,
    tests,
  };
}

export function parseConfig(projectRoot: string): GadgetConfig | null {
  const configPath = resolve(projectRoot, ".gadgetrc.yaml");
  let content: string;
  try {
    content = readFileSync(configPath, "utf-8");
  } catch {
    return null;
  }

  const raw = parseYaml(content);
  const parsed = GadgetConfigSchema.parse(raw);

  // Interpolate env vars in apiKey
  if (parsed.ai.apiKey) {
    const envMatch = parsed.ai.apiKey.match(/\{\{\s*env\.(\w+)\s*\}\}/);
    if (envMatch) {
      const envValue = process.env[envMatch[1]];
      // Replace with env value, or clear it if not set
      parsed.ai.apiKey = envValue ?? undefined;
    }
  }

  if (parsed.audit?.linear?.apiKey) {
    const envMatch = parsed.audit.linear.apiKey.match(/\{\{\s*env\.(\w+)\s*\}\}/);
    if (envMatch) {
      const envValue = process.env[envMatch[1]];
      parsed.audit.linear.apiKey = envValue ?? undefined;
    }
  }

  return parsed;
}
