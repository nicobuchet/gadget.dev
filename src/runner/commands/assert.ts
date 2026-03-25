import { expect } from "playwright/test";
import type { Page } from "playwright";
import type { AssertStep, TestConfig } from "../../types/index.js";

export async function executeAssert(
  step: AssertStep,
  page: Page,
  config: TestConfig,
): Promise<void> {
  const timeout = config.timeout;

  if (step.text !== undefined) {
    const locator = page.getByText(step.text);
    if (step.visible === true) {
      await expect(locator).toBeVisible({ timeout });
    } else if (step.visible === false) {
      await expect(locator).not.toBeVisible({ timeout });
    } else {
      // Just check text exists in page
      await expect(locator).toBeAttached({ timeout });
    }
  }

  if (step.url !== undefined) {
    await expect(page).toHaveURL(new RegExp(step.url), { timeout });
  }

  if (step.title !== undefined) {
    await expect(page).toHaveTitle(new RegExp(step.title), { timeout });
  }
}
