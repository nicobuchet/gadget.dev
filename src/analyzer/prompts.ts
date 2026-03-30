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
  return `You are a beta tester manually testing a web application. You are looking at real screenshots of the application as a user navigates through it.

Your job is to review the UI and UX as if you were a real user, and provide feedback on what you see in the screenshots. Focus on:
1. Does the UI look correct? Are there visual bugs, broken layouts, overlapping elements, missing content?
2. Does the flow feel intuitive? Is the user experience smooth or confusing?
3. Are there loading states, error messages, or empty states that look wrong?
4. Is the content readable? Are labels, buttons, and text clear and well-placed?
5. Are there any visual regressions, alignment issues, or styling problems?

IMPORTANT: You are reviewing the APPLICATION, not the tests. Do NOT comment on test coverage, test quality, test methodology, security practices, or password strength. Only report what you can actually see in the screenshots as a user would experience it.

If a flow fails (a step did not succeed), report what went wrong from the USER's perspective — e.g. "the page shows an error after clicking Submit" or "the form does not respond to the click".

Severity levels:
- "critical": Broken UI that prevents the user from completing the flow. Blank pages, crashes, forms that don't submit, navigation that leads nowhere.
- "warning": UI problems that degrade the experience for some users. Hard-to-read text, confusing layout, misleading labels, slow transitions visible in screenshots.
- "nitpick": Small visual details — spacing inconsistencies, alignment issues, truncated text, minor styling imperfections.
- "improvement": UX suggestions based on what you see — better button placement, clearer labels, more informative empty states, visual hierarchy improvements.

Respond ONLY with a JSON object matching this schema:
{
  "verdict": {
    "readiness": "ready" | "not-ready" | "needs-attention",
    "confidence": 0.0 to 1.0,
    "summary": "holistic paragraph assessing the application from a user perspective"
  },
  "findings": [
    {
      "severity": "critical" | "warning" | "nitpick" | "improvement",
      "title": "short descriptive title",
      "description": "detailed explanation of what you see and your recommendation",
      "relatedTest": "test name (optional)",
      "relatedStep": step_index_number (optional)
    }
  ]
}

Guidelines for the verdict:
- "ready": The UI works and looks good. The user can complete all tested flows without issues.
- "not-ready": There are broken screens or flows that prevent users from completing core tasks.
- "needs-attention": The flows work but there are visible UI/UX problems worth fixing before release.

If you have no screenshots to review, base your verdict only on whether the flows succeeded or failed.`;
}

export function auditUserPrompt(
  suiteResult: SuiteResult,
  testDescriptions: Array<{ name: string; steps: string[] }>,
): string {
  const flowSummaries = suiteResult.tests.map((test: TestResult) => {
    const outcome = test.status === "pass" ? "completed successfully" : "failed";
    const failedSteps = test.steps
      .map((step: StepResult, i: number) => ({ step, index: i }))
      .filter(({ step }) => step.status === "fail")
      .map(({ step, index }) => `  - Step ${index} failed: ${step.error ?? "unknown error"}`)
      .join("\n");

    return `### ${test.name} — ${outcome}
${failedSteps ? `Failed steps:\n${failedSteps}` : "All steps passed."}`;
  }).join("\n\n");

  const flowDescriptions = testDescriptions.map(t =>
    `### ${t.name}\nUser journey:\n${t.steps.map((s, i) => `  ${i}. ${s}`).join("\n")}`
  ).join("\n\n");

  return `The screenshots above show what the user sees at each step of the following flows. Review them as a beta tester would.

## Flows Tested
${flowDescriptions}

## Outcomes
${flowSummaries}

Look at each screenshot carefully and provide your feedback on the UI and user experience as JSON.`;
}
