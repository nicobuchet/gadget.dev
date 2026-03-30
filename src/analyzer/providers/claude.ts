import Anthropic from "@anthropic-ai/sdk";
import type {
  AIProvider,
  FailureAnalysis,
  VerifyResult,
  PlaywrightAction,
  StepDefinition,
  SuiteResult,
  AuditVerdict,
  AuditFinding,
} from "../../types/index.js";
import {
  failureAnalysisSystemPrompt,
  failureAnalysisUserPrompt,
  visualVerifySystemPrompt,
  visualVerifyUserPrompt,
  interpretActionSystemPrompt,
  interpretActionUserPrompt,
  auditSystemPrompt,
  auditUserPrompt,
} from "../prompts.js";

export class ClaudeProvider implements AIProvider {
  name = "claude";
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(apiKey: string, model?: string, maxTokens?: number) {
    this.client = new Anthropic({ apiKey });
    this.model = model ?? "claude-sonnet-4-6-20250514";
    this.maxTokens = maxTokens ?? 1024;
  }

  async analyzeFailure(input: {
    screenshot: Buffer;
    step: StepDefinition;
    error: string;
    htmlSummary: string;
  }): Promise<FailureAnalysis> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: failureAnalysisSystemPrompt(),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: input.screenshot.toString("base64"),
              },
            },
            {
              type: "text",
              text: failureAnalysisUserPrompt(
                input.step,
                input.error,
                input.htmlSummary,
              ),
            },
          ],
        },
      ],
    });

    return this.parseJson<FailureAnalysis>(response);
  }

  async verifyVisual(input: {
    screenshot: Buffer;
    assertion: string;
    htmlSummary: string;
  }): Promise<VerifyResult> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: visualVerifySystemPrompt(),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: input.screenshot.toString("base64"),
              },
            },
            {
              type: "text",
              text: visualVerifyUserPrompt(input.assertion, input.htmlSummary),
            },
          ],
        },
      ],
    });

    return this.parseJson<VerifyResult>(response);
  }

  async interpretAction(input: {
    screenshot: Buffer;
    instruction: string;
    htmlSummary: string;
  }): Promise<PlaywrightAction[]> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: interpretActionSystemPrompt(),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: input.screenshot.toString("base64"),
              },
            },
            {
              type: "text",
              text: interpretActionUserPrompt(
                input.instruction,
                input.htmlSummary,
              ),
            },
          ],
        },
      ],
    });

    return this.parseJson<PlaywrightAction[]>(response);
  }

  async generateTests(input: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens: number;
  }): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: input.maxTokens,
      system: input.systemPrompt,
      messages: [{ role: "user", content: input.userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }
    return textBlock.text;
  }

  async auditSuite(input: {
    suiteResult: SuiteResult;
    screenshots: Array<{ testName: string; stepIndex: number; data: Buffer }>;
    testDescriptions: Array<{ name: string; steps: string[] }>;
    maxTokens: number;
  }): Promise<{ verdict: AuditVerdict; findings: AuditFinding[] }> {
    const contentBlocks: Anthropic.MessageCreateParams["messages"][0]["content"] = [];

    // Add up to 10 screenshots as image blocks
    const screenshotSlice = input.screenshots.slice(0, 10);
    for (const screenshot of screenshotSlice) {
      contentBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: screenshot.data.toString("base64"),
        },
      });
      contentBlocks.push({
        type: "text",
        text: `[Screenshot: ${screenshot.testName} — step ${screenshot.stepIndex}]`,
      });
    }

    // Add the text prompt
    contentBlocks.push({
      type: "text",
      text: auditUserPrompt(input.suiteResult, input.testDescriptions),
    });

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: input.maxTokens,
      system: auditSystemPrompt(),
      messages: [{ role: "user", content: contentBlocks }],
    });

    return this.parseJson<{ verdict: AuditVerdict; findings: AuditFinding[] }>(response);
  }

  private parseJson<T>(response: Anthropic.Message): T {
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Extract JSON from potential markdown code blocks
    let text = textBlock.text.trim();
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      text = jsonMatch[1].trim();
    }

    return JSON.parse(text) as T;
  }
}
