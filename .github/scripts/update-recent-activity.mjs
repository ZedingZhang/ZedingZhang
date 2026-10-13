import { readFile, writeFile } from "node:fs/promises";

const username = process.env.GH_USERNAME;
const token = process.env.GITHUB_TOKEN;
const excludedRepos = new Set(
  splitList(process.env.EXCLUDED_REPOS).map((repo) => repo.toLowerCase()),
);

if (!username) throw new Error("GH_USERNAME is required");
if (!token) throw new Error("GITHUB_TOKEN is required");
const normalizedUsername = username.toLowerCase();
const projectNotes = JSON.parse(
  await readFile(new URL("../contributions.json", import.meta.url), "utf8"),
);

const pullRequestQuery = `
  query PullRequestHistory($login: String!, $after: String) {
    user(login: $login) {
      pullRequests(
        first: 100
        after: $after
        orderBy: { field: CREATED_AT, direction: DESC }
      ) {
        nodes {
          number
          title
          url
          createdAt
          mergedAt
          state
          repository {
            name
            nameWithOwner
            url
            stargazerCount
            isPrivate
            owner {
              login
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

const pullRequests = await fetchPullRequests();
const eligiblePullRequests = pullRequests.filter(
  (pullRequest) =>
    !pullRequest.repository.isPrivate &&
    pullRequest.repository.owner.login.toLowerCase() !== normalizedUsername &&
    !excludedRepos.has(pullRequest.repository.nameWithOwner.toLowerCase()),
);
const mergedPullRequests = eligiblePullRequests
  .filter((pullRequest) => Boolean(pullRequest.mergedAt))
  .sort((left, right) => comparePullRequests(left, right, "mergedAt"));
const openPullRequests = eligiblePullRequests
  .filter((pullRequest) => pullRequest.state === "OPEN")
  .sort((left, right) => comparePullRequests(left, right, "createdAt"));

const projects = new Map();
for (const pullRequest of mergedPullRequests) {
  const key = pullRequest.repository.nameWithOwner;
  if (!projects.has(key)) {
    projects.set(key, { repository: pullRequest.repository, pullRequests: [] });
  }
  projects.get(key).pullRequests.push(pullRequest);
}
const sortedProjects = [...projects.values()].sort(
  (left, right) =>
    right.pullRequests.length - left.pullRequests.length ||
    right.repository.stargazerCount - left.repository.stargazerCount ||
    left.repository.nameWithOwner.localeCompare(right.repository.nameWithOwner),
);

const readmePath = "README.md";
const readme = await readFile(readmePath, "utf8");
const startMarker = "<!--OPEN_SOURCE_CONTRIBUTIONS:start-->";
const endMarker = "<!--OPEN_SOURCE_CONTRIBUTIONS:end-->";
const start = readme.indexOf(startMarker);
const end = readme.indexOf(endMarker);

if (start === -1 || end === -1 || end < start) {
  throw new Error(
    "Open Source Contributions markers are missing or out of order in README.md",
  );
}

const generated = renderContributions();
const updated =
  readme.slice(0, start) + generated + readme.slice(end + endMarker.length);

await writeFile(readmePath, updated, "utf8");

function splitList(value = "") {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function fetchPullRequests() {
  const pullRequests = [];
  let after = null;

  while (true) {
    const connection = await fetchPullRequestPage(after);
    pullRequests.push(...connection.nodes.filter(Boolean));

    if (!connection.pageInfo.hasNextPage) return pullRequests;
    if (!connection.pageInfo.endCursor) {
      throw new Error("GitHub returned another PR page without an end cursor");
    }

    after = connection.pageInfo.endCursor;
  }
}

async function fetchPullRequestPage(after) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "profile-contributions-workflow",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      query: pullRequestQuery,
      variables: {
        login: username,
        after,
      },
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      `GitHub GraphQL API returned ${response.status}: ${JSON.stringify(result)}`,
    );
  }

  if (result.errors?.length) {
    throw new Error(
      `GitHub GraphQL API returned errors: ${result.errors
        .map((error) => error.message)
        .join("; ")}`,
    );
  }

  const user = result.data?.user;
  if (!user) throw new Error(`GitHub user ${username} was not found`);

  return user.pullRequests;
}

function comparePullRequests(left, right, dateField) {
  const timeDifference = Date.parse(right[dateField]) - Date.parse(left[dateField]);
  if (timeDifference !== 0) return timeDifference;

  return `${left.repository.nameWithOwner}#${left.number}`.localeCompare(
    `${right.repository.nameWithOwner}#${right.number}`,
  );
}

function renderContributions() {
  return [
    startMarker,
    "",
    `${mergedPullRequests.length} merged PRs across ${sortedProjects.length} upstream projects, ordered by merged PR count. The project name links to the repository, the PR number to the change.`,
    "",
    "| Project | Merged | What the PRs cover | Highlight fixes |",
    "|---------|:------:|--------------------|-----------------|",
    ...sortedProjects.map(({ repository, pullRequests }) => {
      const notes = projectNotes[repository.nameWithOwner];
      const summary = notes?.summary ?? pullRequests
        .slice(0, 3)
        .map((pr) => pr.title)
        .join("; ");
      const highlights = notes?.highlights ?? pullRequests
        .slice(0, 2)
        .map((pr) => ({ number: pr.number }));
      const fixes = highlights.flatMap((highlight) => {
        const pr = pullRequests.find((item) => item.number === highlight.number);
        return pr ? [formatPullRequest(pr, highlight.description)] : [];
      }).join("<br>");
      return `| ${formatProject(repository)} | **${pullRequests.length}** | ${escapeMarkdown(summary)} | ${fixes} |`;
    }),
    "",
    ...sortedProjects.flatMap(({ repository, pullRequests }) => [
      "<details>",
      `<summary>All ${pullRequests.length} merged ${escapeHtml(projectName(repository))} ${pullRequests.length === 1 ? "PR" : "PRs"}</summary>`,
      "",
      "| PR | What changed |",
      "|:--:|--------------|",
      ...pullRequests.map((pr) => `| [#${pr.number}](${pr.url}) | ${escapeMarkdown(pr.title)} |`),
      "",
      "</details>",
      "",
    ]),
    "<details>",
    `<summary>Open PRs (${openPullRequests.length})</summary>`,
    "",
    "| Project | PR | What I'm working on |",
    "|---------|:--:|---------------------|",
    ...openPullRequests.map((pr) =>
      `| [${escapeMarkdown(projectName(pr.repository))}](${pr.repository.url}) | [#${pr.number}](${pr.url}) | ${escapeMarkdown(pr.title)} |`,
    ),
    "",
    "</details>",
    "",
    endMarker,
  ].join("\n");
}

function projectName(repository) {
  return projectNotes[repository.nameWithOwner]?.name ?? repository.name;
}

function formatProject(repository) {
  const stars = repository.stargazerCount >= 1000
    ? `${(repository.stargazerCount / 1000).toFixed(1)}k`
    : String(repository.stargazerCount);
  return `[${escapeMarkdown(projectName(repository))}](${repository.url}) (${stars}★)`;
}

function formatPullRequest(pullRequest, description = pullRequest.title) {
  return `[#${pullRequest.number}](${pullRequest.url}) ${escapeMarkdown(description)}`;
}

function escapeMarkdown(value) {
  return escapeHtml(value)
    .replaceAll("\\", "\\\\")
    .replace(/([\[\]*_])/g, "\\$1")
    .replaceAll("|", "&#124;")
    .replace(/[\r\n]+/g, " ");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
