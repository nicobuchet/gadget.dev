import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type {
  AuditFinding,
  AuditReport,
  FeedbackSeverity,
  GadgetConfig,
  LinearIssueReference,
  LinearSyncResult,
} from "../types/index.js";
import { describeStep } from "../runner/runner.js";

const LINEAR_API_URL = "https://api.linear.app/graphql";
const DEFAULT_SEVERITIES: FeedbackSeverity[] = [
  "critical",
  "warning",
  "nitpick",
  "improvement",
];
const DEFAULT_TITLE_PREFIX = "[Gadget Audit]";

export interface LinearSyncOverrides {
  enabled?: boolean;
  teamId?: string;
  projectId?: string;
}

export interface ResolvedLinearConfig {
  apiKey: string;
  teamId: string;
  projectId?: string;
  createForSeverities: FeedbackSeverity[];
  titlePrefix: string;
}

export interface LinearTransport {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
}

interface LinearFileUploadPayload {
  uploadUrl: string;
  assetUrl: string;
  headers: Array<{ key: string; value: string }>;
}

interface LinearIssueNode {
  id: string;
  identifier?: string;
  title: string;
}

interface LinearOccurrence {
  finding: AuditFinding;
  stepLabel?: string;
  screenshotMarkdown?: string;
  screenshotError?: string;
}

interface LinearIssueGroup {
  issueKey: string;
  title: string;
  severity: FeedbackSeverity;
  findings: AuditFinding[];
}

export function resolveLinearConfig(
  config: GadgetConfig,
  overrides: LinearSyncOverrides = {},
): ResolvedLinearConfig | null {
  const linear = config.audit?.linear;
  const enabled = overrides.enabled === true || linear?.enabled === true;
  if (!enabled) return null;

  const apiKey = linear?.apiKey ?? process.env.LINEAR_API_KEY;
  const teamId = overrides.teamId ?? linear?.teamId;
  const projectId = overrides.projectId ?? linear?.projectId;
  const createForSeverities = linear?.createForSeverities ?? DEFAULT_SEVERITIES;
  const titlePrefix = linear?.titlePrefix?.trim() || DEFAULT_TITLE_PREFIX;

  if (!apiKey) {
    throw new Error(
      "Linear sync is enabled but no API key was found. Set audit.linear.apiKey or LINEAR_API_KEY.",
    );
  }

  if (!teamId) {
    throw new Error(
      "Linear sync is enabled but no teamId was configured. Set audit.linear.teamId or pass --linear-team.",
    );
  }

  return {
    apiKey,
    teamId,
    projectId,
    createForSeverities,
    titlePrefix,
  };
}

export function normalizeIssueKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function computeFindingIssueKey(finding: AuditFinding): string {
  const explicit = finding.issueKey ? normalizeIssueKey(finding.issueKey) : "";
  if (explicit) return explicit;

  const titleSlug = normalizeIssueKey(finding.title) || "audit-finding";
  const normalizedDescription = finding.description
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const digest = createHash("sha256")
    .update(`${titleSlug}\n${normalizedDescription}`)
    .digest("hex")
    .slice(0, 12);

  return `${titleSlug.slice(0, 48)}-${digest}`;
}

export function buildLinearMarker(issueKey: string): string {
  return `<!-- gadget-audit:key:${issueKey} -->`;
}

export function groupFindingsForLinear(
  findings: AuditFinding[],
  severities: FeedbackSeverity[],
): LinearIssueGroup[] {
  const allowed = new Set(severities);
  const groups = new Map<string, LinearIssueGroup>();

  for (const finding of findings) {
    if (!allowed.has(finding.severity)) continue;

    const issueKey = computeFindingIssueKey(finding);
    const existing = groups.get(issueKey);
    if (existing) {
      existing.findings.push({ ...finding, issueKey });
      existing.severity = higherSeverity(existing.severity, finding.severity);
      continue;
    }

    groups.set(issueKey, {
      issueKey,
      title: finding.title,
      severity: finding.severity,
      findings: [{ ...finding, issueKey }],
    });
  }

  return [...groups.values()];
}

function higherSeverity(
  left: FeedbackSeverity,
  right: FeedbackSeverity,
): FeedbackSeverity {
  const rank: Record<FeedbackSeverity, number> = {
    critical: 4,
    warning: 3,
    nitpick: 2,
    improvement: 1,
  };

  return rank[right] > rank[left] ? right : left;
}

export function buildLinearIssueTitle(prefix: string, title: string): string {
  return `${prefix} ${title}`.trim();
}

