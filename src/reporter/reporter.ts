import type {
  StepDefinition,
  StepResult,
  TestResult,
  SuiteResult,
  ReporterInterface,
} from "../types/index.js";
import { ConsoleReporter } from "./console.js";
import { HtmlReporter } from "./html.js";
import { JunitReporter } from "./junit.js";
import { GithubReporter } from "./github.js";

export class MultiReporter implements ReporterInterface {
  constructor(private reporters: ReporterInterface[]) {}

  onTestStart(name: string): void {
    for (const r of this.reporters) r.onTestStart(name);
  }

  onStepResult(step: StepDefinition, result: StepResult): void {
    for (const r of this.reporters) r.onStepResult(step, result);
  }

  onTestEnd(result: TestResult): void {
    for (const r of this.reporters) r.onTestEnd(result);
  }

  onSuiteEnd(result: SuiteResult): void {
    for (const r of this.reporters) r.onSuiteEnd(result);
  }
}

export function createReporters(
  names: string[],
  outputDir: string = ".gadget/results",
): ReporterInterface {
  const reporters: ReporterInterface[] = [];

  for (const name of names) {
    switch (name) {
      case "console":
        reporters.push(new ConsoleReporter());
        break;
      case "html":
        reporters.push(new HtmlReporter(outputDir));
        break;
      case "junit":
        reporters.push(new JunitReporter(outputDir));
        break;
      case "github":
        reporters.push(new GithubReporter());
        break;
      default:
        console.warn(`Unknown reporter: ${name}, skipping`);
    }
  }

  if (reporters.length === 0) {
    reporters.push(new ConsoleReporter());
  }

  return new MultiReporter(reporters);
}
