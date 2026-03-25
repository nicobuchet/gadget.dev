import type { Page } from "playwright";
import type {
  AIProvider,
  FailureAnalysis,
  StepDefinition,
  StepResult,
  GadgetConfig,
  TestConfig,
} from "../types/index.js";
import { TestBrowserContext } from "../runner/context.js";
import { executeClick } from "../runner/commands/click.js";
import { executeFill } from "../runner/commands/fill.js";
import { executeWait } from "../runner/commands/wait.js";
import { join } from "node:path";

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
