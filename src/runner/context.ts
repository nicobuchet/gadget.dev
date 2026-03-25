import { chromium, type Browser, type Page, type BrowserContext } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { GadgetConfig } from "../types/index.js";

export class TestBrowserContext {
  private browser: Browser | null = null;
  private contexts: BrowserContext[] = [];

  async launch(config: GadgetConfig): Promise<void> {
    this.browser = await chromium.launch({
      headless: config.browser.headless,
      slowMo: config.browser.slowMo,
    });
  }

  async newPage(config: GadgetConfig): Promise<Page> {
    if (!this.browser) throw new Error("Browser not launched");

    const context = await this.browser.newContext({
      viewport: config.browser.viewport,
    });
    this.contexts.push(context);
    return context.newPage();
  }

  async screenshot(page: Page, outputPath: string): Promise<Buffer> {
    mkdirSync(dirname(outputPath), { recursive: true });
    const buffer = await page.screenshot({ path: outputPath, fullPage: true });
    return Buffer.from(buffer);
  }

  /**
   * Extracts a trimmed HTML summary of visible interactive elements.
   * Keeps token count low (~2000 tokens) for AI analysis.
   */
  async getHtmlSummary(page: Page): Promise<string> {
    return page.evaluate(() => {
      const elements: string[] = [];
      const interactiveTags = [
        "a",
        "button",
        "input",
        "select",
        "textarea",
        "label",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "p",
        "img",
        "nav",
        "main",
        "form",
      ];

      const seen = new Set<Element>();

      for (const tag of interactiveTags) {
        for (const el of document.querySelectorAll(tag)) {
          if (seen.has(el)) continue;
          seen.add(el);

          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;

          const role = el.getAttribute("role") || "";
          const ariaLabel = el.getAttribute("aria-label") || "";
          const text = (el.textContent || "").trim().slice(0, 100);
          const type = (el as HTMLInputElement).type || "";
          const placeholder = (el as HTMLInputElement).placeholder || "";
          const href = (el as HTMLAnchorElement).href || "";

          const attrs: string[] = [];
          if (role) attrs.push(`role="${role}"`);
          if (ariaLabel) attrs.push(`aria-label="${ariaLabel}"`);
          if (type) attrs.push(`type="${type}"`);
          if (placeholder) attrs.push(`placeholder="${placeholder}"`);
          if (href) attrs.push(`href="${href}"`);

          const attrStr = attrs.length > 0 ? " " + attrs.join(" ") : "";
          elements.push(`<${tag}${attrStr}>${text}</${tag}>`);

          if (elements.length >= 150) break;
        }
        if (elements.length >= 150) break;
      }

      return elements.join("\n");
    });
  }

  async close(): Promise<void> {
    for (const ctx of this.contexts) {
      await ctx.close().catch(() => {});
    }
    this.contexts = [];
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}
