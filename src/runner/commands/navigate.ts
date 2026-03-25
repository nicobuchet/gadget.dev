import type { Page } from "playwright";
import type { NavigateStep, TestConfig } from "../../types/index.js";

export async function executeNavigate(
  step: NavigateStep,
  page: Page,
  config: TestConfig,
): Promise<void> {
  let url = step.url;

  // Prepend baseUrl for relative paths
  if (url.startsWith("/") && config.baseUrl) {
    url = config.baseUrl.replace(/\/$/, "") + url;
  }

  await page.goto(url, { timeout: config.timeout });
}
