import type { Page } from "playwright";
import type { WaitStep, TestConfig } from "../../types/index.js";

export async function executeWait(
  step: WaitStep,
  page: Page,
  config: TestConfig,
): Promise<void> {
  const timeout = step.timeout ?? config.timeout ?? 10000;

  if (step.url) {
    await page.waitForURL(new RegExp(step.url), { timeout });
  }

  if (step.selector) {
    await page.waitForSelector(step.selector, { timeout });
  }

  // If neither url nor selector, just wait for the timeout duration
  if (!step.url && !step.selector) {
    await page.waitForTimeout(timeout);
  }
}
