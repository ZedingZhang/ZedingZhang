import { mkdir, readFile, writeFile } from "node:fs/promises";

const username = process.env.GH_USERNAME;
const token = process.env.GITHUB_TOKEN;
const excludedRepos = new Set(
  splitList(process.env.EXCLUDED_REPOS).map((repo) => repo.toLowerCase()),
);

if (!username) throw new Error("GH_USERNAME is required");
if (!token) throw new Error("GITHUB_TOKEN is required");
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

const lightChartPath = "assets/open-source-contributions-light.svg";
const darkChartPath = "assets/open-source-contributions-dark.svg";

await mkdir("assets", { recursive: true });
await Promise.all([
  writeFile(lightChartPath, renderBarChartSvg(sortedProjects, "light"), "utf8"),
  writeFile(darkChartPath, renderBarChartSvg(sortedProjects, "dark"), "utf8"),
]);

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
    `${mergedPullRequests.length} merged PRs across ${sortedProjects.length} upstream projects.`,
    "",
    '<p align="center">',
    "  <picture>",
    "    <source",
    '      media="(prefers-color-scheme: dark)"',
    '      srcset="./assets/open-source-contributions-dark.svg"',
    "    />",
    "    <source",
    '      media="(prefers-color-scheme: light)"',
    '      srcset="./assets/open-source-contributions-light.svg"',
    "    />",
    "    <img",
    `      alt="${escapeHtml(`${username}'s open source merged pull requests across ${sortedProjects.length} upstream projects`)}"`,
    '      src="./assets/open-source-contributions-light.svg"',
    '      width="100%"',
    "    />",
    "  </picture>",
    "</p>",
    "",
    endMarker,
  ].join("\n");
}

