import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type {
  StepDefinition,
  StepResult,
  TestResult,
  SuiteResult,
  ReporterInterface,
} from "../types/index.js";
import { describeStep } from "../runner/runner.js";

export class JunitReporter implements ReporterInterface {
  private testResults: TestResult[] = [];

  constructor(private outputDir: string) {}

  onTestStart(_name: string): void {}
  onStepResult(_step: StepDefinition, _result: StepResult): void {}

  onTestEnd(result: TestResult): void {
    this.testResults.push(result);
  }

  onSuiteEnd(result: SuiteResult): void {
    const xml = this.generateXml(result);
    mkdirSync(this.outputDir, { recursive: true });
    writeFileSync(join(this.outputDir, "junit.xml"), xml);
  }

  private generateXml(suite: SuiteResult): string {
    const testSuites = this.testResults
      .map((test) => this.renderTestSuite(test))
      .join("\n");

    const totalTests = this.testResults.reduce(
      (acc, t) => acc + t.steps.length,
      0,
    );
    const totalFailures = this.testResults.reduce(
      (acc, t) => acc + t.steps.filter((s) => s.status === "fail").length,
      0,
    );
    const totalSkipped = this.testResults.reduce(
      (acc, t) => acc + t.steps.filter((s) => s.status === "skip").length,
      0,
    );

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="${this.escapeXml(suite.name)}" tests="${totalTests}" failures="${totalFailures}" skipped="${totalSkipped}" time="${(suite.duration / 1000).toFixed(3)}">
${testSuites}
</testsuites>`;
  }

  private renderTestSuite(test: TestResult): string {
    const failures = test.steps.filter((s) => s.status === "fail").length;
    const skipped = test.steps.filter((s) => s.status === "skip").length;

    const cases = test.steps.map((s) => this.renderTestCase(test.name, s)).join("\n");

    return `  <testsuite name="${this.escapeXml(test.name)}" tests="${test.steps.length}" failures="${failures}" skipped="${skipped}" time="${(test.duration / 1000).toFixed(3)}">
${cases}
  </testsuite>`;
  }

  private renderTestCase(testName: string, result: StepResult): string {
    const name = describeStep(result.step);
    const time = (result.duration / 1000).toFixed(3);

    if (result.status === "skip") {
      return `    <testcase name="${this.escapeXml(name)}" classname="${this.escapeXml(testName)}" time="${time}">
      <skipped/>
    </testcase>`;
    }

    if (result.status === "fail") {
      let message = result.error ?? "Unknown error";
      if (result.analysis) {
        message += `\n\nAI Analysis: ${result.analysis.summary} [${result.analysis.category}]`;
        if (result.analysis.suggestedFix) {
          message += `\nSuggested fix: ${result.analysis.suggestedFix}`;
        }
      }

      return `    <testcase name="${this.escapeXml(name)}" classname="${this.escapeXml(testName)}" time="${time}">
      <failure message="${this.escapeXml(result.error ?? "Unknown error")}">${this.escapeXml(message)}</failure>
    </testcase>`;
    }

    return `    <testcase name="${this.escapeXml(name)}" classname="${this.escapeXml(testName)}" time="${time}"/>`;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}
