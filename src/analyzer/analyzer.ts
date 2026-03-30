import type { Page } from "playwright";
import type {
  AIProvider,
  FailureAnalysis,
  StepDefinition,
  StepResult,
  GadgetConfig,
  TestConfig,
  SuiteResult,
  AuditVerdict,
  AuditFinding,
  TestCase,
} from "../types/index.js";
import { TestBrowserContext } from "../runner/context.js";
import { executeClick } from "../runner/commands/click.js";
import { executeFill } from "../runner/commands/fill.js";
import { executeWait } from "../runner/commands/wait.js";
import { describeStep } from "../runner/runner.js";
import { join } from "node:path";
import { readFileSync } from "node:fs";

export class Analyzer {
  constructor(private provider: AIProvider) {}

  async analyzeFailure(
    screenshot: Buffer,
    step: StepDefinition,
    error: string,
    htmlSummary: string,
  ): Promise<FailureAnalysis> {
    try {
      return await this.provider.analyzeFailure({
        screenshot,
        step,
        error,
        htmlSummary,
      });
    } catch {
      return {
        summary: "AI analysis unavailable",
        category: "environment",
        details: "The AI provider failed to analyze this failure.",
      };
    }
  }

  async executeDoStep(
    page: Page,
    instruction: string,
    htmlSummary: string,
    config: TestConfig,
  ): Promise<StepResult> {
    const start = Date.now();
    const step: StepDefinition = { type: "do", instruction };

    try {
      const screenshot = await page.screenshot();
      const actions = await this.provider.interpretAction({
        screenshot: Buffer.from(screenshot),
        instruction,
        htmlSummary,
      });

      for (const action of actions) {
        switch (action.command) {
          case "click":
            await executeClick(
              { type: "click", target: action.params.target || action.params.text || "" },
              page,
              config,
            );
            break;
          case "fill":
            await executeFill(
              { type: "fill", label: action.params.label || "", value: action.params.value || "" },
              page,
              config,
            );
            break;
          case "wait":
            await executeWait(
              { type: "wait", selector: action.params.selector, timeout: Number(action.params.timeout) || undefined },
              page,
              config,
            );
            break;
          case "scroll":
            await page.evaluate((params) => {
              window.scrollBy(0, Number(params.y) || 300);
            }, action.params);
            break;
        }
      }

      return {
        step,
        status: "pass",
        duration: Date.now() - start,
      };
    } catch (err) {
      return {
        step,
        status: "fail",
        duration: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async auditSuite(
    suiteResult: SuiteResult,
    tests: TestCase[],
    config: GadgetConfig,
  ): Promise<{ verdict: AuditVerdict; findings: AuditFinding[] }> {
    if (!this.provider.auditSuite) {
      // Fallback: derive a basic verdict from pass/fail counts
      const readiness = suiteResult.failed === 0 ? "ready" : "not-ready";
      return {
        verdict: {
          readiness,
          confidence: 1.0,
          summary: suiteResult.failed === 0
            ? `All ${suiteResult.passed} tests passed.`
            : `${suiteResult.failed} of ${suiteResult.tests.length} tests failed.`,
        },
        findings: suiteResult.tests
          .filter(t => t.status === "fail")
          .flatMap(t => t.steps.filter(s => s.status === "fail").map(s => ({
            severity: "critical" as const,
            title: `${t.name}: ${s.error?.slice(0, 80) ?? "step failed"}`,
            description: s.analysis?.details ?? s.error ?? "Unknown failure",
            relatedTest: t.name,
          }))),
      };
    }

    // Collect failure screenshots from disk
    const screenshots: Array<{ testName: string; stepIndex: number; data: Buffer }> = [];
    for (const test of suiteResult.tests) {
      for (let i = 0; i < test.steps.length; i++) {
        const step = test.steps[i];
        if (step.screenshotPath) {
          try {
            const data = readFileSync(step.screenshotPath);
            screenshots.push({ testName: test.name, stepIndex: i, data });
          } catch {
            // Screenshot file missing, skip
          }
        }
      }
    }

    // Build human-readable step descriptions
    const testDescriptions = tests.map(t => ({
      name: t.name,
      steps: t.steps.map(s => describeStep(s)),
    }));

    const maxTokens = config.audit?.maxTokens ?? 4096;

    try {
      return await this.provider.auditSuite({
        suiteResult,
        screenshots,
        testDescriptions,
        maxTokens,
      });
    } catch {
      return {
        verdict: {
          readiness: suiteResult.failed === 0 ? "ready" : "not-ready",
          confidence: 0.5,
          summary: "AI audit analysis unavailable. Verdict based on pass/fail counts only.",
        },
        findings: [],
      };
    }
  }

  async executeVerifyStep(
    page: Page,
    assertion: string,
    htmlSummary: string,
    config: GadgetConfig,
  ): Promise<StepResult> {
    const start = Date.now();
    const step: StepDefinition = { type: "verify", assertion };

    try {
      const screenshot = await page.screenshot();
      const result = await this.provider.verifyVisual({
        screenshot: Buffer.from(screenshot),
        assertion,
        htmlSummary,
      });

      return {
        step,
        status: result.pass ? "pass" : "fail",
        duration: Date.now() - start,
        error: result.pass ? undefined : result.reason,
      };
    } catch (err) {
      return {
        step,
        status: "fail",
        duration: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
