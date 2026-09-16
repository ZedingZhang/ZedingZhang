import { readFile, writeFile } from "node:fs/promises";

const username = process.env.GH_USERNAME;
const token = process.env.GITHUB_TOKEN;
const maxItemsPerColumn = Number.parseInt(
  process.env.MAX_ITEMS_PER_COLUMN ?? "10",
  10,
);
const excludedRepos = new Set(
  splitList(process.env.EXCLUDED_REPOS).map((repo) => repo.toLowerCase()),
);

if (!username) throw new Error("GH_USERNAME is required");
if (!token) throw new Error("GITHUB_TOKEN is required");
if (
  !Number.isInteger(maxItemsPerColumn) ||
  maxItemsPerColumn < 1 ||
  maxItemsPerColumn > 50
) {
  throw new Error("MAX_ITEMS_PER_COLUMN must be an integer from 1 to 50");
}

const normalizedUsername = username.toLowerCase();

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
          url
          createdAt
          mergedAt
          state
          repository {
            nameWithOwner
            url
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
  .sort((left, right) => comparePullRequests(left, right, "mergedAt"))
  .slice(0, maxItemsPerColumn);
const openPullRequests = eligiblePullRequests
  .filter((pullRequest) => pullRequest.state === "OPEN")
  .sort((left, right) => comparePullRequests(left, right, "createdAt"))
  .slice(0, maxItemsPerColumn);

const readmePath = "README.md";
const readme = await readFile(readmePath, "utf8");
const startMarker = "<!--RECENT_ACTIVITY:start-->";
const endMarker = "<!--RECENT_ACTIVITY:end-->";
const start = readme.indexOf(startMarker);
const end = readme.indexOf(endMarker);

if (start === -1 || end === -1 || end < start) {
  throw new Error("Recent Activity markers are missing or out of order in README.md");
}

const generated = renderActivityTable(mergedPullRequests, openPullRequests);
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
      "User-Agent": "profile-recent-activity-workflow",
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

function renderActivityTable(merged, open) {
  return [
    startMarker,
    '<table width="100%">',
    "  <thead>",
    "    <tr>",
    '      <th width="50%">🎉 Merged PRs</th>',
    '      <th width="50%">💪 Open PRs</th>',
    "    </tr>",
    "  </thead>",
    "  <tbody>",
    "    <tr>",
    '      <td width="50%" valign="top">',
    ...renderPullRequestList(merged, "No merged PRs found."),
    "      </td>",
    '      <td width="50%" valign="top">',
    ...renderPullRequestList(open, "No open PRs found."),
    "      </td>",
    "    </tr>",
    "  </tbody>",
    "</table>",
    endMarker,
  ].join("\n");
}

function renderPullRequestList(pullRequests, emptyMessage) {
  if (pullRequests.length === 0) {
    return [`        <p><em>${escapeHtml(emptyMessage)}</em></p>`];
  }

  return [
    "        <ol>",
    ...pullRequests.map(
      (pullRequest) => `          <li>${formatPullRequest(pullRequest)}</li>`,
    ),
    "        </ol>",
  ];
}

function formatPullRequest(pullRequest) {
  const pullLink = `<a href="${escapeHtml(pullRequest.url)}">#${pullRequest.number}</a>`;
  const repoLink = `<a href="${escapeHtml(pullRequest.repository.url)}">${escapeHtml(
    pullRequest.repository.nameWithOwner,
  )}</a>`;

  return `${pullLink} in ${repoLink}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
