import type {
  StepDefinition,
  StepResult,
  TestResult,
  SuiteResult,
  ReporterInterface,
} from "../types/index.js";
import { describeStep } from "../runner/runner.js";

/**
 * Emits GitHub Actions workflow commands for inline PR annotations.
 * Format: ::error file=...,line=...::message
 */
export class GithubReporter implements ReporterInterface {
  private currentTest: string = "";
  private stepIndex: number = 0;

  onTestStart(name: string): void {
    this.currentTest = name;
    this.stepIndex = 0;
  }

  onStepResult(step: StepDefinition, result: StepResult): void {
    this.stepIndex++;

    if (result.status === "fail") {
      const desc = describeStep(step);
      let message = `${desc}: ${result.error ?? "Failed"}`;

      if (result.analysis) {
        message += ` | AI: ${result.analysis.summary} [${result.analysis.category}]`;
      }

      // Emit annotation — if we know the file, reference it
      const fileAttr = result.step.type === "navigate" ? "" : "";
      console.log(
        `::error title=${this.currentTest} step ${this.stepIndex}::${this.escapeMessage(message)}`,
      );
    }
  }

  onTestEnd(_result: TestResult): void {}

  onSuiteEnd(result: SuiteResult): void {
    if (result.failed > 0) {
      console.log(
        `::error::Gadget: ${result.failed} test(s) failed out of ${result.tests.length}`,
      );
    }
  }

  private escapeMessage(msg: string): string {
    return msg.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  }
}
