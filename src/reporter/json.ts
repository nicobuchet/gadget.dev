import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type {
  StepDefinition,
  StepResult,
  TestResult,
  SuiteResult,
  AuditReport,
  ReporterInterface,
} from "../types/index.js";

export class JsonReporter implements ReporterInterface {
  constructor(private outputDir: string) {}

  onTestStart(_name: string): void {}
  onStepResult(_step: StepDefinition, _result: StepResult): void {}
  onTestEnd(_result: TestResult): void {}

  onSuiteEnd(result: SuiteResult): void {
    mkdirSync(this.outputDir, { recursive: true });
    writeFileSync(
      join(this.outputDir, "suite-result.json"),
      JSON.stringify(result, null, 2),
    );
  }

  onAuditEnd(report: AuditReport): void {
    mkdirSync(this.outputDir, { recursive: true });
    writeFileSync(
      join(this.outputDir, "audit-report.json"),
      JSON.stringify(report, null, 2),
    );
  }
}
