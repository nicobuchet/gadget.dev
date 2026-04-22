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

// qualityScore is intentionally absent — always computed client-side from
// findings so the number stays consistent with SEVERITY_WEIGHTS.
const AuditResponseSchema = z.object({
  verdict: z.object({
    readiness: z.enum(["ready", "not-ready", "needs-attention"]),
    confidence: z.number().min(0).max(1),
    summary: z.string(),
  }),
  findings: z.array(z.object({
    severity: z.enum(["critical", "warning", "nitpick", "improvement"]),
    title: z.string(),
    description: z.string(),
    issueKey: z.string().optional(),
    relatedStep: z.number().optional(),
  })),
});

const AUDIT_TOOL_NAME = "submit_audit";

const AUDIT_TOOL: Anthropic.Tool = {
  name: AUDIT_TOOL_NAME,
  description:
    "Submit the audit verdict and findings for the flow shown in the screenshots.",
  input_schema: {
    type: "object",
    properties: {
      verdict: {
        type: "object",
        properties: {
          readiness: {
            type: "string",
            enum: ["ready", "not-ready", "needs-attention"],
            description:
              "'ready' if the flow works and looks good; 'not-ready' if broken; 'needs-attention' if it works but has visible UI/UX issues.",
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "How confident you are in this verdict, 0.0 to 1.0.",
          },
          summary: {
            type: "string",
            description:
              "Short paragraph assessing this specific flow from a user perspective.",
          },
        },
        required: ["readiness", "confidence", "summary"],
      },
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            severity: {
              type: "string",
              enum: ["critical", "warning", "nitpick", "improvement"],
            },
            title: { type: "string" },
            description: { type: "string" },
            issueKey: {
              type: "string",
              description:
                "Stable slug-like key for deduplicating the same underlying issue across audit reruns.",
            },
            relatedStep: {
              type: "number",
              description: "0-based step index this finding applies to, if any.",
            },
          },
          required: ["severity", "title", "description"],
        },
      },
    },
    required: ["verdict", "findings"],
  },
};

export interface ClaudeProviderOptions {
  model?: string;
  generateModel?: string;
  auditModel?: string;
  maxTokens?: number;
}

const DEFAULT_MODEL = "claude-sonnet-4-6-20250514";

export class ClaudeProvider implements AIProvider {
  name = "claude";
  private client: Anthropic;
  private generateModel: string;
  private auditModel: string;
  private maxTokens: number;

  constructor(apiKey: string, options: ClaudeProviderOptions = {}) {
    this.client = new Anthropic({ apiKey });
    const fallback = options.model ?? DEFAULT_MODEL;
    // Per-task overrides fall back to the shared `model`, which itself falls
    // back to the Sonnet default. Defaults are intentionally conservative —
    // opting into Haiku for generate is left to the user for now.
    this.generateModel = options.generateModel ?? fallback;
    this.auditModel = options.auditModel ?? fallback;
    this.maxTokens = options.maxTokens ?? 1024;
  }

  async generateTests(input: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens: number;
  }): Promise<string> {
    const response = await this.client.messages.create({
      model: this.generateModel,
      max_tokens: input.maxTokens,
      system: [
        {
          type: "text",
          text: input.systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
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
      model: this.auditModel,
      max_tokens: input.maxTokens,
      system: [
        {
          type: "text",
          text: auditSystemPrompt(),
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [AUDIT_TOOL],
      tool_choice: { type: "tool", name: AUDIT_TOOL_NAME },
      messages: [{ role: "user", content: contentBlocks }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Claude did not return a tool_use block for the audit");
    }

    const parsed = AuditResponseSchema.parse(toolUse.input);
    const qualityScore = Math.max(
      0,
      100 -
        parsed.findings.reduce(
          (sum, f) => sum + (SEVERITY_WEIGHTS[f.severity] ?? 0),
          0,
        ),
    );

    return {
      verdict: { ...parsed.verdict, qualityScore },
      findings: parsed.findings,
    };
  }
}
