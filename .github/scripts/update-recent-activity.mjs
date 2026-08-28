import { readFile, writeFile } from "node:fs/promises";

const username = process.env.GH_USERNAME;
const token = process.env.GITHUB_TOKEN;
const maxLines = Number.parseInt(process.env.MAX_LINES ?? "15", 10);
const allowedEvents = new Set(splitList(process.env.FILTER_EVENTS));
const excludedRepos = new Set(
  splitList(process.env.EXCLUDED_REPOS).map((repo) => repo.toLowerCase()),
);

if (!username) throw new Error("GH_USERNAME is required");
if (!token) throw new Error("GITHUB_TOKEN is required");
if (!Number.isInteger(maxLines) || maxLines < 1 || maxLines > 100) {
  throw new Error("MAX_LINES must be an integer from 1 to 100");
}

const activity = [];

for (let page = 1; page <= 3 && activity.length < maxLines; page += 1) {
  const events = await fetchEvents(page);

  for (const event of events) {
    if (allowedEvents.size > 0 && !allowedEvents.has(event.type)) continue;
    if (excludedRepos.has(event.repo.name.toLowerCase())) continue;

    const line = formatEvent(event);
    if (line) activity.push(line);
    if (activity.length === maxLines) break;
  }

  if (events.length < 100) break;
}

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

async function fetchEvents(page) {
  const url = new URL(
    `https://api.github.com/users/${encodeURIComponent(username)}/events`,
  );
  url.searchParams.set("per_page", "100");
  url.searchParams.set("page", String(page));

  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "profile-recent-activity-workflow",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(
      `GitHub Events API returned ${response.status}: ${await response.text()}`,
    );
  }

  return response.json();
}

function formatEvent(event) {
  const repo = event.repo.name;
  const repoLink = `[${escapeMarkdown(repo)}](https://github.com/${repo})`;

  if (event.type === "IssuesEvent") {
    const issue = event.payload.issue;
    if (!issue?.number) return null;

    const issueLink = `[#${issue.number}](${issue.html_url})`;
    const actions = {
      opened: "❗ Opened issue",
      closed: "🔒 Closed issue",
      reopened: "♻️ Reopened issue",
      labeled: "ℹ️ Labeled issue",
      unlabeled: "ℹ️ Unlabeled issue",
    };
    const label = actions[event.payload.action];
    return label ? `${label} ${issueLink} in ${repoLink}` : null;
  }

  if (event.type === "PullRequestEvent") {
    const number = event.payload.number;
    if (!number) return null;

    const pullLink = `[#${number}](https://github.com/${repo}/pull/${number})`;
    const actions = {
      opened: "💪 Opened PR",
      closed: "❌ Closed PR",
      merged: "🎉 Merged PR",
      reopened: "♻️ Reopened PR",
    };
    const label = actions[event.payload.action];
    return label ? `${label} ${pullLink} in ${repoLink}` : null;
  }

  if (event.type === "ReleaseEvent") {
    const release = event.payload.release;
    if (!release?.html_url) return null;

    const name = release.name || release.tag_name;
    const releaseLink = `[${escapeMarkdown(name)}](${release.html_url})`;
    return `✌️ Released ${releaseLink} in ${repoLink}`;
  }

  return null;
}

function escapeMarkdown(value) {
  return String(value).replace(/[\\[\]]/g, "\\$&");
}