export function buildLinearIssueBody(
  report: AuditReport,
  group: LinearIssueGroup,
  occurrences: LinearOccurrence[],
  marker: string,
): string {
  const lines = [
    "_Created automatically by Gadget audit._",
    "",
    `**Severity:** ${group.severity}`,
    `**Occurrences in this audit:** ${occurrences.length}`,
    `**Audit quality score:** ${report.verdict.qualityScore}/100`,
    `**Audit timestamp:** ${report.timestamp}`,
    "",
    "## Summary",
    group.findings[0].description,
    "",
    "## Audit Context",
  ];

  for (const occurrence of occurrences) {
    const context = [
      occurrence.finding.relatedTest ? `Flow: ${occurrence.finding.relatedTest}` : undefined,
      occurrence.stepLabel,
    ].filter(Boolean).join(" | ");
    lines.push(`- ${context || "Flow context unavailable"}: ${occurrence.finding.title}`);
  }

  lines.push("", "## Detailed Findings");

  occurrences.forEach((occurrence, index) => {
    lines.push(
      `### ${index + 1}. ${occurrence.finding.title}`,
      occurrence.finding.relatedTest
        ? `- Flow: ${occurrence.finding.relatedTest}`
        : "- Flow: unavailable",
      occurrence.stepLabel ? `- ${occurrence.stepLabel}` : "- Step: unavailable",
      `- Severity: ${occurrence.finding.severity}`,
      "",
      occurrence.finding.description,
      "",
    );

    if (occurrence.screenshotMarkdown) {
      lines.push(occurrence.screenshotMarkdown, "");
    } else if (occurrence.finding.screenshotPath) {
      lines.push(
        occurrence.screenshotError
          ? `Screenshot upload failed: ${occurrence.screenshotError}`
          : "Screenshot unavailable for this occurrence.",
        "",
      );
    }
  });

  lines.push(marker);

  return lines.join("\n");
}

export function buildLinearCommentBody(
  report: AuditReport,
  group: LinearIssueGroup,
  occurrences: LinearOccurrence[],
): string {
  const lines = [
    "_Gadget audit saw this issue again._",
    "",
    `**Latest audit timestamp:** ${report.timestamp}`,
    `**Occurrences in this audit:** ${occurrences.length}`,
    `**Audit quality score:** ${report.verdict.qualityScore}/100`,
    "",
  ];

  occurrences.forEach((occurrence, index) => {
    const heading = occurrence.finding.relatedTest
      ? `${occurrence.finding.relatedTest} (${occurrence.finding.severity})`
      : `${group.title} (${occurrence.finding.severity})`;
    lines.push(`## ${index + 1}. ${heading}`);
    if (occurrence.stepLabel) {
      lines.push(occurrence.stepLabel);
    }
    lines.push("", occurrence.finding.description, "");

    if (occurrence.screenshotMarkdown) {
      lines.push(occurrence.screenshotMarkdown, "");
    } else if (occurrence.finding.screenshotPath && occurrence.screenshotError) {
      lines.push(`Screenshot upload failed: ${occurrence.screenshotError}`, "");
    }
  });

  return lines.join("\n");
}

