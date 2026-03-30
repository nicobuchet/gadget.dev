#!/usr/bin/env node

import { Command } from "commander";
import { resolve } from "node:path";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolveTestPaths } from "../parser/resolver.js";
import { parseTestFile, parseSuiteFile, parseConfig } from "../parser/parser.js";
import { runSuite } from "../runner/runner.js";
import { createReporters } from "../reporter/reporter.js";
import { createProvider } from "../analyzer/providers/provider.js";
import { Analyzer } from "../analyzer/analyzer.js";
import { check } from "../checker/generator.js";
import type { TestCase, GadgetConfig } from "../types/index.js";
import { DEFAULT_CONFIG } from "../types/index.js";

const program = new Command();

program
  .name("gadget")
  .description("AI-powered E2E testing CLI tool")
  .version("0.1.0");

// ── run command ──

program
  .command("run")
  .description("Run E2E tests")
  .argument("<paths...>", "test files, directories, or suite files")
  .option("--headed", "run browser in headed mode")
  .option("--base-url <url>", "override base URL")
  .option("--timeout <ms>", "override default timeout", parseInt)
  .option("--reporter <names>", "comma-separated reporter names", "console")
  .option("--output <dir>", "output directory")
  .option("--provider <name>", "AI provider name")
  .option("--stop-on-failure", "stop on first failure")
  .option("--dry-run", "validate YAML without executing")
  .action(async (paths: string[], options) => {
    try {
      // Load config
      const fileConfig = parseConfig(process.cwd());
      const config = mergeConfig(fileConfig, options);

      // Resolve all test files
      const allFiles: string[] = [];
      for (const p of paths) {
        allFiles.push(...resolveTestPaths(p));
      }

      if (allFiles.length === 0) {
        console.error("No test files found");
        process.exitCode = 2;
        return;
      }

      // Parse all test files
      const tests: TestCase[] = [];
      for (const file of allFiles) {
        try {
          const test = parseTestFile(file);
          // Apply CLI overrides
          if (options.baseUrl) test.config.baseUrl = options.baseUrl;
          if (options.timeout) test.config.timeout = options.timeout;
          if (options.stopOnFailure) test.config.stopOnFailure = true;
          tests.push(test);
        } catch (err) {
          console.error(`Parse error in ${file}:`);
          console.error(err instanceof Error ? err.message : err);
          process.exitCode = 2;
          return;
        }
      }

      // Dry run: just validate
      if (options.dryRun) {
        console.log(`Validated ${tests.length} test file(s) successfully`);
        return;
      }

      // Create reporter
      const reporterNames = (options.reporter as string).split(",");
      const reporter = createReporters(reporterNames, config.output.dir);

      // Create analyzer if AI provider is configured
      let analyzer: Analyzer | undefined;
      const provider = createProvider(config);
      if (provider) {
        analyzer = new Analyzer(provider);
      }

      // Ensure output directory exists
      mkdirSync(config.output.dir, { recursive: true });

      // Run
      const result = await runSuite(tests, "Gadget Run", config, reporter, analyzer);

      process.exitCode = result.failed > 0 ? 1 : 0;
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 2;
    }
  });

// ── check command ──

