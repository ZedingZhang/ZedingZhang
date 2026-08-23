import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DAYS = 31;
const WIDTH = 900;
const HEIGHT = 300;
const PADDING = { top: 24, right: 24, bottom: 46, left: 54 };
const THEMES = {
    light: {
        text: '#57606A',
        grid: '#D0D7DE',
        line: '#0969DA',
        point: '#0969DA',
        area: '#54AEFF',
    },
    dark: {
        text: '#8B949E',
        grid: '#30363D',
        line: '#58A6FF',
        point: '#58A6FF',
        area: '#1F6FEB',
    },
};

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const username = process.env.GITHUB_USERNAME || 'ZedingZhang';

if (!token) {
    throw new Error('GH_TOKEN is required to query the GitHub GraphQL API.');
}

const toUtcDate = (date) => date.toISOString().slice(0, 10);

const addUtcDays = (date, days) => {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
};

const escapeXml = (value) =>
    String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');

const round = (value) => Number(value.toFixed(2));

const today = new Date();
const endDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
);
const startDate = addUtcDays(endDate, -(DAYS - 1));
const queryEndDate = addUtcDays(endDate, 1);

const query = `
  query ContributionActivity($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          weeks {
            contributionDays {
              contributionCount
              date
            }
          }
        }
      }
    }
  }
`;

const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ZedingZhang-profile-activity-graph',
    },
    body: JSON.stringify({
        query,
        variables: {
            login: username,
            from: `${toUtcDate(startDate)}T00:00:00Z`,
            to: `${toUtcDate(queryEndDate)}T00:00:00Z`,
        },
    }),
});

if (!response.ok) {
    throw new Error(`GitHub GraphQL request failed with HTTP ${response.status}.`);
}

const payload = await response.json();

if (payload.errors?.length) {
    const messages = payload.errors.map(({ message }) => message).join('; ');
    throw new Error(`GitHub GraphQL returned errors: ${messages}`);
}

const weeks = payload.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
if (!weeks) {
    throw new Error(`GitHub user ${username} was not found or returned no contribution data.`);
}

const contributionsByDate = new Map(
    weeks
        .flatMap(({ contributionDays }) => contributionDays)
        .map(({ date, contributionCount }) => [date, contributionCount]),
);

const contributions = Array.from({ length: DAYS }, (_, index) => {
    const date = toUtcDate(addUtcDays(startDate, index));
    return {
        date,
        count: contributionsByDate.get(date) ?? 0,
    };
});

const formatDateLabel = (date) =>
    new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00Z`));

const renderSvg = (themeName) => {
    const theme = THEMES[themeName];
    const plotWidth = WIDTH - PADDING.left - PADDING.right;
    const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
    const baseline = PADDING.top + plotHeight;
    const maximum = Math.max(1, ...contributions.map(({ count }) => count));
    const yMaximum = maximum <= 4 ? 4 : Math.ceil(maximum / 4) * 4;

    const xFor = (index) =>
        round(PADDING.left + (plotWidth * index) / (contributions.length - 1));
    const yFor = (count) => round(baseline - (plotHeight * count) / yMaximum);

    const linePath = contributions
        .map(({ count }, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(count)}`)
        .join(' ');
    const areaPath = `M ${xFor(0)} ${baseline} ${linePath.replace(/^M /, 'L ')} L ${xFor(
        contributions.length - 1,
    )} ${baseline} Z`;

    const horizontalGrid = Array.from({ length: 5 }, (_, index) => {
        const y = round(PADDING.top + (plotHeight * index) / 4);
        const value = Math.round(yMaximum - (yMaximum * index) / 4);
        return `
        <line x1="${PADDING.left}" y1="${y}" x2="${WIDTH - PADDING.right}" y2="${y}"
              stroke="${theme.grid}" stroke-width="1" stroke-dasharray="4 5" opacity="0.7" />
        <text x="${PADDING.left - 12}" y="${y + 4}" text-anchor="end"
              fill="${theme.text}" font-size="12">${value}</text>`;
    }).join('');

    const xTickIndexes = [0, 7, 15, 23, contributions.length - 1];
    const xLabels = xTickIndexes
        .map((index) => {
            const { date } = contributions[index];
            return `<text x="${xFor(index)}" y="${HEIGHT - 16}" text-anchor="middle"
                  fill="${theme.text}" font-size="12">${escapeXml(
                      formatDateLabel(date),
                  )}</text>`;
        })
        .join('\n        ');

    const points = contributions
        .map(
            ({ date, count }, index) => `
        <circle cx="${xFor(index)}" cy="${yFor(count)}" r="3.2"
                fill="${theme.point}" stroke="${theme.point}" stroke-width="1">
            <title>${escapeXml(date)}: ${count} contribution${count === 1 ? '' : 's'}</title>
        </circle>`,
        )
        .join('');

    const accessibleTitle = `${username} GitHub contribution activity for the last ${DAYS} days`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}"
     viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="activity-title activity-desc">
    <title id="activity-title">${escapeXml(accessibleTitle)}</title>
    <desc id="activity-desc">A line graph of daily public GitHub contribution counts from ${toUtcDate(
        startDate,
    )} through ${toUtcDate(endDate)}.</desc>
    <defs>
        <linearGradient id="activity-area-${themeName}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${theme.area}" stop-opacity="0.45" />
            <stop offset="100%" stop-color="${theme.area}" stop-opacity="0.04" />
        </linearGradient>
    </defs>
    <g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">
        ${horizontalGrid}
        <path d="${areaPath}" fill="url(#activity-area-${themeName})" />
        <path d="${linePath}" fill="none" stroke="${theme.line}" stroke-width="3"
              stroke-linecap="round" stroke-linejoin="round" />
        ${points}
        ${xLabels}
    </g>
</svg>
`;
};

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = resolve(scriptDirectory, '../../assets');
await mkdir(outputDirectory, { recursive: true });

await Promise.all(
    Object.keys(THEMES).map((themeName) =>
        writeFile(
            resolve(outputDirectory, `github-activity-${themeName}.svg`),
            renderSvg(themeName),
            'utf8',
        ),
    ),
);

process.stdout.write(
    `Generated ${Object.keys(THEMES).length} activity graphs for ${username} (${toUtcDate(
        startDate,
    )} to ${toUtcDate(endDate)}).\n`,
);