function renderBarChartSvg(projectEntries, mode) {
  const SANS =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
  const MONO =
    "ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, monospace";

  const themes = {
    light: {
      barStart: "#0969DA",
      barEnd: "#218BFF",
      ownerText: "#656D76",
      repoText: "#1F2328",
      valueText: "#1F2328",
      axisText: "#57606A",
      axisLine: "#D0D7DE",
      gridLine: "#D0D7DE",
      gridOpacity: "0.6",
      rowStripe: "#8C959F",
      rowStripeOpacity: "0.05",
    },
    dark: {
      barStart: "#1F6FEB",
      barEnd: "#58A6FF",
      ownerText: "#8B949E",
      repoText: "#E6EDF3",
      valueText: "#E6EDF3",
      axisText: "#8B949E",
      axisLine: "#30363D",
      gridLine: "#30363D",
      gridOpacity: "0.7",
      rowStripe: "#8B949E",
      rowStripeOpacity: "0.06",
    },
  };

  const t = themes[mode];
  const width = 880;
  const padLeft = 14;
  const padRight = 44;
  const padTop = 14;
  const padBottom = 36;
  const rowHeight = 28;
  const barHeight = 16;
  const barYOffset = 6;

  const maxLabelChars = Math.max(
    ...projectEntries.map((entry) => entry.repository.nameWithOwner.length),
    16,
  );
  const labelWidth = Math.min(
    265,
    Math.max(204, Math.ceil(maxLabelChars * 7.6) + 22),
  );
  const axisX = padLeft + labelWidth;
  const barAreaWidth = width - axisX - padRight;
  const chartHeight = Math.max(1, projectEntries.length) * rowHeight;
  const height = padTop + chartHeight + padBottom;

  const maxCount = Math.max(
    0,
    ...projectEntries.map((entry) => entry.pullRequests.length),
  );
  const { axisMax, ticks } = computeNiceScale(maxCount);
  const staggerStep = Math.min(
    70,
    Math.floor(1400 / Math.max(1, projectEntries.length)),
  );

  const gridAndTicks = ticks
    .map((tick) => {
      const x = axisX + (tick / axisMax) * barAreaWidth;
      const xStr = x.toFixed(2);
      const grid =
        tick === 0
          ? ""
          : `  <line x1="${xStr}" y1="${padTop}" x2="${xStr}" y2="${padTop + chartHeight}" stroke="${t.gridLine}" stroke-width="1" stroke-dasharray="3 3" stroke-opacity="${t.gridOpacity}"/>\n`;
      const label = `  <text x="${xStr}" y="${padTop + chartHeight + 16}" text-anchor="middle" font-family="${MONO}" font-size="11" fill="${t.axisText}">${tick}</text>`;
      return `${grid}${label}`;
    })
    .join("\n");

  const rows = projectEntries
    .map((entry, index) => {
      const rowY = padTop + index * rowHeight;
      const count = entry.pullRequests.length;
      const nameWithOwner = entry.repository.nameWithOwner;
      const slashIndex = nameWithOwner.indexOf("/");
      const owner = slashIndex === -1 ? "" : nameWithOwner.slice(0, slashIndex);
      const repo =
        slashIndex === -1 ? nameWithOwner : nameWithOwner.slice(slashIndex + 1);

      const stripe =
        index % 2 === 0
          ? `  <rect x="${padLeft}" y="${rowY + 1}" width="${width - padLeft - 10}" height="${rowHeight - 2}" rx="4" fill="${t.rowStripe}" fill-opacity="${t.rowStripeOpacity}"/>\n`
          : "";

      const labelText = owner
        ? `<tspan fill="${t.ownerText}" font-weight="400">${escapeXml(owner)}/</tspan><tspan fill="${t.repoText}" font-weight="600">${escapeXml(repo)}</tspan>`
        : `<tspan fill="${t.repoText}" font-weight="600">${escapeXml(repo)}</tspan>`;

      const delayMs = index * staggerStep;
      const valueDelayMs = delayMs + 640;
      const rawBarWidth = (count / axisMax) * barAreaWidth;
      const barWidth = Math.max(5, rawBarWidth);
      const by = rowY + barYOffset;
      const r = Math.min(4, barWidth / 2);
      const barPath = [
        "M 0 0",
        `H ${(barWidth - r).toFixed(2)}`,
        `Q ${barWidth.toFixed(2)} 0 ${barWidth.toFixed(2)} ${r.toFixed(2)}`,
        `V ${(barHeight - r).toFixed(2)}`,
        `Q ${barWidth.toFixed(2)} ${barHeight} ${(barWidth - r).toFixed(2)} ${barHeight}`,
        "H 0",
        "Z",
      ].join(" ");

      const countX = (axisX + barWidth + 8).toFixed(1);

      return `${stripe}  <text x="${axisX - 12}" y="${rowY + 18.5}" text-anchor="end" font-family="${SANS}" font-size="12.5">${labelText}</text>
  <g transform="translate(${axisX}, ${by})">
    <path class="bar" d="${barPath}" fill="url(#barGrad-${mode})" style="animation-delay: ${delayMs}ms;"/>
  </g>
  <g transform="translate(${countX}, ${rowY + 18.5})">
    <text class="bar-value" x="0" y="0" font-family="${MONO}" font-size="12" font-weight="600" fill="${t.valueText}" style="animation-delay: ${valueDelayMs}ms;">${count}</text>
  </g>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" role="img" aria-label="${escapeXml(`${username} open source merged PR counts by repository`)}">
  <defs>
    <linearGradient id="barGrad-${mode}" x1="0" y1="0" x2="${barAreaWidth}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${t.barStart}"/>
      <stop offset="100%" stop-color="${t.barEnd}"/>
    </linearGradient>
  </defs>
  <style>
    @keyframes barGrow {
      from {
        transform: scaleX(0);
      }
      to {
        transform: scaleX(1);
      }
    }
    @keyframes valueFade {
      from {
        opacity: 0;
        transform: translateX(-6px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    .bar {
      transform-origin: 0 0;
      transform: scaleX(0);
      animation: barGrow 1400ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .bar-value {
      opacity: 0;
      animation: valueFade 600ms ease-out both;
    }
  </style>
${gridAndTicks}
  <line x1="${axisX}" y1="${padTop}" x2="${axisX}" y2="${padTop + chartHeight}" stroke="${t.axisLine}" stroke-width="1"/>
${rows}
  <text x="${(axisX + barAreaWidth / 2).toFixed(1)}" y="${padTop + chartHeight + 31}" text-anchor="middle" font-family="${SANS}" font-size="11" fill="${t.axisText}">Merged PRs</text>
</svg>
`;
}

function computeNiceScale(maxCount) {
  if (maxCount <= 0) {
    return { axisMax: 1, ticks: [0, 1] };
  }
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000, 2000, 5000];
  const step =
    steps.find((candidate) => Math.ceil(maxCount / candidate) <= 5) ??
    Math.ceil(maxCount / 5);
  const tickCount = Math.max(1, Math.ceil(maxCount / step));
  const axisMax = tickCount * step;
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => index * step);
  return { axisMax, ticks };
}

function escapeXml(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
