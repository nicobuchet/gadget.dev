import type { StepDefinition, SuiteResult, TestResult, StepResult } from "../types/index.js";

export function failureAnalysisSystemPrompt(): string {
  return `You are a QA analyst. You analyze E2E test failures and provide structured feedback.
You will receive a screenshot of the page, the step that failed, the error message, and an HTML summary of the page elements.

Respond ONLY with a JSON object matching this schema:
{
  "summary": "one-line description of what went wrong",
  "category": "test-bug" | "app-bug" | "environment" | "flaky",
  "details": "detailed explanation of the failure",
  "suggestedFix": "actionable suggestion to fix the issue (optional)"
}`;
}

export function failureAnalysisUserPrompt(
  step: StepDefinition,
  error: string,
  htmlSummary: string,
): string {
  return `## Failed Step
${JSON.stringify(step, null, 2)}

## Error
${error}

## Page HTML Summary
${htmlSummary}

Analyze this failure and respond with the JSON object.`;
}

export function visualVerifySystemPrompt(): string {
  return `You are a visual QA tester. You verify whether a web page matches a given assertion by analyzing a screenshot.

Respond ONLY with a JSON object matching this schema:
{
  "pass": true/false,
  "reason": "explanation of why the assertion passed or failed",
  "confidence": 0.0 to 1.0
}`;
}

export function visualVerifyUserPrompt(
  assertion: string,
  htmlSummary: string,
): string {
  return `## Assertion to Verify
${assertion}

## Page HTML Summary
${htmlSummary}

Look at the screenshot and determine if the assertion is true.`;
}

export function interpretActionSystemPrompt(): string {
  return `You are a web automation assistant. Given an instruction in natural language, a screenshot of the current page, and an HTML summary, determine the Playwright actions needed.

Available actions:
- click: { "command": "click", "params": { "target": "button text or label" } }
- fill: { "command": "fill", "params": { "label": "field label", "value": "text to type" } }
- scroll: { "command": "scroll", "params": { "y": "pixels to scroll" } }
- wait: { "command": "wait", "params": { "selector": "CSS selector", "timeout": "ms" } }

Respond ONLY with a JSON array of actions. Example:
[
  { "command": "click", "params": { "target": "Sign In" } }
]`;
}

export function interpretActionUserPrompt(
  instruction: string,
  htmlSummary: string,
): string {
  return `## Instruction
${instruction}

## Page HTML Summary
${htmlSummary}

Determine the Playwright actions needed and respond with the JSON array.`;
}

// ── Audit Prompts ──

export function auditSystemPrompt(): string {
  return `You are a senior QA lead performing a production readiness review for a web application.
You will receive the full results of an automated E2E test suite, including test outcomes, error details, and screenshots of failures.

Your job is to:
1. Assess whether the application is ready for production.
2. Provide structured findings categorized by severity.
3. Deduplicate: if the same root cause appears across multiple tests, report it as ONE finding referencing all affected tests.
4. Distinguish between real application bugs and test infrastructure issues.
5. Look beyond pass/fail — suggest UX improvements even for passing flows if you notice issues in the screenshots.

Severity levels:
- "critical": Must be fixed before production. Broken core flows, data loss risks, security issues.
- "warning": Problems that might block some users or degrade experience significantly. Not severe enough for critical.
- "nitpick": Small details worth addressing to improve UX — cosmetic issues, minor inconsistencies.
- "improvement": Suggestions for future versions — feature ideas, UX enhancements, accessibility improvements.

Respond ONLY with a JSON object matching this schema:
{
  "verdict": {
    "readiness": "ready" | "not-ready" | "needs-attention",
    "confidence": 0.0 to 1.0,
    "summary": "holistic paragraph assessing the application state"
  },
  "findings": [
    {
      "severity": "critical" | "warning" | "nitpick" | "improvement",
      "title": "short descriptive title",
      "description": "detailed explanation with context and recommendation",
      "relatedTest": "test name (optional)",
      "relatedStep": step_index_number (optional)
    }
  ]
}

Guidelines for the verdict:
- "ready": All critical flows work. Minor issues may exist but nothing blocks production.
- "not-ready": Critical failures exist. Core flows are broken.
- "needs-attention": No critical failures but significant warnings that should be reviewed before release.`;
}

export function auditUserPrompt(
  suiteResult: SuiteResult,
  testDescriptions: Array<{ name: string; steps: string[] }>,
): string {
  const summary = `## Suite Summary
- Suite: ${suiteResult.name}
- Total tests: ${suiteResult.tests.length}
- Passed: ${suiteResult.passed}
- Failed: ${suiteResult.failed}
- Skipped: ${suiteResult.skipped}
- Duration: ${suiteResult.duration}ms`;

  const testsDetail = suiteResult.tests.map((test: TestResult) => {
    const stepsDetail = test.steps.map((step: StepResult, i: number) => {
      let line = `  Step ${i}: [${step.status}] ${JSON.stringify(step.step)}`;
      if (step.error) line += `\n    Error: ${step.error}`;
      if (step.analysis) {
        line += `\n    Analysis: ${step.analysis.summary} (${step.analysis.category})`;
        if (step.analysis.suggestedFix) line += `\n    Suggested fix: ${step.analysis.suggestedFix}`;
      }
      return line;
    }).join("\n");

    return `### ${test.name} [${test.status}] (${test.duration}ms)
${stepsDetail}`;
  }).join("\n\n");

  const flowDescriptions = testDescriptions.map(t =>
    `### ${t.name}\n${t.steps.map((s, i) => `  ${i}. ${s}`).join("\n")}`
  ).join("\n\n");

  return `${summary}

## Test Results
${testsDetail}

## Flow Descriptions
${flowDescriptions}

Analyze the full suite results and screenshots, then provide your production readiness assessment as JSON.`;
}
