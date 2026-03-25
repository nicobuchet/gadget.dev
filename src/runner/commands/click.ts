import type { Page } from "playwright";
import type { ClickStep, TestConfig } from "../../types/index.js";

export async function executeClick(
  step: ClickStep,
  page: Page,
  config: TestConfig,
): Promise<void> {
  const timeout = config.timeout;

  // Try role button, then text, then label
  const strategies = [
    () => page.getByRole("button", { name: step.target }),
    () => page.getByRole("link", { name: step.target }),
    () => page.getByText(step.target, { exact: false }),
    () => page.getByLabel(step.target),
  ];

  for (const getLocator of strategies) {
    try {
      const locator = getLocator();
      await locator.first().click({ timeout });
      return;
    } catch {
      // Try next strategy
    }
  }

  throw new Error(
    `Could not find clickable element matching "${step.target}"`,
  );
}
