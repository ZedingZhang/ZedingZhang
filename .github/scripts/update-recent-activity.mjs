import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

const username = process.env.GH_USERNAME;
const token = process.env.GITHUB_TOKEN;
const excludedRepos = new Set(
  splitList(process.env.EXCLUDED_REPOS).map((repo) => repo.toLowerCase()),
);

if (!username) throw new Error("GH_USERNAME is required");
if (!token) throw new Error("GITHUB_TOKEN is required");
const normalizedUsername = username.toLowerCase();

const CHART_SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const CHART_MONO =
  "ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, monospace";

const CHART_THEMES = {
  light: {
    barStart: "#0969DA",
    barEnd: "#218BFF",
    ownerText: "#656D76",
    repoText: "#1F2328",
    valueText: "#1F2328",
    axisText: "#57606A",
    starIcon: "#BF8700",
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
    starIcon: "#E3B341",
    axisLine: "#30363D",
    gridLine: "#30363D",
    gridOpacity: "0.7",
    rowStripe: "#8B949E",
    rowStripeOpacity: "0.06",
  },
};

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

const chartDir = "assets/open-source-contributions";
const layout = computeChartLayout(sortedProjects);

await rm(chartDir, { recursive: true, force: true });
await mkdir(chartDir, { recursive: true });

await Promise.all([
  ...sortedProjects.flatMap((entry, index) => {
    const rowSlug = `row-${String(index).padStart(2, "0")}`;
    return ["light", "dark"].map((mode) =>
      writeFile(
        `${chartDir}/${rowSlug}-${mode}.svg`,
        renderRowSvg(entry, index, layout, mode),
        "utf8",
      ),
    );
  }),
  ...["light", "dark"].map((mode) =>
    writeFile(`${chartDir}/axis-${mode}.svg`, renderAxisSvg(layout, mode), "utf8"),
  ),
]);

const generated = renderContributions(sortedProjects);
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

function renderContributions(projectEntries) {
  const rowBlocks = projectEntries.map((entry, index) => {
    const rowSlug = `row-${String(index).padStart(2, "0")}`;
    const count = entry.pullRequests.length;
    const stars = formatStars(entry.repository.stargazerCount);
    const prLabel = count === 1 ? "merged PR" : "merged PRs";
    const repoName = entry.repository.nameWithOwner;
    const title = escapeHtml(`${repoName} — ${count} ${prLabel} (${stars}★)`);
    const alt = escapeHtml(`${repoName}: ${count} ${prLabel} (${stars}★)`);
    const url = escapeHtml(entry.repository.url);

    return `<div><a href="${url}" title="${title}"><picture><source media="(prefers-color-scheme: dark)" srcset="./${chartDir}/${rowSlug}-dark.svg" /><source media="(prefers-color-scheme: light)" srcset="./${chartDir}/${rowSlug}-light.svg" /><img alt="${alt}" src="./${chartDir}/${rowSlug}-light.svg" width="100%" align="top" /></picture></a></div>`;
  });

  const axisBlock = `<div><picture><source media="(prefers-color-scheme: dark)" srcset="./${chartDir}/axis-dark.svg" /><source media="(prefers-color-scheme: light)" srcset="./${chartDir}/axis-light.svg" /><img alt="Merged PRs axis" src="./${chartDir}/axis-light.svg" width="100%" align="top" /></picture></div>`;

  return [
    startMarker,
    "",
    `${mergedPullRequests.length} merged PRs across ${projectEntries.length} upstream projects.`,
    "",
    ...rowBlocks,
    axisBlock,
    "",
    endMarker,
  ].join("\n");
}

function computeChartLayout(projectEntries) {
  const width = 880;
  const padLeft = 14;
  const padRight = 44;
  const rowHeight = 28;
  const barHeight = 16;
  const barYOffset = 6;
  const axisHeight = 36;

  const maxLabelChars = Math.max(
    ...projectEntries.map((entry) => entry.repository.nameWithOwner.length),
    16,
  );
  const labelWidth = Math.min(
    250,
    Math.max(196, Math.ceil(maxLabelChars * 7.4) + 16),
  );
  const maxStarChars = Math.max(
    ...projectEntries.map(
      (entry) => formatStars(entry.repository.stargazerCount).length + 1,
    ),
    5,
  );
  const starGap = 10;
  const starWidth = Math.max(54, Math.ceil(maxStarChars * 6.8) + 8);
  const axisGap = 12;
  const repoRightX = padLeft + labelWidth;
  const starRightX = repoRightX + starGap + starWidth;
  const axisX = starRightX + axisGap;
  const barAreaWidth = width - axisX - padRight;

  const maxCount = Math.max(
    0,
    ...projectEntries.map((entry) => entry.pullRequests.length),
  );
  const { axisMax, ticks } = computeNiceScale(maxCount);
  const staggerStep = Math.min(
    140,
    Math.floor(2800 / Math.max(1, projectEntries.length)),
  );

  return {
    width,
    padLeft,
    rowHeight,
    barHeight,
    barYOffset,
    axisHeight,
    repoRightX,
    starRightX,
    axisX,
    barAreaWidth,
    axisMax,
    ticks,
    staggerStep,
  };
}

