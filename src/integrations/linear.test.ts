import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildLinearIssueBody,
  buildLinearMarker,
  computeFindingIssueKey,
  groupFindingsForLinear,
  resolveLinearConfig,
  syncAuditReportToLinear,
} from "./linear.js";
import type { AuditReport, GadgetConfig } from "../types/index.js";

function makeConfig(): GadgetConfig {
  return {
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
    audit: {
      linear: {
        enabled: true,
        apiKey: "linear_test_key",
        teamId: "team-123",
        titlePrefix: "[Gadget Audit]",
      },
    },
  };
}

function makeReport(): AuditReport {
  const screenshotPath = createScreenshotFile();

  return {
    verdict: {
      readiness: "needs-attention",
      confidence: 0.91,
      qualityScore: 72,
      summary: "The app works but has visible UI issues.",
    },
    findings: [
      {
        severity: "warning",
        title: "Submit button is clipped",
        description: "The primary submit button is cut off at the bottom of the form.",
        issueKey: "signup-submit-button-clipped",
        relatedTest: "Signup Flow",
        relatedStep: 2,
        screenshotPath,
      },
    ],
    suiteResult: {
      name: "Gadget Audit",
      tests: [
        {
          name: "Signup Flow",
          status: "pass",
          duration: 1000,
          filePath: "/tmp/signup.yml",
          steps: [
            {
              step: { type: "navigate", url: "/signup" },
              status: "pass",
              duration: 10,
            },
            {
              step: { type: "fill", label: "Email", value: "person@example.com" },
              status: "pass",
              duration: 10,
            },
            {
              step: { type: "click", target: "Submit" },
              status: "pass",
              duration: 10,
              screenshotPath,
            },
          ],
        },
      ],
      passed: 1,
      failed: 0,
      skipped: 0,
      duration: 1000,
    },
    timestamp: "2026-04-22T12:00:00.000Z",
    duration: 1000,
  };
}

