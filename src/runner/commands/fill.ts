import type { Page, Locator } from "playwright";
import type { FillStep, TestConfig } from "../../types/index.js";

export async function executeFill(
  step: FillStep,
  page: Page,
  config: TestConfig,
): Promise<void> {
  const timeout = config.timeout ?? 10000;

  const locators: Locator[] = [
    page.getByLabel(step.label),
    page.getByPlaceholder(step.label),
    page.locator(`[aria-label="${step.label}"]`),
  ];

  // Race all strategies — first one to find a visible element wins
  const result = await Promise.any(
    locators.map(async (locator) => {
      await locator.first().waitFor({ state: "visible", timeout });
      return locator;
    }),
  ).catch(() => null);

  if (!result) {
    throw new Error(
      `Could not find input matching "${step.label}" by label, placeholder, or aria-label`,
    );
  }

  await result.first().fill(step.value, { timeout });
}
