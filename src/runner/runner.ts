import { join } from "node:path";
import type { Page } from "playwright";
import type {
  TestCase,
  TestResult,
  SuiteResult,
  StepDefinition,
  StepResult,
  GadgetConfig,
  ReporterInterface,
} from "../types/index.js";
import { TestBrowserContext } from "./context.js";
import { executeNavigate } from "./commands/navigate.js";
import { executeFill } from "./commands/fill.js";
import { executeClick } from "./commands/click.js";
import { executeAssert } from "./commands/assert.js";
import { executeWait } from "./commands/wait.js";
import type { Analyzer } from "../analyzer/analyzer.js";

async function executeStep(
  step: StepDefinition,
  page: Page,
  config: TestCase["config"],
): Promise<void> {
  switch (step.type) {
    case "navigate":
      await executeNavigate(step, page, config);
      break;
    case "fill":
      await executeFill(step, page, config);
      break;
    case "click":
      await executeClick(step, page, config);
      break;
    case "assert":
      await executeAssert(step, page, config);
      break;
    case "wait":
      await executeWait(step, page, config);
      break;
    case "do":
    case "verify":
      // Handled separately by the runner with AI
      break;
  }
}

function describeStep(step: StepDefinition): string {
  switch (step.type) {
    case "navigate":
      return `Navigate to ${step.url}`;
    case "fill":
      return `Fill "${step.label}" with "${step.secure ? "••••••" : step.value}"`;
    case "click":
      return `Click "${step.target}"`;
    case "assert":
      if (step.text) return `Assert text "${step.text}" ${step.visible ? "visible" : "exists"}`;
      if (step.url) return `Assert URL contains "${step.url}"`;
      if (step.title) return `Assert title matches "${step.title}"`;
      return "Assert (unknown)";
    case "wait":
      if (step.url) return `Wait for URL "${step.url}"`;
      if (step.selector) return `Wait for selector "${step.selector}"`;
      return `Wait ${step.timeout ?? "default"}ms`;
    case "do":
      return `Do: ${step.instruction}`;
    case "verify":
      return `Verify: ${step.assertion}`;
  }
}

function sanitizeStep(step: StepDefinition): StepDefinition {
  if (step.type === "fill" && step.secure) {
    return { ...step, value: "••••••" };
  }
  return step;
}

export async function runTest(
  testCase: TestCase,
  browserCtx: TestBrowserContext,
  config: GadgetConfig,
  reporter?: ReporterInterface,
  analyzer?: Analyzer,
): Promise<TestResult> {
  const testStart = Date.now();
  const results: StepResult[] = [];
  const page = await browserCtx.newPage(config);

  reporter?.onTestStart(testCase.name);

  let stepIndex = 0;
  for (const step of testCase.steps) {
    const stepStart = Date.now();
    let result: StepResult;

    try {
      if (step.type === "do" || step.type === "verify") {
        if (!analyzer) {
          result = {
            step,
            status: "skip",
            duration: Date.now() - stepStart,
          };
        } else if (step.type === "do") {
          const htmlSummary = await browserCtx.getHtmlSummary(page);
          result = await analyzer.executeDoStep(page, step.instruction, htmlSummary, testCase.config);
        } else {
          const htmlSummary = await browserCtx.getHtmlSummary(page);
          result = await analyzer.executeVerifyStep(page, step.assertion, htmlSummary, config);
        }
      } else {
        await executeStep(step, page, testCase.config);
        result = {
          step,
          status: "pass",
          duration: Date.now() - stepStart,
        };
      }

      // Take screenshot if configured to always
      if (testCase.config.screenshot === "always") {
        // Wait for page to settle before capturing — avoids screenshots of loading/skeleton states
        await page.waitForLoadState("networkidle").catch(() => {});
        const settleMs = testCase.config.settle ?? 0;
        if (settleMs > 0) {
          await page.waitForTimeout(settleMs);
        }

        const screenshotPath = join(
          config.output.dir,
          "screenshots",
          `${testCase.name}-step-${stepIndex}.png`,
        );
        await browserCtx.screenshot(page, screenshotPath);
        result.screenshotPath = screenshotPath;
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);

      // Take screenshot on failure
      let screenshotPath: string | undefined;
      if (testCase.config.screenshot !== "never") {
        screenshotPath = join(
          config.output.dir,
          "screenshots",
          `${testCase.name}-step-${stepIndex}-failure.png`,
        );
        try {
          const screenshotBuffer = await browserCtx.screenshot(page, screenshotPath);

          // AI failure analysis if available
          if (analyzer) {
            const htmlSummary = await browserCtx.getHtmlSummary(page);
            const analysis = await analyzer.analyzeFailure(
              screenshotBuffer,
              step,
              error,
              htmlSummary,
            );
            result = {
              step,
              status: "fail",
              duration: Date.now() - stepStart,
              error,
              screenshotPath,
              analysis,
            };
          } else {
            result = {
              step,
              status: "fail",
              duration: Date.now() - stepStart,
              error,
              screenshotPath,
            };
          }
        } catch {
          result = {
            step,
            status: "fail",
            duration: Date.now() - stepStart,
            error,
          };
        }
      } else {
        result = {
          step,
          status: "fail",
          duration: Date.now() - stepStart,
          error,
        };
      }
    }

    result!.step = sanitizeStep(result!.step);
    results.push(result!);
    reporter?.onStepResult(result!.step, result!);

    if (result!.status === "fail" && testCase.config.stopOnFailure) {
      break;
    }

    stepIndex++;
  }

  await page.close().catch(() => {});

  const testResult: TestResult = {
    name: testCase.name,
    filePath: testCase.filePath,
    steps: results,
    status: results.some((r) => r.status === "fail") ? "fail" : "pass",
    duration: Date.now() - testStart,
  };

  reporter?.onTestEnd(testResult);
  return testResult;
}

export async function runSuite(
  tests: TestCase[],
  suiteName: string,
  config: GadgetConfig,
  reporter?: ReporterInterface,
  analyzer?: Analyzer,
): Promise<SuiteResult> {
  const suiteStart = Date.now();
  const browserCtx = new TestBrowserContext();
  await browserCtx.launch(config);

  const testResults: TestResult[] = [];

  try {
    for (const testCase of tests) {
      const result = await runTest(testCase, browserCtx, config, reporter, analyzer);
      testResults.push(result);
    }
  } finally {
    await browserCtx.close();
  }

  const suiteResult: SuiteResult = {
    name: suiteName,
    tests: testResults,
    passed: testResults.filter((t) => t.status === "pass").length,
    failed: testResults.filter((t) => t.status === "fail").length,
    skipped: testResults.reduce(
      (acc, t) => acc + t.steps.filter((s) => s.status === "skip").length,
      0,
    ),
    duration: Date.now() - suiteStart,
  };

  reporter?.onSuiteEnd(suiteResult);
  return suiteResult;
}

export { describeStep };
