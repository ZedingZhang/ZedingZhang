import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

const username = process.env.GH_USERNAME;
const token = process.env.GITHUB_TOKEN;

if (!username) throw new Error("GH_USERNAME is required");
if (!token) throw new Error("GITHUB_TOKEN is required");

const CHART_SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const CHART_MONO =
  "ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, monospace";
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const ACTIVITY_THEMES = {
  light: {
    commits: "#3D6E9E",
    prs: "#699E96",
    issues: "#C48374",
    reviews: "#8D7EA8",
    other: "#CFD7DF",
    titleText: "#1F2328",
    valueText: "#57606A",
    axisText: "#57606A",
    axisLine: "#D0D7DE",
    gridLine: "#D0D7DE",
    gridOpacity: "0.6",
  },
  dark: {
    commits: "#4882BD",
    prs: "#6BA69D",
    issues: "#CB8B7C",
    reviews: "#9C8EC0",
    other: "#48515C",
    titleText: "#E6EDF3",
    valueText: "#8B949E",
    axisText: "#8B949E",
    axisLine: "#30363D",
    gridLine: "#30363D",
    gridOpacity: "0.7",
  },
};

const readmePath = "README.md";
const startMarker = "<!--CONTRIBUTION_ACTIVITY:start-->";
const endMarker = "<!--CONTRIBUTION_ACTIVITY:end-->";
const chartDir = "assets/contribution-activity";

const readme = await readFile(readmePath, "utf8");
const start = readme.indexOf(startMarker);
const end = readme.indexOf(endMarker);

if (start === -1 || end === -1 || end < start) {
  throw new Error(
    "Contribution Activity markers are missing or out of order in README.md",
  );
}

const days = await fetchDailyContributions(31);

await rm(chartDir, { recursive: true, force: true });
await mkdir(chartDir, { recursive: true });

await Promise.all(
  ["light", "dark"].map((mode) =>
    writeFile(
      `${chartDir}/activity-${mode}.svg`,
      renderActivitySvg(days, mode),
      "utf8",
    ),
  ),
);

const generated = renderActivityBlock();
const updated =
  readme.slice(0, start) + generated + readme.slice(end + endMarker.length);

if (updated !== readme) {
  await writeFile(readmePath, updated, "utf8");
}

async function fetchDailyContributions(daysCount = 31) {
  const now = new Date();
  const endUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const dates = Array.from({ length: daysCount }, (_, index) => {
    const ms = endUtc - (daysCount - 1 - index) * 86_400_000;
    return new Date(ms).toISOString().slice(0, 10);
  });

  const aliasedFields = dates
    .map(
      (date, index) => `    d${index}: contributionsCollection(from: "${date}T00:00:00Z", to: "${date}T23:59:59Z") {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
      contributionCalendar {
        totalContributions
      }
    }`,
    )
    .join("\n");

  const query = `query DailyContributionBreakdown($login: String!) {\n  user(login: $login) {\n${aliasedFields}\n  }\n}`;

  const result = await postGraphqlWithRetry(query, { login: username });
  const user = result.data?.user;
  if (!user) throw new Error(`GitHub user ${username} was not found`);

  return dates.map((date, index) => {
    const node = user[`d${index}`] ?? {};
    const commits = node.totalCommitContributions ?? 0;
    const prs = node.totalPullRequestContributions ?? 0;
    const issues = node.totalIssueContributions ?? 0;
    const reviews = node.totalPullRequestReviewContributions ?? 0;
    const sum4 = commits + prs + issues + reviews;
    const cal = node.contributionCalendar?.totalContributions ?? 0;
    const total = Math.max(cal, sum4);
    const other = Math.max(0, total - sum4);

    return { date, commits, prs, issues, reviews, other, total };
  });
}

async function postGraphqlWithRetry(query, variables, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "profile-contributions-workflow",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ query, variables }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status >= 500 && attempt < retries) continue;
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

      return result;
    } catch (error) {
      if (attempt < retries) continue;
      throw error;
    }
  }
}

function renderActivityBlock() {
  return [
    startMarker,
    "",
    `<p align="center">`,
    `  <a href="https://github.com/${escapeHtml(username)}">`,
    `    <picture>`,
    `      <source`,
    `        media="(prefers-color-scheme: dark)"`,
    `        srcset="./${chartDir}/activity-dark.svg"`,
    `      />`,
    `      <source`,
    `        media="(prefers-color-scheme: light)"`,
    `        srcset="./${chartDir}/activity-light.svg"`,
    `      />`,
    `      <img`,
    `        alt="Zeding Zhang's GitHub contribution activity stacked bar chart"`,
    `        src="./${chartDir}/activity-light.svg"`,
    `        width="100%"`,
    `      />`,
    `    </picture>`,
    `  </a>`,
    `</p>`,
    "",
    endMarker,
  ].join("\n");
}

