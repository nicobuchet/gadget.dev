import type {
  AIProvider,
  GadgetConfig,
  SuiteResult,
  AuditVerdict,
  AuditFinding,
  TestCase,
} from "../types/index.js";
import { describeStep } from "../runner/runner.js";
import { readFileSync } from "node:fs";

export class Analyzer {
  constructor(private provider: AIProvider) {}

  async auditSuite(
    suiteResult: SuiteResult,
    tests: TestCase[],
    config: GadgetConfig,
  ): Promise<{ verdict: AuditVerdict; findings: AuditFinding[] }> {
    if (!this.provider.auditSuite) {
      // Fallback: derive a basic verdict from pass/fail counts
      const readiness = suiteResult.failed === 0 ? "ready" : "not-ready";
      const total = suiteResult.tests.length;
      const qualityScore = total > 0 ? Math.round((suiteResult.passed / total) * 100) : 0;
      return {
        verdict: {
          readiness,
          confidence: 1.0,
          qualityScore,
          summary: suiteResult.failed === 0
            ? `All ${suiteResult.passed} tests passed.`
            : `${suiteResult.failed} of ${suiteResult.tests.length} tests failed.`,
        },
        findings: suiteResult.tests
          .filter(t => t.status === "fail")
          .flatMap(t => t.steps.filter(s => s.status === "fail").map(s => ({
            severity: "critical" as const,
            title: `${t.name}: ${s.error?.slice(0, 80) ?? "step failed"}`,
            description: s.error ?? "Unknown failure",
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
      const total = suiteResult.tests.length;
      const qualityScore = total > 0 ? Math.round((suiteResult.passed / total) * 100) : 0;
      return {
        verdict: {
          readiness: suiteResult.failed === 0 ? "ready" : "not-ready",
          confidence: 0.5,
          qualityScore,
          summary: "AI audit analysis unavailable. Verdict based on pass/fail counts only.",
        },
        findings: [],
      };
    }
  }
}
