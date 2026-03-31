// ── Step Definitions (discriminated union) ──

export interface NavigateStep {
  type: "navigate";
  url: string;
}

export interface FillStep {
  type: "fill";
  label: string;
  value: string;
  secure?: boolean;
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

export type StepDefinition =
  | NavigateStep
  | FillStep
  | ClickStep
  | AssertStep
  | WaitStep;

// ── Test Structure ──

export interface TestConfig {
  baseUrl?: string;
  timeout?: number;
  screenshot?: "always" | "on-failure" | "never";
  stopOnFailure?: boolean;
  settle?: number;
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


  generateTests?(input: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens: number;
  }): Promise<string>;

  auditSuite?(input: {
    suiteResult: SuiteResult;
    screenshots: Array<{ testName: string; stepIndex: number; data: Buffer }>;
    testDescriptions: Array<{ name: string; steps: string[] }>;
    maxTokens: number;
  }): Promise<{ verdict: AuditVerdict; findings: AuditFinding[] }>;
}


// ── Audit Feedback ──

export type FeedbackSeverity = "critical" | "warning" | "nitpick" | "improvement";

export interface AuditFinding {
  severity: FeedbackSeverity;
  title: string;
  description: string;
  relatedTest?: string;
  relatedStep?: number;
  screenshotPath?: string;
}

export type ProductionReadiness = "ready" | "not-ready" | "needs-attention";

export interface AuditVerdict {
  readiness: ProductionReadiness;
  confidence: number;
  summary: string;
}

export interface AuditReport {
  verdict: AuditVerdict;
  findings: AuditFinding[];
  suiteResult: SuiteResult;
  timestamp: string;
  duration: number;
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
  audit?: {
    maxTokens?: number;
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
  onAuditEnd?(report: AuditReport): void;
}
