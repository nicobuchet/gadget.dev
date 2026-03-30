// ── Step Definitions (discriminated union) ──

export interface NavigateStep {
  type: "navigate";
  url: string;
}

export interface FillStep {
  type: "fill";
  label: string;
  value: string;
}

export interface ClickStep {
  type: "click";
  target: string;
}

export interface AssertStep {
  type: "assert";
  text?: string;
  visible?: boolean;
  url?: string;
  title?: string;
}

export interface WaitStep {
  type: "wait";
  url?: string;
  selector?: string;
  timeout?: number;
}

export interface DoStep {
  type: "do";
  instruction: string;
}

export interface VerifyStep {
  type: "verify";
  assertion: string;
}

export type StepDefinition =
  | NavigateStep
  | FillStep
  | ClickStep
  | AssertStep
  | WaitStep
  | DoStep
  | VerifyStep;

// ── Test Structure ──

export interface TestConfig {
  baseUrl?: string;
  timeout?: number;
  screenshot?: "always" | "on-failure" | "never";
  stopOnFailure?: boolean;
}

export interface TestCase {
  name: string;
  config: TestConfig;
  variables: Record<string, string>;
  steps: StepDefinition[];
  filePath?: string;
}

export interface TestSuite {
  name: string;
  config: TestConfig;
  tests: TestCase[];
}

// ── Results ──

export type StepStatus = "pass" | "fail" | "skip";

export interface StepResult {
  step: StepDefinition;
  status: StepStatus;
  duration: number;
  error?: string;
  screenshotPath?: string;
  analysis?: FailureAnalysis;
}

export interface TestResult {
  name: string;
  filePath?: string;
  steps: StepResult[];
  status: "pass" | "fail";
  duration: number;
}

export interface SuiteResult {
  name: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

// ── AI Provider ──

export interface AIProvider {
  name: string;

  analyzeFailure(input: {
    screenshot: Buffer;
    step: StepDefinition;
    error: string;
    htmlSummary: string;
  }): Promise<FailureAnalysis>;

  verifyVisual(input: {
    screenshot: Buffer;
    assertion: string;
    htmlSummary: string;
  }): Promise<VerifyResult>;

  interpretAction(input: {
    screenshot: Buffer;
    instruction: string;
    htmlSummary: string;
  }): Promise<PlaywrightAction[]>;

  generateTests?(input: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens: number;
  }): Promise<string>;
}

export interface FailureAnalysis {
  summary: string;
  category: "test-bug" | "app-bug" | "environment" | "flaky";
  details: string;
  suggestedFix?: string;
}

export interface VerifyResult {
  pass: boolean;
  reason: string;
  confidence: number;
}

export interface PlaywrightAction {
  command: "click" | "fill" | "select" | "scroll" | "wait";
  params: Record<string, string>;
}

// ── Configuration ──

export interface GadgetConfig {
  ai: {
    provider: string;
    model?: string;
    apiKey?: string;
    maxTokens?: number;
  };
  browser: {
    headless: boolean;
    viewport: { width: number; height: number };
    slowMo: number;
  };
  output: {
    dir: string;
    reporters: string[];
  };
  check?: {
    baseBranch?: string;
    outputDir?: string;
    maxTokens?: number;
    run?: boolean;
  };
}

export const DEFAULT_CONFIG: GadgetConfig = {
  ai: {
    provider: "claude",
    model: "claude-sonnet-4-6",
    maxTokens: 1024,
  },
  browser: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    slowMo: 0,
  },
  output: {
    dir: ".gadget/results",
    reporters: ["console"],
  },
};

// ── Reporter ──

export interface ReporterInterface {
  onTestStart(name: string): void;
  onStepResult(step: StepDefinition, result: StepResult): void;
  onTestEnd(result: TestResult): void;
  onSuiteEnd(result: SuiteResult): void;
}
