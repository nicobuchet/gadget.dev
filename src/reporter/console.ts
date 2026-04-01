import chalk from "chalk";
import type {
  StepDefinition,
  StepResult,
  TestResult,
  SuiteResult,
  AuditReport,
  ReporterInterface,
} from "../types/index.js";
import { describeStep } from "../runner/runner.js";

export class ConsoleReporter implements ReporterInterface {
  onTestStart(name: string): void {
    console.log(chalk.bold.underline(`\n${name}`));
  }

  onStepResult(step: StepDefinition, result: StepResult): void {
    const description = describeStep(step);
    const duration = chalk.gray(`(${result.duration}ms)`);

    if (result.status === "pass") {
      console.log(`  ${chalk.green("✓")} ${description} ${duration}`);
    } else if (result.status === "skip") {
      console.log(`  ${chalk.yellow("○")} ${description} ${chalk.yellow("skipped")} ${duration}`);
    } else {
      console.log(`  ${chalk.red("✗")} ${description} ${duration}`);
      if (result.error) {
        console.log(`    ${chalk.red(result.error)}`);
      }
      if (result.screenshotPath) {
        console.log(`    ${chalk.gray(`Screenshot: ${result.screenshotPath}`)}`);
      }
    }
  }

  onTestEnd(result: TestResult): void {
    const passed = result.steps.filter((s) => s.status === "pass").length;
    const failed = result.steps.filter((s) => s.status === "fail").length;
    const skipped = result.steps.filter((s) => s.status === "skip").length;

    const parts = [
      chalk.green(`${passed} passed`),
      ...(failed > 0 ? [chalk.red(`${failed} failed`)] : []),
      ...(skipped > 0 ? [chalk.yellow(`${skipped} skipped`)] : []),
    ];

    console.log(`\n  ${parts.join(", ")} ${chalk.gray(`(${result.duration}ms)`)}`);
  }

  onSuiteEnd(result: SuiteResult): void {
    console.log(chalk.bold("\n─────────────────────────────────"));
    console.log(chalk.bold(`Suite: ${result.name}`));

    const statusColor = result.failed > 0 ? chalk.red : chalk.green;
    console.log(
      statusColor(
        `  ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped`,
      ),
    );
    console.log(chalk.gray(`  Total time: ${result.duration}ms`));
    console.log(chalk.bold("─────────────────────────────────\n"));
  }

  onAuditEnd(report: AuditReport): void {
    const verdictColors = {
      "ready": chalk.green,
      "not-ready": chalk.red,
      "needs-attention": chalk.yellow,
    };
    const color = verdictColors[report.verdict.readiness];

    console.log(chalk.bold("\n═════════════════════════════════"));
    console.log(chalk.bold("  AUDIT VERDICT"));
    console.log(chalk.bold("═════════════════════════════════"));
    console.log(color.bold(`  ${report.verdict.readiness.toUpperCase()}`));
    const score = report.verdict.qualityScore;
    const scoreColor = score >= 80 ? chalk.green : score >= 50 ? chalk.yellow : chalk.red;
    console.log(scoreColor.bold(`  Quality Score: ${score}/100`));
    console.log(chalk.gray(`  Confidence: ${(report.verdict.confidence * 100).toFixed(0)}%`));
    console.log(`\n  ${report.verdict.summary}`);

    const severityConfig = {
      critical: { color: chalk.red, icon: "!!" },
      warning: { color: chalk.yellow, icon: "!" },
      nitpick: { color: chalk.cyan, icon: "~" },
      improvement: { color: chalk.blue, icon: "+" },
    } as const;

    for (const severity of ["critical", "warning", "nitpick", "improvement"] as const) {
      const findings = report.findings.filter(f => f.severity === severity);
      if (findings.length === 0) continue;

      const { color: sColor, icon } = severityConfig[severity];
      console.log(sColor.bold(`\n  [${icon}] ${severity.toUpperCase()} (${findings.length})`));

      for (const finding of findings) {
        console.log(sColor(`    ${finding.title}`));
        console.log(chalk.gray(`      ${finding.description}`));
        if (finding.relatedTest) {
          console.log(chalk.gray(`      Test: ${finding.relatedTest}`));
        }
      }
    }

    console.log(chalk.bold("\n═════════════════════════════════\n"));
  }
}