describe("linear integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LINEAR_API_KEY;
    cleanupScreenshotFiles();
  });

  it("resolves enabled config and env fallbacks", () => {
    process.env.LINEAR_API_KEY = "env_linear_key";

    const config = makeConfig();
    config.audit!.linear = {
      enabled: true,
      teamId: "team-123",
    };

    expect(resolveLinearConfig(config)).toEqual({
      apiKey: "env_linear_key",
      teamId: "team-123",
      projectId: undefined,
      createForSeverities: ["critical", "warning", "nitpick", "improvement"],
      titlePrefix: "[Gadget Audit]",
    });
  });

  it("computes stable issue keys and groups duplicate findings", () => {
    const firstKey = computeFindingIssueKey({
      severity: "warning",
      title: "Submit button is clipped",
      description: "The primary submit button is cut off.",
    });
    const secondKey = computeFindingIssueKey({
      severity: "warning",
      title: "Submit button is clipped",
      description: "The primary submit button is cut off.",
    });

    expect(firstKey).toBe(secondKey);

    const groups = groupFindingsForLinear(
      [
        {
          severity: "warning",
          title: "Submit button is clipped",
          description: "The primary submit button is cut off.",
          issueKey: "signup-submit-button-clipped",
        },
        {
          severity: "nitpick",
          title: "Submit button is clipped",
          description: "The same problem appears on another flow.",
          issueKey: "signup-submit-button-clipped",
        },
        {
          severity: "improvement",
          title: "Placeholder text could be shorter",
          description: "The copy is wordy but usable.",
          issueKey: "copy-too-wordy",
        },
      ],
      ["warning", "nitpick"],
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].issueKey).toBe("signup-submit-button-clipped");
    expect(groups[0].severity).toBe("warning");
    expect(groups[0].findings).toHaveLength(2);
  });

  it("builds issue bodies with gadget marker and screenshots", () => {
    const report = makeReport();

    const body = buildLinearIssueBody(
      report,
      {
        issueKey: "signup-submit-button-clipped",
        title: "Submit button is clipped",
        severity: "warning",
        findings: report.findings,
      },
      [
        {
          finding: report.findings[0],
          stepLabel: 'Step 2: Click "Submit"',
          screenshotMarkdown: "![Audit screenshot](https://assets.linear.app/example.png)",
        },
      ],
      buildLinearMarker("signup-submit-button-clipped"),
    );

    expect(body).toContain("_Created automatically by Gadget audit._");
    expect(body).toContain("Flow: Signup Flow");
    expect(body).toContain('Step 2: Click "Submit"');
    expect(body).toContain("![Audit screenshot](https://assets.linear.app/example.png)");
    expect(body).toContain("<!-- gadget-audit:key:signup-submit-button-clipped -->");
  });

  it("creates a new Linear issue when no open gadget issue exists", async () => {
    const report = makeReport();

    const requests: Array<{ query?: string; variables?: Record<string, unknown>; url: string; method: string }> = [];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? "GET";

      if (url === "https://upload.linear.test/file") {
        requests.push({ url, method, query: undefined, variables: undefined });
        return new Response(null, { status: 200 });
      }

      const body = init?.body ? JSON.parse(String(init.body)) as { query: string; variables: Record<string, unknown> } : undefined;
      requests.push({ url, method, query: body?.query, variables: body?.variables });

      if (body?.query?.includes("FindOpenIssue")) {
        return json({
          data: {
            team: {
              issues: {
                nodes: [],
              },
            },
          },
        });
      }

      if (body?.query?.includes("FileUpload")) {
        return json({
          data: {
            fileUpload: {
              success: true,
              uploadFile: {
                uploadUrl: "https://upload.linear.test/file",
                assetUrl: "https://assets.linear.test/file.png",
                headers: [],
              },
            },
          },
        });
      }

      if (body?.query?.includes("CreateIssue")) {
        return json({
          data: {
            issueCreate: {
              success: true,
              issue: {
                id: "issue-1",
                identifier: "GAD-1",
                title: "[Gadget Audit] Submit button is clipped",
              },
            },
          },
        });
      }

      throw new Error(`Unexpected GraphQL operation: ${body?.query}`);
    });

    const result = await syncAuditReportToLinear(
      report,
      makeConfig(),
      {},
      { fetch: fetchMock },
    );

    expect(result).toEqual({
      created: [
        {
          id: "issue-1",
          identifier: "GAD-1",
          title: "[Gadget Audit] Submit button is clipped",
          issueKey: "signup-submit-button-clipped",
          findingCount: 1,
        },
      ],
      updated: [],
      skipped: [],
      failed: [],
    });

    const createIssueRequest = requests.find(request => request.query?.includes("CreateIssue"));
    const findIssueRequest = requests.find(request => request.query?.includes("FindOpenIssue"));
    expect(findIssueRequest?.query).not.toContain("$projectId");
    expect(findIssueRequest?.variables).not.toHaveProperty("projectId");
    expect(createIssueRequest?.variables?.input).toMatchObject({
      teamId: "team-123",
      title: "[Gadget Audit] Submit button is clipped",
    });
    expect(String((createIssueRequest?.variables?.input as { description: string }).description))
      .toContain("![Audit screenshot](https://assets.linear.test/file.png)");
    expect(String((createIssueRequest?.variables?.input as { description: string }).description))
      .toContain("<!-- gadget-audit:key:signup-submit-button-clipped -->");
  });

  it("adds a comment instead of creating a duplicate issue when one is already open", async () => {
    const report = makeReport();

    const requests: Array<{ query?: string; variables?: Record<string, unknown>; url: string }> = [];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "https://upload.linear.test/file") {
        requests.push({ url });
        return new Response(null, { status: 200 });
      }

      const body = init?.body ? JSON.parse(String(init.body)) as { query: string; variables: Record<string, unknown> } : undefined;
      requests.push({ url, query: body?.query, variables: body?.variables });

      if (body?.query?.includes("FindOpenIssue")) {
        return json({
          data: {
            team: {
              issues: {
                nodes: [
                  {
                    id: "issue-1",
                    identifier: "GAD-1",
                    title: "[Gadget Audit] Submit button is clipped",
                  },
                ],
              },
            },
          },
        });
      }

      if (body?.query?.includes("FileUpload")) {
        return json({
          data: {
            fileUpload: {
              success: true,
              uploadFile: {
                uploadUrl: "https://upload.linear.test/file",
                assetUrl: "https://assets.linear.test/file.png",
                headers: [],
              },
            },
          },
        });
      }

      if (body?.query?.includes("CreateComment")) {
        return json({
          data: {
            commentCreate: {
              success: true,
            },
          },
        });
      }

      throw new Error(`Unexpected GraphQL operation: ${body?.query}`);
    });

    const result = await syncAuditReportToLinear(
      report,
      makeConfig(),
      {},
      { fetch: fetchMock },
    );

    expect(result?.created).toHaveLength(0);
    expect(result?.updated).toEqual([
      {
        id: "issue-1",
        identifier: "GAD-1",
        title: "[Gadget Audit] Submit button is clipped",
        issueKey: "signup-submit-button-clipped",
        findingCount: 1,
      },
    ]);

    expect(requests.some(request => request.query?.includes("CreateIssue"))).toBe(false);
    const createCommentRequest = requests.find(request => request.query?.includes("CreateComment"));
    expect(String((createCommentRequest?.variables?.input as { body: string }).body))
      .toContain("_Gadget audit saw this issue again._");
  });

  it("filters existing Linear issues by project when one is configured", async () => {
    const report = makeReport();
    const config = makeConfig();
    config.audit!.linear!.projectId = "project-123";

    const requests: Array<{ query?: string; variables?: Record<string, unknown>; url: string }> = [];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "https://upload.linear.test/file") {
        requests.push({ url });
        return new Response(null, { status: 200 });
      }

      const body = init?.body ? JSON.parse(String(init.body)) as { query: string; variables: Record<string, unknown> } : undefined;
      requests.push({ url, query: body?.query, variables: body?.variables });

      if (body?.query?.includes("FindOpenIssue")) {
        return json({
          data: {
            team: {
              issues: {
                nodes: [],
              },
            },
          },
        });
      }

      if (body?.query?.includes("FileUpload")) {
        return json({
          data: {
            fileUpload: {
              success: true,
              uploadFile: {
                uploadUrl: "https://upload.linear.test/file",
                assetUrl: "https://assets.linear.test/file.png",
                headers: [],
              },
            },
          },
        });
      }

      if (body?.query?.includes("CreateIssue")) {
        return json({
          data: {
            issueCreate: {
              success: true,
              issue: {
                id: "issue-1",
                identifier: "GAD-1",
                title: "[Gadget Audit] Submit button is clipped",
              },
            },
          },
        });
      }

      throw new Error(`Unexpected GraphQL operation: ${body?.query}`);
    });

    await syncAuditReportToLinear(report, config, {}, { fetch: fetchMock });

    const findIssueRequest = requests.find(request => request.query?.includes("FindOpenIssue"));
    expect(findIssueRequest?.query).toContain("$projectId: String!");
    expect(findIssueRequest?.query).toContain("project: { id: { eq: $projectId } }");
    expect(findIssueRequest?.variables?.projectId).toBe("project-123");
  });

  it("includes Linear GraphQL error details for failed HTTP responses", async () => {
    const report = makeReport();
    const fetchMock = vi.fn(async () => json(
      {
        errors: [
          {
            message: "Variable \"$projectId\" is never used in operation \"FindOpenIssue\".",
          },
        ],
      },
      400,
    ));

    const result = await syncAuditReportToLinear(
      report,
      makeConfig(),
      {},
      { fetch: fetchMock },
    );

    expect(result?.failed).toHaveLength(1);
    expect(result?.failed[0].reason).toBe(
      "Linear GraphQL request failed with HTTP 400: Variable \"$projectId\" is never used in operation \"FindOpenIssue\".",
    );
  });
});

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

const screenshotDirs: string[] = [];

function createScreenshotFile(): string {
  const dir = mkdtempSync(join(tmpdir(), "gadget-linear-test-"));
  const file = join(dir, "signup-step-2.png");
  writeFileSync(file, Buffer.from("png"));
  screenshotDirs.push(dir);
  return file;
}

function cleanupScreenshotFiles(): void {
  while (screenshotDirs.length > 0) {
    const dir = screenshotDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}
