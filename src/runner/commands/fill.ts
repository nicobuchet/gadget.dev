import type { Page } from "playwright";
import type { FillStep, TestConfig } from "../../types/index.js";

export async function executeFill(
  step: FillStep,
  page: Page,
  config: TestConfig,
): Promise<void> {
  const timeout = config.timeout;

  // Try label first, then placeholder, then aria-label
  const strategies = [
    () => page.getByLabel(step.label),
    () => page.getByPlaceholder(step.label),
    () => page.locator(`[aria-label="${step.label}"]`),
  ];

  for (const getLocator of strategies) {
    try {
      const locator = getLocator();
      await locator.fill(step.value, { timeout });
      return;
    } catch {
      // Try next strategy
    }
  }

  throw new Error(
    `Could not find input matching "${step.label}" by label, placeholder, or aria-label`,
  );
}