function renderActivitySvg(days, mode) {
  const t = ACTIVITY_THEMES[mode];
  const width = 880;
  const height = 280;
  const plotLeft = 44;
  const plotRight = 864;
  const plotWidth = plotRight - plotLeft;
  const plotTop = 54;
  const plotBottom = 228;
  const plotHeight = plotBottom - plotTop;

  const totals = days.reduce(
    (acc, day) => {
      acc.commits += day.commits;
      acc.prs += day.prs;
      acc.issues += day.issues;
      acc.reviews += day.reviews;
      acc.other += day.other;
      acc.total += day.total;
      return acc;
    },
    { commits: 0, prs: 0, issues: 0, reviews: 0, other: 0, total: 0 },
  );

  const maxTotal = Math.max(0, ...days.map((day) => day.total));
  const { axisMax, ticks } = computeNiceScale(maxTotal, 6);

  const legendCandidates = [
    { key: "commits", label: "Commits", value: totals.commits, color: t.commits },
    { key: "prs", label: "PRs", value: totals.prs, color: t.prs },
    { key: "issues", label: "Issues", value: totals.issues, color: t.issues },
    { key: "reviews", label: "Reviews", value: totals.reviews, color: t.reviews },
    ...(totals.other > 0
      ? [{ key: "other", label: "Other", value: totals.other, color: t.other }]
      : []),
  ].map((item) => {
    const valStr = String(item.value);
    const labelW = item.label.length * 7.0;
    const countOffsetX = 9 + 6 + labelW + 5;
    const itemWidth = countOffsetX + valStr.length * 6.8 + 4;
    return { ...item, valStr, countOffsetX, itemWidth };
  });

  const legendGap = 16;
  const totalLegendWidth =
    legendCandidates.reduce((sum, item) => sum + item.itemWidth, 0) +
    Math.max(0, legendCandidates.length - 1) * legendGap;
  let legendX = plotRight - totalLegendWidth;

  const legendSvg = legendCandidates
    .map((item) => {
      const x = legendX;
      legendX += item.itemWidth + legendGap;
      return [
        `  <rect x="${x.toFixed(1)}" y="15.5" width="9" height="9" rx="2" fill="${item.color}"/>`,
        `  <text x="${(x + 15).toFixed(1)}" y="23.5" font-family="${CHART_SANS}" font-size="11.5" font-weight="500" fill="${t.titleText}">${escapeXml(item.label)}</text>`,
        `  <text x="${(x + item.countOffsetX).toFixed(1)}" y="23.5" font-family="${CHART_MONO}" font-size="11" fill="${t.axisText}">${escapeXml(item.valStr)}</text>`,
      ].join("\n");
    })
    .join("\n");

  const gridAndTicksSvg = ticks
    .map((tick) => {
      const yNum = plotBottom - (tick / axisMax) * plotHeight;
      const yStr = yNum.toFixed(2);
      const labelY = (yNum + 3.5).toFixed(2);
      const lineSvg =
        tick === 0
          ? `  <line x1="${plotLeft}" y1="${plotBottom}" x2="${plotRight}" y2="${plotBottom}" stroke="${t.axisLine}" stroke-width="1"/>`
          : `  <line x1="${plotLeft}" y1="${yStr}" x2="${plotRight}" y2="${yStr}" stroke="${t.gridLine}" stroke-width="1" stroke-dasharray="3.5 3.5" stroke-opacity="${t.gridOpacity}"/>`;
      const tickLabel = `  <text x="36" y="${labelY}" text-anchor="end" font-family="${CHART_MONO}" font-size="11" fill="${t.axisText}">${tick}</text>`;
      return `${lineSvg}\n${tickLabel}`;
    })
    .join("\n");

  const slotWidth = plotWidth / days.length;
  const barWidth = 16;
  const clipDefs = [];
  const barsSvg = [];
  const xLabelsSvg = [];

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const slotCenterX = plotLeft + i * slotWidth + slotWidth / 2;
    const dayNum = Number(day.date.slice(8, 10));

    xLabelsSvg.push(
      `  <text x="${slotCenterX.toFixed(1)}" y="246" text-anchor="middle" font-family="${CHART_MONO}" font-size="10.5" fill="${t.axisText}">${dayNum}</text>`,
    );

    const isMonthStart =
      i > 0 && day.date.slice(0, 7) !== days[i - 1].date.slice(0, 7);
    const nextStartsNewMonth =
      i === 0 && days[1] && days[1].date.slice(0, 7) !== day.date.slice(0, 7);
    if (isMonthStart || (i === 0 && !nextStartsNewMonth)) {
      const monthIndex = Number(day.date.slice(5, 7)) - 1;
      xLabelsSvg.push(
        `  <text x="${slotCenterX.toFixed(1)}" y="264" text-anchor="middle" font-family="${CHART_SANS}" font-size="11" font-weight="500" fill="${t.axisText}">${MONTH_NAMES[monthIndex]}</text>`,
      );
    }

    if (day.total <= 0) continue;

    const barX = slotCenterX - barWidth / 2;
    const barH = Math.max(3, (day.total / axisMax) * plotHeight);
    const barTop = plotBottom - barH;
    const r = Math.min(3.5, barH / 2, barWidth / 2);
    const clipId = `bar-clip-${mode}-${i}`;

    const clipPathD = [
      `M ${barX.toFixed(2)} ${plotBottom}`,
      `V ${(barTop + r).toFixed(2)}`,
      `Q ${barX.toFixed(2)} ${barTop.toFixed(2)} ${(barX + r).toFixed(2)} ${barTop.toFixed(2)}`,
      `H ${(barX + barWidth - r).toFixed(2)}`,
      `Q ${(barX + barWidth).toFixed(2)} ${barTop.toFixed(2)} ${(barX + barWidth).toFixed(2)} ${(barTop + r).toFixed(2)}`,
      `V ${plotBottom}`,
      "Z",
    ].join(" ");

    clipDefs.push(`    <clipPath id="${clipId}"><path d="${clipPathD}"/></clipPath>`);

    const segments = [
      { key: "commits", value: day.commits, color: t.commits },
      { key: "prs", value: day.prs, color: t.prs },
      { key: "issues", value: day.issues, color: t.issues },
      { key: "reviews", value: day.reviews, color: t.reviews },
      { key: "other", value: day.other, color: t.other },
    ].filter((segment) => segment.value > 0);

    let cumulative = 0;
    const rects = segments
      .map((segment, segIndex) => {
        const prev = cumulative;
        cumulative += segment.value;
        const yBottom = plotBottom - (prev / day.total) * barH;
        const yTop = plotBottom - (cumulative / day.total) * barH;
        const isTop = segIndex === segments.length - 1;
        const bleed = isTop ? 0 : 0.3;
        const rectY = yTop - bleed;
        const rectH = yBottom - rectY;
        return `      <rect x="${barX.toFixed(2)}" y="${rectY.toFixed(2)}" width="${barWidth}" height="${rectH.toFixed(2)}" fill="${segment.color}"/>`;
      })
      .join("\n");

    const delayMs = i * 35;
    const totalDelayMs = delayMs + 950;

    barsSvg.push(
      `  <g class="bar-col" style="animation-delay: ${delayMs}ms;">\n    <g clip-path="url(#${clipId})">\n${rects}\n    </g>\n  </g>`,
    );
    barsSvg.push(
      `  <text class="bar-total" x="${slotCenterX.toFixed(1)}" y="${(barTop - 5).toFixed(1)}" text-anchor="middle" font-family="${CHART_MONO}" font-size="10" font-weight="500" fill="${t.valueText}" style="animation-delay: ${totalDelayMs}ms;">${day.total}</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" role="img" aria-label="${escapeXml(`${totals.total} contributions over the last ${days.length} days across Commits, PRs, Issues, Reviews, and Other`)}">
  <defs>
${clipDefs.join("\n")}
  </defs>
  <style>
    @keyframes barRise {
      from {
        transform: scaleY(0);
      }
      to {
        transform: scaleY(1);
      }
    }
    @keyframes totalFadeUp {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .bar-col {
      transform-origin: 0 ${plotBottom}px;
      transform: scaleY(0);
      animation: barRise 1100ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .bar-total {
      opacity: 0;
      animation: totalFadeUp 700ms ease-out both;
    }
  </style>
  <text x="${plotLeft}" y="24" font-family="${CHART_SANS}" font-size="12" font-weight="500" fill="${t.axisText}">${totals.total} contributions · last ${days.length} days</text>
${legendSvg}
${gridAndTicksSvg}
${barsSvg.join("\n")}
${xLabelsSvg.join("\n")}
</svg>
`;
}

function computeNiceScale(maxValue, maxTicks = 6) {
  if (maxValue <= 0) {
    return { axisMax: 4, ticks: [0, 1, 2, 3, 4] };
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
