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
    starBarStart: "#BF8700",
    starBarEnd: "#D4A72C",
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
    starBarStart: "#9E6A03",
    starBarEnd: "#E3B341",
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

  const axisBlock = `<div><picture><source media="(prefers-color-scheme: dark)" srcset="./${chartDir}/axis-dark.svg" /><source media="(prefers-color-scheme: light)" srcset="./${chartDir}/axis-light.svg" /><img alt="Stars and Merged PRs axes" src="./${chartDir}/axis-light.svg" width="100%" align="top" /></picture></div>`;

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
  const rowHeight = 28;
  const barHeight = 16;
  const barYOffset = 6;
  const axisHeight = 36;
  const leftPad = 64;
  const rightPad = 40;

  const maxLabelChars = Math.max(
    ...projectEntries.map((entry) => entry.repository.nameWithOwner.length),
    16,
  );
  const repoColWidth = Math.min(
    240,
    Math.max(196, Math.ceil(maxLabelChars * 7.5) + 22),
  );
  const remaining = width - leftPad - rightPad - repoColWidth;
  const starAreaWidth = Math.floor(remaining / 2);
  const prAreaWidth = remaining - starAreaWidth;
  const starAxisX = leftPad + starAreaWidth;
  const prAxisX = starAxisX + repoColWidth;
  const repoCenterX = (starAxisX + prAxisX) / 2;

  const maxStars = Math.max(
    0,
    ...projectEntries.map((entry) => entry.repository.stargazerCount),
  );
  const { axisMax: starAxisMax, ticks: starTicks } = computeNiceScale(
    maxStars,
    4,
  );

  const maxPrs = Math.max(
    0,
    ...projectEntries.map((entry) => entry.pullRequests.length),
  );
  const { axisMax: prAxisMax, ticks: prTicks } = computeNiceScale(maxPrs, 4);

  const staggerStep = Math.min(
    140,
    Math.floor(2800 / Math.max(1, projectEntries.length)),
  );

  return {
    width,
    rowHeight,
    barHeight,
    barYOffset,
    axisHeight,
    starAreaWidth,
    prAreaWidth,
    starAxisX,
    prAxisX,
    repoCenterX,
    starAxisMax,
    starTicks,
    prAxisMax,
    prTicks,
    staggerStep,
  };
}

