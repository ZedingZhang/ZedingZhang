import { readFile, writeFile } from "node:fs/promises";

const username = process.env.GH_USERNAME;
const token = process.env.GITHUB_TOKEN;
const maxLines = Number.parseInt(process.env.MAX_LINES ?? "20", 10);
const excludedRepos = new Set(
  splitList(process.env.EXCLUDED_REPOS).map((repo) => repo.toLowerCase()),
);

if (!username) throw new Error("GH_USERNAME is required");
if (!token) throw new Error("GITHUB_TOKEN is required");
if (!Number.isInteger(maxLines) || maxLines < 1 || maxLines > 100) {
  throw new Error("MAX_LINES must be an integer from 1 to 100");
}

const pullRequestQuery = `
  query PullRequestHistory(
    $login: String!
    $after: String
    $timelineLimit: Int!
  ) {
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
          closedAt
          mergedAt
          repository {
            nameWithOwner
            url
            isPrivate
          }
          timelineItems(
            last: $timelineLimit
            itemTypes: [CLOSED_EVENT, REOPENED_EVENT]
          ) {
            nodes {
              __typename
              ... on ClosedEvent {
                createdAt
              }
              ... on ReopenedEvent {
                createdAt
              }
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
const activity = pullRequests
  .filter(
    (pullRequest) =>
      !pullRequest.repository.isPrivate &&
      !excludedRepos.has(pullRequest.repository.nameWithOwner.toLowerCase()),
  )
  .flatMap(toActivity)
  .sort(compareActivity)
  .slice(0, maxLines)
  .map(formatActivity);

const readmePath = "README.md";
const readme = await readFile(readmePath, "utf8");
const startMarker = "<!--RECENT_ACTIVITY:start-->";
const endMarker = "<!--RECENT_ACTIVITY:end-->";
const start = readme.indexOf(startMarker);
const end = readme.indexOf(endMarker);

if (start === -1 || end === -1 || end < start) {
  throw new Error("Recent Activity markers are missing or out of order in README.md");
}

const lines = activity.map((entry, index) => `${index + 1}. ${entry}`);
const generated = [startMarker, ...lines, endMarker].join("\n");
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
        timelineLimit: maxLines,
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

function toActivity(pullRequest) {
  const common = {
    number: pullRequest.number,
    pullUrl: pullRequest.url,
    repo: pullRequest.repository.nameWithOwner,
    repoUrl: pullRequest.repository.url,
  };
  const activity = [
    { ...common, action: "opened", occurredAt: pullRequest.createdAt },
  ];

  for (const event of pullRequest.timelineItems.nodes.filter(Boolean)) {
    if (event.__typename === "ReopenedEvent") {
      activity.push({ ...common, action: "reopened", occurredAt: event.createdAt });
      continue;
    }

    if (event.__typename === "ClosedEvent") {
      const isMergeClosure =
        pullRequest.mergedAt &&
        pullRequest.closedAt &&
        Date.parse(event.createdAt) === Date.parse(pullRequest.closedAt);

      if (!isMergeClosure) {
        activity.push({ ...common, action: "closed", occurredAt: event.createdAt });
      }
    }
  }

  if (pullRequest.mergedAt) {
    activity.push({
      ...common,
      action: "merged",
      occurredAt: pullRequest.mergedAt,
    });
  }

  return activity;
}

function compareActivity(left, right) {
  const timeDifference =
    Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
  if (timeDifference !== 0) return timeDifference;

  const actionPriority = { merged: 4, reopened: 3, closed: 2, opened: 1 };
  const actionDifference =
    actionPriority[right.action] - actionPriority[left.action];
  if (actionDifference !== 0) return actionDifference;

  return `${left.repo}#${left.number}`.localeCompare(
    `${right.repo}#${right.number}`,
  );
}

function formatActivity(activity) {
  const labels = {
    opened: "💪 Opened PR",
    closed: "❌ Closed PR",
    merged: "🎉 Merged PR",
    reopened: "♻️ Reopened PR",
  };
  const pullLink = `[#${activity.number}](${activity.pullUrl})`;
  const repoLink = `[${escapeMarkdown(activity.repo)}](${activity.repoUrl})`;

  return `${labels[activity.action]} ${pullLink} in ${repoLink}`;
}

function escapeMarkdown(value) {
  return String(value).replace(/[\\[\]]/g, "\\$&");
}
