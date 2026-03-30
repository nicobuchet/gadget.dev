import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type {
  StepDefinition,
  StepResult,
  TestResult,
  SuiteResult,
  AuditReport,
  AuditFinding,
  ReporterInterface,
} from "../types/index.js";
import { describeStep } from "../runner/runner.js";

export class HtmlReporter implements ReporterInterface {
  private testResults: TestResult[] = [];

  constructor(private outputDir: string) {}

  onTestStart(_name: string): void {}
  onStepResult(_step: StepDefinition, _result: StepResult): void {}

  onTestEnd(result: TestResult): void {
    this.testResults.push(result);
  }

  onSuiteEnd(result: SuiteResult): void {
    const html = this.generateHtml(result);
    mkdirSync(this.outputDir, { recursive: true });
    writeFileSync(join(this.outputDir, "report.html"), html);
  }

  private generateHtml(suite: SuiteResult): string {
    const testsHtml = this.testResults
      .map((test) => this.renderTest(test))
      .join("\n");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gadget Report — ${this.escapeHtml(suite.name)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; padding: 20px; }
    .header { background: #1a1a2e; color: white; padding: 24px; border-radius: 8px; margin-bottom: 20px; }
    .header h1 { font-size: 24px; margin-bottom: 8px; }
    .summary { display: flex; gap: 16px; }
    .summary .stat { padding: 4px 12px; border-radius: 4px; font-weight: 600; }
    .stat.pass { background: #22c55e33; color: #16a34a; }
    .stat.fail { background: #ef444433; color: #dc2626; }
    .stat.skip { background: #f59e0b33; color: #d97706; }
    .stat.time { background: #64748b33; color: #94a3b8; }
    .test { background: white; border-radius: 8px; margin-bottom: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .test-header { padding: 16px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
    .test-header:hover { background: #f8f9fa; }
    .test-header.pass { border-left: 4px solid #22c55e; }
    .test-header.fail { border-left: 4px solid #ef4444; }
    .test-body { padding: 0 16px 16px; display: none; }
    .test.open .test-body { display: block; }
    .step { padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
    .step:last-child { border-bottom: none; }
    .step-line { display: flex; align-items: center; gap: 8px; }
    .icon { width: 20px; text-align: center; }
    .icon.pass { color: #22c55e; }
    .icon.fail { color: #ef4444; }
    .icon.skip { color: #f59e0b; }
    .duration { color: #94a3b8; font-size: 13px; margin-left: auto; }
    .error { background: #fef2f2; color: #991b1b; padding: 8px 12px; border-radius: 4px; margin-top: 8px; font-family: monospace; font-size: 13px; white-space: pre-wrap; }
    .analysis { background: #eff6ff; padding: 8px 12px; border-radius: 4px; margin-top: 8px; font-size: 13px; }
    .analysis h4 { color: #1e40af; margin-bottom: 4px; }
    .analysis .category { display: inline-block; background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 10px; font-size: 12px; margin-bottom: 4px; }
    .screenshot { margin-top: 8px; }
    .screenshot img { max-width: 100%; border: 1px solid #e5e7eb; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Gadget Report</h1>
    <p>${this.escapeHtml(suite.name)}</p>
    <div class="summary">
      <span class="stat pass">${suite.passed} passed</span>
      <span class="stat fail">${suite.failed} failed</span>
      ${suite.skipped > 0 ? `<span class="stat skip">${suite.skipped} skipped</span>` : ""}
      <span class="stat time">${suite.duration}ms</span>
    </div>
  </div>
  ${testsHtml}
  <script>
    document.querySelectorAll('.test-header').forEach(h => {
      h.addEventListener('click', () => h.closest('.test').classList.toggle('open'));
    });
    // Auto-open failed tests
    document.querySelectorAll('.test-header.fail').forEach(h => {
      h.closest('.test').classList.add('open');
    });
  </script>
</body>
</html>`;
  }

  private renderTest(test: TestResult): string {
    const stepsHtml = test.steps.map((r) => this.renderStep(r)).join("\n");

    return `<div class="test">
  <div class="test-header ${test.status}">
    <span>${this.escapeHtml(test.name)}</span>
    <span class="duration">${test.duration}ms</span>
  </div>
  <div class="test-body">${stepsHtml}</div>
</div>`;
  }

  private renderStep(result: StepResult): string {
    const icon =
      result.status === "pass" ? "✓" : result.status === "fail" ? "✗" : "○";
    const desc = describeStep(result.step);

    let extra = "";

    if (result.error) {
      extra += `<div class="error">${this.escapeHtml(result.error)}</div>`;
    }

    if (result.analysis) {
      extra += `<div class="analysis">
        <h4>AI Analysis</h4>
        <span class="category">${result.analysis.category}</span>
        <p>${this.escapeHtml(result.analysis.summary)}</p>
        <p>${this.escapeHtml(result.analysis.details)}</p>
        ${result.analysis.suggestedFix ? `<p><strong>Suggested fix:</strong> ${this.escapeHtml(result.analysis.suggestedFix)}</p>` : ""}
      </div>`;
    }

    if (result.screenshotPath) {
      try {
        const imgData = readFileSync(result.screenshotPath);
        const base64 = imgData.toString("base64");
        extra += `<div class="screenshot"><img src="data:image/png;base64,${base64}" alt="Screenshot"></div>`;
      } catch {
        // Screenshot file may not exist
      }
    }

    return `<div class="step">
  <div class="step-line">
    <span class="icon ${result.status}">${icon}</span>
    <span>${this.escapeHtml(desc)}</span>
    <span class="duration">${result.duration}ms</span>
  </div>
  ${extra}
</div>`;
  }

  onAuditEnd(report: AuditReport): void {
    const verdictColors = {
      "ready": "#22c55e",
      "not-ready": "#ef4444",
      "needs-attention": "#f59e0b",
    };
    const severityColors = {
      critical: "#ef4444",
      warning: "#f59e0b",
      nitpick: "#06b6d4",
      improvement: "#3b82f6",
    };

    const findingsHtml = (["critical", "warning", "nitpick", "improvement"] as const)
      .map(severity => {
        const items = report.findings.filter(f => f.severity === severity);
        if (items.length === 0) return "";
        return `<div class="finding-group">
          <h3 style="color: ${severityColors[severity]}; text-transform: uppercase; margin: 16px 0 8px;">${severity} (${items.length})</h3>
          ${items.map(f => `<div class="finding" style="border-left: 3px solid ${severityColors[f.severity]}; padding: 8px 12px; margin-bottom: 8px; background: white; border-radius: 4px;">
            <strong>${this.escapeHtml(f.title)}</strong>
            <p style="color: #666; font-size: 14px; margin-top: 4px;">${this.escapeHtml(f.description)}</p>
            ${f.relatedTest ? `<span style="color: #999; font-size: 12px;">Test: ${this.escapeHtml(f.relatedTest)}</span>` : ""}
          </div>`).join("\n")}
        </div>`;
      })
      .join("\n");

    const auditHtml = `<div class="audit-section" style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
      <h2 style="margin-bottom: 12px;">Audit Verdict</h2>
      <div style="display: inline-block; padding: 8px 16px; border-radius: 6px; color: white; font-weight: bold; font-size: 18px; background: ${verdictColors[report.verdict.readiness]};">
        ${report.verdict.readiness.toUpperCase()}
      </div>
      <span style="color: #666; margin-left: 12px;">Confidence: ${(report.verdict.confidence * 100).toFixed(0)}%</span>
      <p style="margin-top: 12px; font-size: 15px; line-height: 1.6;">${this.escapeHtml(report.verdict.summary)}</p>
      ${findingsHtml}
    </div>`;

    // Re-generate the full report with audit section inserted after the header
    const fullHtml = this.generateHtml(report.suiteResult).replace(
      "</div>\n  <div class=\"test",
      `</div>\n  ${auditHtml}\n  <div class="test`,
    );

    mkdirSync(this.outputDir, { recursive: true });
    writeFileSync(join(this.outputDir, "report.html"), fullHtml);
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}
