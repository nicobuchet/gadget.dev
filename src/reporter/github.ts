import { appendFileSync } from "node:fs";
import type {
  StepDefinition,
  StepResult,
  TestResult,
  SuiteResult,
  AuditReport,
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

  onAuditEnd(report: AuditReport): void {
    // Emit annotations for critical/warning findings
    for (const finding of report.findings) {
      if (finding.severity === "critical") {
        console.log(`::error title=${this.escapeMessage(finding.title)}::${this.escapeMessage(finding.description)}`);
      } else if (finding.severity === "warning") {
        console.log(`::warning title=${this.escapeMessage(finding.title)}::${this.escapeMessage(finding.description)}`);
      }
    }

    // Write to GITHUB_STEP_SUMMARY if available
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (summaryFile) {
      const severityEmoji = { critical: "🔴", warning: "🟡", nitpick: "🔵", improvement: "💡" } as const;
      const criticals = report.findings.filter(f => f.severity === "critical").length;
      const warnings = report.findings.filter(f => f.severity === "warning").length;

      let md = `## Gadget Audit: **${report.verdict.readiness.toUpperCase()}**\n\n`;
      md += `> ${report.verdict.summary}\n\n`;
      md += `| Metric | Value |\n|--------|-------|\n`;
      md += `| Readiness | ${report.verdict.readiness} |\n`;
      md += `| Confidence | ${(report.verdict.confidence * 100).toFixed(0)}% |\n`;
      md += `| Tests Passed | ${report.suiteResult.passed}/${report.suiteResult.tests.length} |\n`;
      md += `| Critical Issues | ${criticals} |\n`;
      md += `| Warnings | ${warnings} |\n\n`;

      if (report.findings.length > 0) {
        md += `### Findings\n\n`;
        for (const finding of report.findings) {
          md += `${severityEmoji[finding.severity]} **[${finding.severity.toUpperCase()}]** ${finding.title}\n`;
          md += `> ${finding.description}\n\n`;
        }
      }

      appendFileSync(summaryFile, md);
    }
  }

  private escapeMessage(msg: string): string {
    return msg.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  }
}
