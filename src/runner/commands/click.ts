import type { Page, Locator } from "playwright";
import type { ClickStep, TestConfig } from "../../types/index.js";

export async function executeClick(
  step: ClickStep,
  page: Page,
  config: TestConfig,
): Promise<void> {
  const timeout = config.timeout ?? 10000;

  const locators: Locator[] = [
    page.getByRole("button", { name: step.target }),
    page.getByRole("link", { name: step.target }),
    page.getByText(step.target, { exact: false }),
    page.getByLabel(step.target),
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
      `Could not find clickable element matching "${step.target}"`,
    );
  }

  await result.first().click({ timeout });
}