function renderRowSvg(entry, index, layout, mode) {
  const t = CHART_THEMES[mode];
  const {
    width,
    padLeft,
    rowHeight,
    barHeight,
    barYOffset,
    repoRightX,
    starRightX,
    axisX,
    barAreaWidth,
    axisMax,
    ticks,
    staggerStep,
  } = layout;

  const count = entry.pullRequests.length;
  const nameWithOwner = entry.repository.nameWithOwner;
  const slashIndex = nameWithOwner.indexOf("/");
  const owner = slashIndex === -1 ? "" : nameWithOwner.slice(0, slashIndex);
  const repo =
    slashIndex === -1 ? nameWithOwner : nameWithOwner.slice(slashIndex + 1);
  const stars = formatStars(entry.repository.stargazerCount);

  const gridLines = ticks
    .filter((tick) => tick > 0)
    .map((tick) => {
      const xStr = (axisX + (tick / axisMax) * barAreaWidth).toFixed(2);
      return `  <line x1="${xStr}" y1="0" x2="${xStr}" y2="${rowHeight}" stroke="${t.gridLine}" stroke-width="1" stroke-dasharray="3.5 3.5" stroke-opacity="${t.gridOpacity}"/>`;
    })
    .join("\n");

  const stripe =
    index % 2 === 0
      ? `  <rect x="${padLeft}" y="1" width="${width - padLeft - 10}" height="${rowHeight - 2}" rx="4" fill="${t.rowStripe}" fill-opacity="${t.rowStripeOpacity}"/>\n`
      : "";

  const labelText = owner
    ? `<tspan fill="${t.ownerText}" font-weight="400">${escapeXml(owner)}/</tspan><tspan fill="${t.repoText}" font-weight="600">${escapeXml(repo)}</tspan>`
    : `<tspan fill="${t.repoText}" font-weight="600">${escapeXml(repo)}</tspan>`;

  const delayMs = index * staggerStep;
  const valueDelayMs = delayMs + 1280;
  const rawBarWidth = (count / axisMax) * barAreaWidth;
  const barWidth = Math.max(5, rawBarWidth);
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

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${rowHeight}" viewBox="0 0 ${width} ${rowHeight}" fill="none" role="img" aria-label="${escapeXml(`${nameWithOwner}: ${count} merged PRs (${stars}★)`)}">
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
      animation: valueFade 1200ms ease-out both;
    }
  </style>
${gridLines}
  <line x1="${axisX}" y1="0" x2="${axisX}" y2="${rowHeight}" stroke="${t.axisLine}" stroke-width="1"/>
${stripe}  <text x="${repoRightX}" y="18.5" text-anchor="end" font-family="${CHART_SANS}" font-size="12.5">${labelText}</text>
  <text x="${starRightX}" y="18.5" text-anchor="end" font-family="${CHART_MONO}" font-size="11" font-weight="500"><tspan fill="${t.axisText}">${escapeXml(stars)}</tspan><tspan font-family="${CHART_SANS}" fill="${t.starIcon}" dx="1.5">&#9733;</tspan></text>
  <g transform="translate(${axisX}, ${barYOffset})">
    <path class="bar" d="${barPath}" fill="url(#barGrad-${mode})" style="animation-delay: ${delayMs}ms;"/>
  </g>
  <g transform="translate(${countX}, 18.5)">
    <text class="bar-value" x="0" y="0" font-family="${CHART_MONO}" font-size="12" font-weight="600" fill="${t.valueText}" style="animation-delay: ${valueDelayMs}ms;">${count}</text>
  </g>
</svg>
`;
}

function renderAxisSvg(layout, mode) {
  const t = CHART_THEMES[mode];
  const { width, axisHeight, axisX, barAreaWidth, axisMax, ticks } = layout;

  const tickLabels = ticks
    .map((tick) => {
      const xStr = (axisX + (tick / axisMax) * barAreaWidth).toFixed(2);
      return `  <text x="${xStr}" y="16" text-anchor="middle" font-family="${CHART_MONO}" font-size="11" fill="${t.axisText}">${tick}</text>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${axisHeight}" viewBox="0 0 ${width} ${axisHeight}" fill="none" role="img" aria-label="Merged PRs axis">
${tickLabels}
  <text x="${(axisX + barAreaWidth / 2).toFixed(1)}" y="31" text-anchor="middle" font-family="${CHART_SANS}" font-size="11" fill="${t.axisText}">Merged PRs</text>
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

function formatStars(stargazerCount) {
  return stargazerCount >= 1000
    ? `${(stargazerCount / 1000).toFixed(1)}k`
    : String(stargazerCount);
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
