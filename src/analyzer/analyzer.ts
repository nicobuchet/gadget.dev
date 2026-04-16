import type {
  AIProvider,
  GadgetConfig,
  SuiteResult,
  AuditVerdict,
  AuditFinding,
  TestCase,
  ProductionReadiness,
} from "../types/index.js";
import { SEVERITY_WEIGHTS } from "../types/index.js";
import { describeStep } from "../runner/runner.js";
import { readFileSync } from "node:fs";

export class Analyzer {
  constructor(private provider: AIProvider) {}

  async auditSuite(
    suiteResult: SuiteResult,
    tests: TestCase[],
    config: GadgetConfig,
  ): Promise<{ verdict: AuditVerdict; findings: AuditFinding[] }> {
    if (!this.provider.auditTest) {
      return fallbackVerdict(suiteResult);
    }

    const maxTokens = config.audit?.maxTokens ?? 4096;

    // Run per-test audits in parallel
    const auditPromises = suiteResult.tests.map((testResult, idx) => {
      const testCase = tests[idx];

      // Collect screenshots for this test. Skip the final step — auditSystemPrompt
      // tells Claude to ignore the last screenshot (it's usually a post-redirect
      // confirmation page out of scope for the flow), so sending it wastes vision
      // tokens. Tests with a single step keep that step as the only signal.
      const screenshots: Array<{ stepIndex: number; data: Buffer }> = [];
      const lastReviewable = testResult.steps.length <= 1
        ? testResult.steps.length
        : testResult.steps.length - 1;
      for (let i = 0; i < lastReviewable; i++) {
        const step = testResult.steps[i];
        if (step.screenshotPath) {
          try {
            const data = readFileSync(step.screenshotPath);
            screenshots.push({ stepIndex: i, data });
          } catch {
            // Screenshot file missing, skip
          }
        }
      }

      const stepDescriptions = testCase.steps.map(s => describeStep(s));

      return this.provider.auditTest!({
        testResult,
        screenshots,
        stepDescriptions,
        maxTokens,
      }).catch((): { verdict: AuditVerdict; findings: AuditFinding[] } => {
        // If a single test audit fails, produce a fallback for that test
        const findings: AuditFinding[] = testResult.steps
          .filter(s => s.status === "fail")
          .map(s => ({
            severity: "critical" as const,
            title: `${testResult.name}: ${s.error?.slice(0, 80) ?? "step failed"}`,
            description: s.error ?? "Unknown failure",
            relatedTest: testResult.name,
          }));
        return {
          verdict: {
            readiness: testResult.status === "pass" ? "ready" : "not-ready",
            confidence: 0.5,
            qualityScore: computeFallbackScore(findings),
            summary: `AI audit unavailable for "${testResult.name}". Verdict based on pass/fail only.`,
          },
          findings,
        };
      });
    });

    const perTestResults = await Promise.all(auditPromises);

    // Aggregate results
    return aggregate(suiteResult, perTestResults);
  }
}

function aggregate(
  suiteResult: SuiteResult,
  perTestResults: Array<{ verdict: AuditVerdict; findings: AuditFinding[] }>,
): { verdict: AuditVerdict; findings: AuditFinding[] } {
  // Collect all findings, tagging each with its test name
  const allFindings: AuditFinding[] = [];
  for (let i = 0; i < perTestResults.length; i++) {
    const testName = suiteResult.tests[i].name;
    for (const finding of perTestResults[i].findings) {
      allFindings.push({ ...finding, relatedTest: testName });
    }
  }

  // Quality score: average of per-test scores when all pass
  const scores = perTestResults.map(r => r.verdict.qualityScore);
  const allPassed = suiteResult.failed === 0;
  const qualityScore = allPassed
    ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
    : Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);

  // Readiness: worst across all tests
  const readinessRank: Record<ProductionReadiness, number> = {
    "not-ready": 0,
    "needs-attention": 1,
    "ready": 2,
  };
  const readinessValues = perTestResults.map(r => r.verdict.readiness);
  const worstReadiness = readinessValues.reduce((worst, r) =>
    readinessRank[r] < readinessRank[worst] ? r : worst,
  );

  // Confidence: minimum across all tests
  const confidence = Math.min(...perTestResults.map(r => r.verdict.confidence));

  // Summary: combine per-test summaries
  const summaryLines = perTestResults.map((r, i) =>
    `- ${suiteResult.tests[i].name}: ${r.verdict.summary}`,
  );
  const summary = `Audited ${perTestResults.length} flows. ` +
    `Quality score: ${qualityScore}/100.\n${summaryLines.join("\n")}`;

  return {
    verdict: {
      readiness: worstReadiness,
      confidence,
      qualityScore,
      summary,
    },
    findings: allFindings,
  };
}

function computeFallbackScore(findings: AuditFinding[]): number {
  const deductions = findings.reduce((sum, f) => sum + (SEVERITY_WEIGHTS[f.severity] ?? 0), 0);
  return Math.max(0, 100 - deductions);
}

function fallbackVerdict(suiteResult: SuiteResult): { verdict: AuditVerdict; findings: AuditFinding[] } {
  const readiness = suiteResult.failed === 0 ? "ready" : "not-ready";
  const findings: AuditFinding[] = suiteResult.tests
    .filter(t => t.status === "fail")
    .flatMap(t => t.steps.filter(s => s.status === "fail").map(s => ({
      severity: "critical" as const,
      title: `${t.name}: ${s.error?.slice(0, 80) ?? "step failed"}`,
      description: s.error ?? "Unknown failure",
      relatedTest: t.name,
    })));
  const qualityScore = computeFallbackScore(findings);
  return {
    verdict: {
      readiness,
      confidence: 1.0,
      qualityScore,
      summary: suiteResult.failed === 0
        ? `All ${suiteResult.passed} tests passed.`
        : `${suiteResult.failed} of ${suiteResult.tests.length} tests failed.`,
    },
    findings,
  };
}
