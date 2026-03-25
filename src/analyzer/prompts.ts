import type { StepDefinition } from "../types/index.js";

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