function renderRowSvg(entry, index, layout, mode) {
  const t = CHART_THEMES[mode];
  const {
    width,
    rowHeight,
    barHeight,
    barYOffset,
    starAreaWidth,
    prAreaWidth,
    starAxisX,
    prAxisX,
    repoCenterX,
    starAxisMax,
    starTicks,
    prAxisMax,
    prTicks,
    staggerStep,
  } = layout;

  const count = entry.pullRequests.length;
  const starCount = entry.repository.stargazerCount;
  const nameWithOwner = entry.repository.nameWithOwner;
  const slashIndex = nameWithOwner.indexOf("/");
  const owner = slashIndex === -1 ? "" : nameWithOwner.slice(0, slashIndex);
  const repo =
    slashIndex === -1 ? nameWithOwner : nameWithOwner.slice(slashIndex + 1);
  const stars = formatStars(starCount);

  const leftGridLines = starTicks
    .filter((tick) => tick > 0)
    .map((tick) => {
      const xStr = (starAxisX - (tick / starAxisMax) * starAreaWidth).toFixed(2);
      return `  <line x1="${xStr}" y1="0" x2="${xStr}" y2="${rowHeight}" stroke="${t.gridLine}" stroke-width="1" stroke-dasharray="3.5 3.5" stroke-opacity="${t.gridOpacity}"/>`;
    })
    .join("\n");

  const rightGridLines = prTicks
    .filter((tick) => tick > 0)
    .map((tick) => {
      const xStr = (prAxisX + (tick / prAxisMax) * prAreaWidth).toFixed(2);
      return `  <line x1="${xStr}" y1="0" x2="${xStr}" y2="${rowHeight}" stroke="${t.gridLine}" stroke-width="1" stroke-dasharray="3.5 3.5" stroke-opacity="${t.gridOpacity}"/>`;
    })
    .join("\n");

  const stripe =
    index % 2 === 0
      ? `  <rect x="8" y="1" width="${width - 16}" height="${rowHeight - 2}" rx="4" fill="${t.rowStripe}" fill-opacity="${t.rowStripeOpacity}"/>\n`
      : "";

  const labelText = owner
    ? `<tspan fill="${t.ownerText}" font-weight="400">${escapeXml(owner)}/</tspan><tspan fill="${t.repoText}" font-weight="600">${escapeXml(repo)}</tspan>`
    : `<tspan fill="${t.repoText}" font-weight="600">${escapeXml(repo)}</tspan>`;

  const delayMs = index * staggerStep;
  const valueDelayMs = delayMs + 1280;

  const sw = Math.max(4, (starCount / starAxisMax) * starAreaWidth);
  const sr = Math.min(4, sw / 2);
  const starBarPath = [
    "M 0 0",
    `H ${(-sw + sr).toFixed(2)}`,
    `Q ${(-sw).toFixed(2)} 0 ${(-sw).toFixed(2)} ${sr.toFixed(2)}`,
    `V ${(barHeight - sr).toFixed(2)}`,
    `Q ${(-sw).toFixed(2)} ${barHeight} ${(-sw + sr).toFixed(2)} ${barHeight}`,
    "H 0",
    "Z",
  ].join(" ");
  const starCountX = (starAxisX - sw - 7).toFixed(1);

  const pw = Math.max(4, (count / prAxisMax) * prAreaWidth);
  const pr = Math.min(4, pw / 2);
  const prBarPath = [
    "M 0 0",
    `H ${(pw - pr).toFixed(2)}`,
    `Q ${pw.toFixed(2)} 0 ${pw.toFixed(2)} ${pr.toFixed(2)}`,
    `V ${(barHeight - pr).toFixed(2)}`,
    `Q ${pw.toFixed(2)} ${barHeight} ${(pw - pr).toFixed(2)} ${barHeight}`,
    "H 0",
    "Z",
  ].join(" ");
  const prCountX = (prAxisX + pw + 8).toFixed(1);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${rowHeight}" viewBox="0 0 ${width} ${rowHeight}" fill="none" role="img" aria-label="${escapeXml(`${nameWithOwner}: ${count} merged PRs, ${stars}★`)}">
  <defs>
    <linearGradient id="starBarGrad-${mode}" x1="0" y1="0" x2="${-starAreaWidth}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${t.starBarStart}"/>
      <stop offset="100%" stop-color="${t.starBarEnd}"/>
    </linearGradient>
    <linearGradient id="prBarGrad-${mode}" x1="0" y1="0" x2="${prAreaWidth}" y2="0" gradientUnits="userSpaceOnUse">
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
    @keyframes valueFadeLeft {
      from {
        opacity: 0;
        transform: translateX(6px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    @keyframes valueFadeRight {
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
    .bar-value-left {
      opacity: 0;
      animation: valueFadeLeft 1200ms ease-out both;
    }
    .bar-value-right {
      opacity: 0;
      animation: valueFadeRight 1200ms ease-out both;
    }
  </style>
${leftGridLines}
${rightGridLines}
  <line x1="${starAxisX}" y1="0" x2="${starAxisX}" y2="${rowHeight}" stroke="${t.axisLine}" stroke-width="1"/>
  <line x1="${prAxisX}" y1="0" x2="${prAxisX}" y2="${rowHeight}" stroke="${t.axisLine}" stroke-width="1"/>
${stripe}  <g transform="translate(${starAxisX}, ${barYOffset})">
    <path class="bar" d="${starBarPath}" fill="url(#starBarGrad-${mode})" style="animation-delay: ${delayMs}ms;"/>
  </g>
  <g transform="translate(${starCountX}, 18.5)">
    <text class="bar-value-left" x="0" y="0" text-anchor="end" font-family="${CHART_MONO}" font-size="11" font-weight="500" style="animation-delay: ${valueDelayMs}ms;"><tspan fill="${t.axisText}">${escapeXml(stars)}</tspan><tspan font-family="${CHART_SANS}" fill="${t.starIcon}" dx="1.5">&#9733;</tspan></text>
  </g>
  <text x="${repoCenterX.toFixed(1)}" y="18.5" text-anchor="middle" font-family="${CHART_SANS}" font-size="12.5">${labelText}</text>
  <g transform="translate(${prAxisX}, ${barYOffset})">
    <path class="bar" d="${prBarPath}" fill="url(#prBarGrad-${mode})" style="animation-delay: ${delayMs}ms;"/>
  </g>
  <g transform="translate(${prCountX}, 18.5)">
    <text class="bar-value-right" x="0" y="0" font-family="${CHART_MONO}" font-size="12" font-weight="600" fill="${t.valueText}" style="animation-delay: ${valueDelayMs}ms;">${count}</text>
  </g>
</svg>
`;
}

function renderAxisSvg(layout, mode) {
  const t = CHART_THEMES[mode];
  const {
    width,
    axisHeight,
    starAreaWidth,
    prAreaWidth,
    starAxisX,
    prAxisX,
    starAxisMax,
    starTicks,
    prAxisMax,
    prTicks,
  } = layout;

  const leftTickLabels = starTicks
    .map((tick) => {
      const xStr = (starAxisX - (tick / starAxisMax) * starAreaWidth).toFixed(2);
      return `  <text x="${xStr}" y="16" text-anchor="middle" font-family="${CHART_MONO}" font-size="11" fill="${t.axisText}">${escapeXml(formatAxisTick(tick))}</text>`;
    })
    .join("\n");

  const rightTickLabels = prTicks
    .map((tick) => {
      const xStr = (prAxisX + (tick / prAxisMax) * prAreaWidth).toFixed(2);
      return `  <text x="${xStr}" y="16" text-anchor="middle" font-family="${CHART_MONO}" font-size="11" fill="${t.axisText}">${escapeXml(formatAxisTick(tick))}</text>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${axisHeight}" viewBox="0 0 ${width} ${axisHeight}" fill="none" role="img" aria-label="Stars and Merged PRs axes">
${leftTickLabels}
  <text x="${(starAxisX - starAreaWidth / 2).toFixed(1)}" y="31" text-anchor="middle" font-family="${CHART_SANS}" font-size="11" fill="${t.axisText}">Stars</text>
${rightTickLabels}
  <text x="${(prAxisX + prAreaWidth / 2).toFixed(1)}" y="31" text-anchor="middle" font-family="${CHART_SANS}" font-size="11" fill="${t.axisText}">Merged PRs</text>
</svg>
`;
}

function computeNiceScale(maxValue, maxTicks = 4) {
  if (maxValue <= 0) {
    return { axisMax: 1, ticks: [0, 1] };
  }
  const rawStep = maxValue / maxTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const multipliers = [1, 2, 2.5, 5, 10];
  const step =
    multipliers
      .map((m) => m * magnitude)
      .find((candidate) => Math.ceil(maxValue / candidate) <= maxTicks) ??
    10 * magnitude;
  const tickCount = Math.max(1, Math.ceil(maxValue / step));
  const axisMax = tickCount * step;
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => index * step);
  return { axisMax, ticks };
}

function formatAxisTick(value) {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (value >= 1000) {
    const k = value / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return String(value);
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
