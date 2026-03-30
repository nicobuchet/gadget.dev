import { execFileSync } from "node:child_process";

export interface DiffContext {
  diff: string;
  baseBranch: string;
  changedFiles: string[];
  mrDescription?: string;
}

export async function readDiff(options: {
  baseBranch?: string;
  mrUrl?: string;
}): Promise<DiffContext> {
  const baseBranch = options.baseBranch ?? "main";

  // Verify we're in a git repo
  try {
    execFileSync("git", ["rev-parse", "--git-dir"], { stdio: "pipe" });
  } catch {
    throw new Error("gadget check must be run inside a git repository");
  }

  // Get the diff
  let diff: string;
  try {
    diff = execFileSync("git", ["diff", `${baseBranch}...HEAD`], {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
  } catch {
    // Fallback: if three-dot fails (e.g. branch not found), try two-dot
    try {
      diff = execFileSync("git", ["diff", baseBranch], {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (err) {
      throw new Error(
        `Failed to get git diff against "${baseBranch}". Does the branch exist?`,
      );
    }
  }

  // Get changed file names
  let changedFiles: string[] = [];
  try {
    const nameOnly = execFileSync(
      "git",
      ["diff", "--name-only", `${baseBranch}...HEAD`],
      { encoding: "utf-8" },
    );
    changedFiles = nameOnly
      .trim()
      .split("\n")
      .filter((f) => f.length > 0);
  } catch {
    // Non-critical, continue without file list
  }

  // Fetch MR/PR description if URL provided
  let mrDescription: string | undefined;
  if (options.mrUrl) {
    mrDescription = await fetchMrDescription(options.mrUrl);
  }

  return { diff, baseBranch, changedFiles, mrDescription };
}

async function fetchMrDescription(url: string): Promise<string | undefined> {
  try {
    // GitLab MR
    const gitlabMatch = url.match(
      /gitlab\.com\/(.+)\/-\/merge_requests\/(\d+)/,
    );
    if (gitlabMatch) {
      const projectPath = encodeURIComponent(gitlabMatch[1]);
      const mrIid = gitlabMatch[2];
      const token = process.env.GITLAB_TOKEN;
      const headers: Record<string, string> = {};
      if (token) headers["PRIVATE-TOKEN"] = token;

      const res = await fetch(
        `https://gitlab.com/api/v4/projects/${projectPath}/merge_requests/${mrIid}`,
        { headers },
      );
      if (res.ok) {
        const data = (await res.json()) as { description?: string; title?: string };
        return [data.title, data.description].filter(Boolean).join("\n\n");
      }
    }

    // GitHub PR
    const githubMatch = url.match(
      /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/,
    );
    if (githubMatch) {
      const [, owner, repo, number] = githubMatch;
      const token = process.env.GITHUB_TOKEN;
      const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
        { headers },
      );
      if (res.ok) {
        const data = (await res.json()) as { body?: string; title?: string };
        return [data.title, data.body].filter(Boolean).join("\n\n");
      }
    }

    console.warn(`Could not fetch MR description from: ${url}`);
    return undefined;
  } catch {
    console.warn(`Failed to fetch MR description from: ${url}`);
    return undefined;
  }
}