program
  .command("check")
  .description("Auto-generate and run E2E tests from git diff")
  .option("--base-url <url>", "base URL to test against")
  .option("--base-branch <branch>", "git branch to diff against")
  .option("--mr <url>", "merge request / pull request URL for context")
  .option("--output-dir <dir>", "directory for generated test files")
  .option("--no-run", "only generate tests, do not execute them")
  .option("--headed", "run browser in headed mode")
  .option("--timeout <ms>", "override default timeout", parseInt)
  .option("--reporter <names>", "comma-separated reporter names", "console")
  .option("--stop-on-failure", "stop on first failure")
  .action(async (options) => {
    try {
      const fileConfig = parseConfig(process.cwd());
      const config = mergeConfig(fileConfig, options);
      const checkConfig = config.check ?? {};

      // Resolve baseUrl: CLI flag > config check > config browser (not applicable) > error
      const baseUrl =
        options.baseUrl ?? checkConfig.baseBranch ?? undefined;

      // Try to find baseUrl from the config or CLI
      const resolvedBaseUrl = options.baseUrl;
      if (!resolvedBaseUrl) {
        console.error(
          "Error: --base-url is required for gadget check.\n" +
            "  Example: gadget check --base-url http://localhost:3000",
        );
        process.exitCode = 2;
        return;
      }

      const result = await check({
        baseUrl: resolvedBaseUrl,
        baseBranch: options.baseBranch ?? checkConfig.baseBranch ?? "main",
        mrUrl: options.mr,
        outputDir: options.outputDir ?? checkConfig.outputDir ?? ".gadget/generated",
        run: options.run !== false,
        config,
        headed: options.headed,
        timeout: options.timeout,
        reporter: options.reporter,
        stopOnFailure: options.stopOnFailure,
      });

      if (result.suiteResult) {
        process.exitCode = result.suiteResult.failed > 0 ? 1 : 0;
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 2;
    }
  });

// ── validate command ──

program
  .command("validate")
  .description("Validate YAML test files without executing")
  .argument("<paths...>", "test files or directories")
  .action((paths: string[]) => {
    let hasErrors = false;

    for (const p of paths) {
      const files = resolveTestPaths(p);
      for (const file of files) {
        try {
          parseTestFile(file);
          console.log(`✓ ${file}`);
        } catch (err) {
          console.error(`✗ ${file}`);
          console.error(`  ${err instanceof Error ? err.message : err}`);
          hasErrors = true;
        }
      }
    }

    process.exitCode = hasErrors ? 2 : 0;
  });

// ── init command ──

program
  .command("init")
  .description("Scaffold a .gadgetrc.yaml and example test")
  .action(() => {
    const configContent = `ai:
  provider: claude
  model: claude-sonnet-4-6
  apiKey: "{{ env.ANTHROPIC_API_KEY }}"
  maxTokens: 1024

browser:
  headless: true
  viewport: { width: 1280, height: 720 }
  slowMo: 0

output:
  dir: ".gadget/results"
  reporters:
    - console
`;

    const exampleTest = `name: Example Test
config:
  baseUrl: "https://example.com"
  timeout: 10000
  screenshot: on-failure

steps:
  - navigate: "/"

  - assert:
      title: "Example Domain"

  - verify: "The page displays a heading and a paragraph of text"
`;

    if (!existsSync(".gadgetrc.yaml")) {
      writeFileSync(".gadgetrc.yaml", configContent);
      console.log("Created .gadgetrc.yaml");
    } else {
      console.log(".gadgetrc.yaml already exists, skipping");
    }

    mkdirSync("tests", { recursive: true });
    const testPath = "tests/example.test.yaml";
    if (!existsSync(testPath)) {
      writeFileSync(testPath, exampleTest);
      console.log(`Created ${testPath}`);
    } else {
      console.log(`${testPath} already exists, skipping`);
    }

    console.log("\nRun your first test:");
    console.log("  npx gadget run tests/example.test.yaml");
  });

// ── providers command ──

program
  .command("providers")
  .description("List available AI providers")
  .action(() => {
    const providers = [
      {
        name: "claude",
        envVar: "ANTHROPIC_API_KEY",
        configured: !!process.env.ANTHROPIC_API_KEY,
      },
      {
        name: "openai",
        envVar: "OPENAI_API_KEY",
        configured: !!process.env.OPENAI_API_KEY,
      },
    ];

    console.log("Available AI providers:\n");
    for (const p of providers) {
      const status = p.configured ? "✓ configured" : "✗ not configured";
      const statusStr = p.configured ? `\x1b[32m${status}\x1b[0m` : `\x1b[31m${status}\x1b[0m`;
      console.log(`  ${p.name.padEnd(10)} ${statusStr}  (${p.envVar})`);
    }
  });

// ── Config merging ──

function mergeConfig(
  fileConfig: GadgetConfig | null,
  options: Record<string, unknown>,
): GadgetConfig {
  const config = fileConfig ?? { ...DEFAULT_CONFIG };

  if (options.headed) {
    config.browser.headless = false;
  }
  if (options.output) {
    config.output.dir = options.output as string;
  }
  if (options.provider) {
    config.ai.provider = options.provider as string;
  }

  return config;
}

program.parse();
