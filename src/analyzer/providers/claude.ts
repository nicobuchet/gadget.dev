import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type {
  AIProvider,
  TestResult,
  AuditVerdict,
  AuditFinding,
} from "../../types/index.js";
import { SEVERITY_WEIGHTS } from "../../types/index.js";
import {
  auditSystemPrompt,
  auditTestUserPrompt,
} from "../prompts.js";

const AuditResponseSchema = z.object({
  verdict: z.object({
    readiness: z.enum(["ready", "not-ready", "needs-attention"]),
    confidence: z.number().min(0).max(1),
    qualityScore: z.number().int().min(0).max(100).default(0),
    summary: z.string(),
  }),
  findings: z.array(z.object({
    severity: z.enum(["critical", "warning", "nitpick", "improvement"]),
    title: z.string(),
    description: z.string(),
    relatedStep: z.number().optional(),
  })),
});

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

  async auditTest(input: {
    testResult: TestResult;
    screenshots: Array<{ stepIndex: number; data: Buffer }>;
    stepDescriptions: string[];
    maxTokens: number;
  }): Promise<{ verdict: AuditVerdict; findings: AuditFinding[] }> {
    const contentBlocks: Anthropic.MessageCreateParams["messages"][0]["content"] = [];

    for (const screenshot of input.screenshots) {
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
        text: `[Screenshot: step ${screenshot.stepIndex}]`,
      });
    }

    contentBlocks.push({
      type: "text",
      text: auditTestUserPrompt(input.testResult, input.stepDescriptions),
    });

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: input.maxTokens,
      system: auditSystemPrompt(),
      messages: [{ role: "user", content: contentBlocks }],
    });

    const raw = this.extractJson(response) as Record<string, unknown>;
    const parsed = AuditResponseSchema.parse(raw);

    // Compute qualityScore from findings if AI omitted it
    const rawVerdict = raw.verdict as Record<string, unknown> | undefined;
    const aiProvidedScore = rawVerdict?.qualityScore != null;
    const qualityScore = aiProvidedScore
      ? parsed.verdict.qualityScore
      : Math.max(0, 100 - parsed.findings.reduce(
          (sum, f) => sum + (SEVERITY_WEIGHTS[f.severity] ?? 0), 0,
        ));

    return {
      verdict: { ...parsed.verdict, qualityScore },
      findings: parsed.findings,
    };
  }

  private extractJson(response: Anthropic.Message): unknown {
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

    return JSON.parse(text);
  }
}
