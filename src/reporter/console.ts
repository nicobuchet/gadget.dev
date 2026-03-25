import chalk from "chalk";
import type {
  StepDefinition,
  StepResult,
  TestResult,
  SuiteResult,
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
      if (result.analysis) {
        console.log(`    ${chalk.cyan("AI Analysis:")}`);
        console.log(`      ${chalk.cyan(result.analysis.summary)}`);
        console.log(`      ${chalk.gray(`Category: ${result.analysis.category}`)}`);
        if (result.analysis.suggestedFix) {
          console.log(`      ${chalk.yellow(`Fix: ${result.analysis.suggestedFix}`)}`);
        }
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
}
