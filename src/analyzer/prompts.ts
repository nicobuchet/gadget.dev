import type { TestResult, StepResult } from "../types/index.js";

// ── Audit Prompts ──

export function auditSystemPrompt(): string {
  return `You are a beta tester manually testing a web application. You are looking at real screenshots of the application as a user navigates through it.

Your job is to review the UI and UX of the SPECIFIC FLOW being tested, as if you were a real user going through that flow. Focus on:
1. Does the UI look correct on the pages that are PART OF the flow?
2. Does the flow feel intuitive? Is the user experience smooth or confusing?
3. Are there loading states, error messages, or empty states that look wrong ON THE PAGES BEING TESTED?
4. Is the content readable? Are labels, buttons, and text clear and well-placed?
5. Are there any visual regressions, alignment issues, or styling problems?

CRITICAL SCOPING RULES:
- ONLY provide feedback on the pages and UI elements that are directly part of the flow being tested.
- The LAST screenshot of a flow is often just a confirmation that the flow succeeded (e.g. a redirect to a dashboard after login). Do NOT review or critique that destination page — it is out of scope. If the flow ends with a successful redirect, that means the flow works.
- For example: a "Login Flow" test should get feedback on the login PAGE (form layout, labels, inputs, button) and whether login succeeds. The dashboard that appears after login is NOT part of the login flow — do not comment on it.
- Do NOT comment on test coverage, test quality, test methodology, security practices, or password strength.
- Only report what you can actually see in the screenshots as a user would experience it, scoped to the flow being tested.

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
    "qualityScore": 0 to 100,
    "summary": "short paragraph assessing this specific flow from a user perspective"
  },
  "findings": [
    {
      "severity": "critical" | "warning" | "nitpick" | "improvement",
      "title": "short descriptive title",
      "description": "detailed explanation of what you see and your recommendation",
      "relatedStep": step_index_number (optional)
    }
  ]
}

Quality score guidelines:
- Start at 100 and deduct based on findings: critical issues (-20 each), warnings (-10 each), nitpicks (-3 each), improvements (-1 each).
- Use this as a baseline but adjust based on the overall impression — a single critical bug that blocks the entire flow may warrant a lower score than the formula suggests.
- The score must be an integer between 0 and 100. A score of 80+ generally means the feature is ready for production.

Guidelines for the verdict:
- "ready": The UI works and looks good. The user can complete the tested flow without issues.
- "not-ready": There are broken screens or steps that prevent the user from completing the flow.
- "needs-attention": The flow works but there are visible UI/UX problems worth fixing before release.

If you have no screenshots to review, base your verdict only on whether the flow succeeded or failed.`;
}

export function auditTestUserPrompt(
  testResult: TestResult,
  stepDescriptions: string[],
): string {
  const outcome = testResult.status === "pass" ? "completed successfully" : "failed";
  const failedSteps = testResult.steps
    .map((step: StepResult, i: number) => ({ step, index: i }))
    .filter(({ step }) => step.status === "fail")
    .map(({ step, index }) => `  - Step ${index} failed: ${step.error ?? "unknown error"}`)
    .join("\n");

  const lastIndex = stepDescriptions.length - 1;
  const steps = stepDescriptions.map((s, i) => {
    const label = i === lastIndex
      ? `  ${i}. ${s}  ← FINAL STEP (confirmation only — do NOT review this page)`
      : `  ${i}. ${s}`;
    return label;
  }).join("\n");

  return `The screenshots above show the user's journey through the "${testResult.name}" flow. Review them as a beta tester would.

IMPORTANT: Only review the pages that are part of the flow itself. The last screenshot is typically a redirect/confirmation that the flow succeeded — do NOT review or critique that destination page.

## Flow: ${testResult.name}
User journey:
${steps}

## Outcome — ${outcome}
${failedSteps ? `Failed steps:\n${failedSteps}` : "All steps passed."}

Provide your feedback ONLY on the flow pages (not the destination after completion) as JSON.`;
}
