import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import chalk from "chalk";
import { readDiff } from "./diff-reader.js";
import {
  testGenerationSystemPrompt,
  testGenerationUserPrompt,
} from "./prompts.js";
import { createProvider } from "../analyzer/providers/provider.js";
import { parseTestFile } from "../parser/parser.js";
import { TestFileSchema } from "../parser/schema.js";
import { runSuite } from "../runner/runner.js";
import { createReporters } from "../reporter/reporter.js";
import { Analyzer } from "../analyzer/analyzer.js";
import type { GadgetConfig, SuiteResult, TestCase } from "../types/index.js";

export interface CheckResult {
  generatedFiles: string[];
  suiteResult?: SuiteResult;
}

export interface CheckOptions {
  baseUrl: string;
  baseBranch: string;
  mrUrl?: string;
  outputDir: string;
  run: boolean;
  config: GadgetConfig;
  headed?: boolean;
  timeout?: number;
  reporter?: string;
  stopOnFailure?: boolean;
}

export async function check(options: CheckOptions): Promise<CheckResult> {
  // 1. Read diff
  console.log(chalk.gray(`Reading diff against ${options.baseBranch}...`));
  const diffContext = await readDiff({
    baseBranch: options.baseBranch,
    mrUrl: options.mrUrl,
  });

  if (!diffContext.diff.trim()) {
    console.log(
      chalk.yellow(
        `No changes detected against "${options.baseBranch}". Nothing to check.`,
      ),
    );
    return { generatedFiles: [] };
  }

  console.log(
    chalk.gray(
      `Found ${diffContext.changedFiles.length} changed file(s). Generating tests...`,
    ),
  );

  // 2. Create AI provider
  const provider = createProvider(options.config);
  if (!provider || !provider.generateTests) {
    throw new Error(
      "gadget check requires an AI provider with test generation support. Set ANTHROPIC_API_KEY or configure .gadgetrc.yaml",
    );
  }

  // 3. Generate tests via AI
  const systemPrompt = testGenerationSystemPrompt();
  const userPrompt = testGenerationUserPrompt({
    diff: diffContext.diff,
    mrDescription: diffContext.mrDescription,
    baseUrl: options.baseUrl,
    changedFiles: diffContext.changedFiles,
  });

  const maxTokens = options.config.check?.maxTokens ?? 8192;
  const rawResponse = await provider.generateTests({
    systemPrompt,
    userPrompt,
    maxTokens,
  });

  // 4. Parse YAML from response
  const yamlDocs = extractYamlDocuments(rawResponse);
  if (yamlDocs.length === 0) {
    throw new Error("AI did not generate any valid test files");
  }

  // 5. Validate and write files
  mkdirSync(options.outputDir, { recursive: true });
  const generatedFiles: string[] = [];
  const usedNames = new Set<string>();

  for (const doc of yamlDocs) {
    try {
      // Validate against schema
      const parsed = TestFileSchema.parse(doc);

      // Ensure baseUrl is set
      if (!parsed.config.baseUrl) {
        (doc as Record<string, Record<string, unknown>>).config =
          (doc as Record<string, Record<string, unknown>>).config || {};
        (doc as Record<string, Record<string, unknown>>).config.baseUrl =
          options.baseUrl;
      }

      // Generate unique filename
      let slug = slugify(parsed.name);
      if (usedNames.has(slug)) {
        let i = 2;
        while (usedNames.has(`${slug}-${i}`)) i++;
        slug = `${slug}-${i}`;
      }
      usedNames.add(slug);

      const filePath = join(options.outputDir, `${slug}.test.yaml`);
      writeFileSync(filePath, stringifyYaml(doc));
      generatedFiles.push(filePath);
    } catch (err) {
      console.warn(
        chalk.yellow(
          `Skipping invalid generated test: ${err instanceof Error ? err.message : err}`,
        ),
      );
    }
  }

  if (generatedFiles.length === 0) {
    throw new Error("AI generated tests but none passed validation");
  }

  console.log(
    chalk.green(`\nGenerated ${generatedFiles.length} test file(s) in ${options.outputDir}/`),
  );
  for (const f of generatedFiles) {
    console.log(chalk.gray(`  - ${f}`));
  }

  // 6. Optionally run the tests
  if (!options.run) {
    return { generatedFiles };
  }

  console.log(chalk.gray("\nRunning generated tests...\n"));

  // Parse the generated files through the normal pipeline
  const tests: TestCase[] = [];
  for (const file of generatedFiles) {
    const test = parseTestFile(file);
    if (options.timeout) test.config.timeout = options.timeout;
    if (options.stopOnFailure) test.config.stopOnFailure = true;
    tests.push(test);
  }

  // Apply headed mode if specified
  if (options.headed) {
    options.config.browser.headless = false;
  }

  const reporterNames = (options.reporter ?? "console").split(",");
  const reporter = createReporters(reporterNames, options.config.output.dir);

  // Create analyzer for failure analysis (optional)
  let analyzer: Analyzer | undefined;
  if (provider) {
    analyzer = new Analyzer(provider);
  }

  mkdirSync(options.config.output.dir, { recursive: true });
  const suiteResult = await runSuite(
    tests,
    "Gadget Check",
    options.config,
    reporter,
    analyzer,
  );

  return { generatedFiles, suiteResult };
}

function extractYamlDocuments(response: string): Record<string, unknown>[] {
  // Extract from code block
  let yaml = response;
  const codeBlockMatch = response.match(/```(?:yaml)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    yaml = codeBlockMatch[1];
  }

  // Split on document separator
  const docs = yaml
    .split(/\n---\s*\n/)
    .map((d) => d.trim())
    .filter((d) => d.length > 0);

  const results: Record<string, unknown>[] = [];
  for (const doc of docs) {
    try {
      const parsed = parseYaml(doc);
      if (parsed && typeof parsed === "object") {
        results.push(parsed as Record<string, unknown>);
      }
    } catch {
      // Skip unparseable YAML
    }
  }

  return results;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
