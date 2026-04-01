import { z } from "zod";
import type { StepDefinition } from "../types/index.js";

// ── Step Schemas ──

const NavigateStepSchema = z
  .object({ navigate: z.string() })
  .transform((v): StepDefinition => ({ type: "navigate", url: v.navigate }));

const FillStepSchema = z
  .object({
    fill: z.object({
      label: z.string(),
      value: z.string(),
      secure: z.boolean().optional(),
    }),
  })
  .transform(
    (v): StepDefinition => ({
      type: "fill",
      label: v.fill.label,
      value: v.fill.value,
      secure: v.fill.secure,
    }),
  );

const ClickStepSchema = z
  .object({ click: z.string() })
  .transform((v): StepDefinition => ({ type: "click", target: v.click }));

const AssertStepSchema = z
  .object({
    assert: z.object({
      text: z.string().optional(),
      visible: z.boolean().optional(),
      url: z.string().optional(),
      title: z.string().optional(),
    }),
  })
  .transform(
    (v): StepDefinition => ({
      type: "assert",
      ...v.assert,
    }),
  );

const WaitStepSchema = z
  .object({
    wait: z.object({
      url: z.string().optional(),
      selector: z.string().optional(),
      timeout: z.number().optional(),
    }),
  })
  .transform(
    (v): StepDefinition => ({
      type: "wait",
      ...v.wait,
    }),
  );

export const StepSchema = z.union([
  NavigateStepSchema,
  FillStepSchema,
  ClickStepSchema,
  AssertStepSchema,
  WaitStepSchema,
]);

// ── Test Config Schema ──

export const TestConfigSchema = z.object({
  baseUrl: z.string().optional(),
  timeout: z.number().default(10000),
  screenshot: z
    .enum(["always", "on-failure", "never"])
    .default("on-failure"),
  stopOnFailure: z.boolean().default(false),
  settle: z.number().optional(),
});

// ── Test File Schema ──

export const TestFileSchema = z.object({
  name: z.string(),
  config: TestConfigSchema.default({}),
  variables: z.record(z.string(), z.string()).default({}),
  steps: z.array(StepSchema).min(1, "Test must have at least one step"),
});

// ── Suite File Schema ──

export const SuiteFileSchema = z.object({
  name: z.string(),
  config: TestConfigSchema.default({}),
  tests: z
    .array(z.object({ file: z.string() }))
    .min(1, "Suite must reference at least one test file"),
});

// ── Gadget Config Schema (.gadgetrc.yaml) ──

export const GadgetConfigSchema = z.object({
  ai: z
    .object({
      provider: z.string().default("claude"),
      model: z.string().optional(),
      apiKey: z.string().optional(),
      maxTokens: z.number().default(1024),
    })
    .default({}),
  browser: z
    .object({
      headless: z.boolean().default(true),
      viewport: z
        .object({
          width: z.number().default(1280),
          height: z.number().default(720),
        })
        .default({}),
      slowMo: z.number().default(0),
    })
    .default({}),
  output: z
    .object({
      dir: z.string().default(".gadget/results"),
      reporters: z.array(z.string()).default(["console"]),
    })
    .default({}),
  audit: z
    .object({
      maxTokens: z.number().default(4096),
      minScore: z.number().min(0).max(100).optional(),
    })
    .optional(),
  check: z
    .object({
      baseBranch: z.string().default("main"),
      outputDir: z.string().default(".gadget/generated"),
      maxTokens: z.number().default(8192),
      run: z.boolean().default(true),
    })
    .optional(),
});