export async function syncAuditReportToLinear(
  report: AuditReport,
  config: GadgetConfig,
  overrides: LinearSyncOverrides = {},
  transport: LinearTransport = { fetch },
): Promise<LinearSyncResult | null> {
  const resolved = resolveLinearConfig(config, overrides);
  if (!resolved) return null;

  const groups = groupFindingsForLinear(report.findings, resolved.createForSeverities);
  if (groups.length === 0) {
    return { created: [], updated: [], skipped: [], failed: [] };
  }

  const client = new LinearClient(resolved.apiKey, transport);
  const result: LinearSyncResult = {
    created: [],
    updated: [],
    skipped: [],
    failed: [],
  };

  for (const group of groups) {
    const marker = buildLinearMarker(group.issueKey);

    try {
      const existing = await client.findOpenIssueByMarker(
        resolved.teamId,
        marker,
        resolved.projectId,
      );
      const occurrences = await buildOccurrences(report, group, client);

      if (existing) {
        const commentBody = buildLinearCommentBody(report, group, occurrences);
        await client.createComment(existing.id, commentBody);
        result.updated.push(toReference(existing, group));
        continue;
      }

      const description = buildLinearIssueBody(report, group, occurrences, marker);
      const created = await client.createIssue({
        teamId: resolved.teamId,
        projectId: resolved.projectId,
        title: buildLinearIssueTitle(resolved.titlePrefix, group.title),
        description,
      });
      result.created.push(toReference(created, group));
    } catch (error) {
      result.failed.push({
        issueKey: group.issueKey,
        title: group.title,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

async function buildOccurrences(
  report: AuditReport,
  group: LinearIssueGroup,
  client: LinearClient,
): Promise<LinearOccurrence[]> {
  const occurrences: LinearOccurrence[] = [];

  for (const finding of group.findings) {
    const occurrence: LinearOccurrence = {
      finding,
      stepLabel: finding.relatedStep != null
        ? `Step ${finding.relatedStep}: ${resolveStepDescription(report, finding)}`
        : undefined,
    };

    if (finding.screenshotPath) {
      try {
        const assetUrl = await client.uploadFile(
          basename(finding.screenshotPath),
          "image/png",
          readFileSync(finding.screenshotPath),
        );
        occurrence.screenshotMarkdown = `![Audit screenshot](${assetUrl})`;
      } catch (error) {
        occurrence.screenshotError = error instanceof Error ? error.message : String(error);
      }
    }

    occurrences.push(occurrence);
  }

  return occurrences;
}

function resolveStepDescription(report: AuditReport, finding: AuditFinding): string {
  if (finding.relatedTest == null || finding.relatedStep == null) {
    return "Unknown step";
  }

  const test = report.suiteResult.tests.find(candidate => candidate.name === finding.relatedTest);
  const step = test?.steps[finding.relatedStep];
  if (!step) {
    return "Unknown step";
  }

  return describeStep(step.step);
}

function toReference(issue: LinearIssueNode, group: LinearIssueGroup): LinearIssueReference {
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    issueKey: group.issueKey,
    findingCount: group.findings.length,
  };
}

export class LinearClient {
  constructor(
    private apiKey: string,
    private transport: LinearTransport = { fetch },
  ) {}

  async findOpenIssueByMarker(
    teamId: string,
    marker: string,
    projectId?: string,
  ): Promise<LinearIssueNode | null> {
    const projectFilter = projectId
      ? "\n            project: { id: { eq: $projectId } }"
      : "";
    const query = `query FindOpenIssue($teamId: String!, $marker: String!, $projectId: String) {
      team(id: $teamId) {
        issues(filter: {
          description: { contains: $marker }
          state: { type: { nin: ["completed", "canceled"] } }${projectFilter}
        }) {
          nodes {
            id
            identifier
            title
          }
        }
      }
    }`;

    const data = await this.request<{
      team: { issues: { nodes: LinearIssueNode[] } } | null;
    }>(query, { teamId, marker, projectId });

    return data.team?.issues.nodes[0] ?? null;
  }

  async createIssue(input: {
    teamId: string;
    projectId?: string;
    title: string;
    description: string;
  }): Promise<LinearIssueNode> {
    const data = await this.request<{
      issueCreate: { success: boolean; issue: LinearIssueNode | null };
    }>(
      `mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            title
          }
        }
      }`,
      { input },
    );

    if (!data.issueCreate.success || !data.issueCreate.issue) {
      throw new Error("Linear issueCreate did not return an issue.");
    }

    return data.issueCreate.issue;
  }

  async createComment(issueId: string, body: string): Promise<void> {
    const data = await this.request<{
      commentCreate: { success: boolean };
    }>(
      `mutation CreateComment($input: CommentCreateInput!) {
        commentCreate(input: $input) {
          success
        }
      }`,
      { input: { issueId, body } },
    );

    if (!data.commentCreate.success) {
      throw new Error("Linear commentCreate failed.");
    }
  }

  async uploadFile(
    filename: string,
    contentType: string,
    content: Buffer,
  ): Promise<string> {
    const data = await this.request<{
      fileUpload: {
        success: boolean;
        uploadFile: LinearFileUploadPayload | null;
      };
    }>(
      `mutation FileUpload($contentType: String!, $filename: String!, $size: Int!) {
        fileUpload(contentType: $contentType, filename: $filename, size: $size) {
          success
          uploadFile {
            uploadUrl
            assetUrl
            headers {
              key
              value
            }
          }
        }
      }`,
      {
        contentType,
        filename,
        size: content.byteLength,
      },
    );

    const upload = data.fileUpload.uploadFile;
    if (!data.fileUpload.success || !upload) {
      throw new Error("Linear fileUpload did not return an upload URL.");
    }

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "public, max-age=31536000");
    for (const header of upload.headers) {
      headers.set(header.key, header.value);
    }

    const response = await this.transport.fetch(upload.uploadUrl, {
      method: "PUT",
      headers,
      body: new Uint8Array(content),
    });

    if (!response.ok) {
      throw new Error(`Linear file upload failed with HTTP ${response.status}.`);
    }

    return upload.assetUrl;
  }

  private async request<TData>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<TData> {
    const response = await this.transport.fetch(LINEAR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Linear GraphQL request failed with HTTP ${response.status}.`);
    }

    const payload = await response.json() as {
      data?: TData;
      errors?: Array<{ message?: string }>;
    };

    if (payload.errors?.length) {
      throw new Error(payload.errors.map(error => error.message ?? "Unknown GraphQL error").join("; "));
    }

    if (!payload.data) {
      throw new Error("Linear GraphQL response did not include data.");
    }

    return payload.data;
  }
}
