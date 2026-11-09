import fs from 'node:fs';

const {
  SLACK_WEBHOOK_URL,
  REPOSITORY = 'unknown-repo',
  REF_NAME,
  TARGET_BRANCH,
  COMMIT_SHA = '0000000',
  COMMIT_MESSAGE,
  SERVER_URL = 'https://github.com',
  COMMIT_URL,
  JOB_STATUS,
  ACTOR,
  RUN_URL
} = process.env;

if (!SLACK_WEBHOOK_URL) {
  console.warn('[notify-slack] SLACK_WEBHOOK_URL is not set. Skipping Slack notification.');
  process.exit(0);
}

const normalizedStatus = (JOB_STATUS || 'success').toLowerCase();
const isJobSuccess = normalizedStatus === 'success';
const isCancelled = ['cancelled', 'canceled', 'aborted'].includes(normalizedStatus);

// Inspect if semantic-release published a release
let releaseInfo = null;
const statusFilePath = '.release-status.json';

if (fs.existsSync(statusFilePath)) {
  try {
    const raw = fs.readFileSync(statusFilePath, 'utf8');
    releaseInfo = JSON.parse(raw);
  } catch (err) {
    console.warn('[notify-slack] Could not parse .release-status.json:', err.message);
  }
}

const hasPublishedRelease = Boolean(releaseInfo && releaseInfo.published && releaseInfo.version);

let statusConfig;

if (!isJobSuccess) {
  if (isCancelled) {
    statusConfig = {
      emoji: ':warning:',
      title: 'Release Workflow Cancelled',
      color: '#ECB22E',
      note: 'The workflow run was cancelled before completion.'
    };
  } else {
    statusConfig = {
      emoji: ':red_circle:',
      title: 'Release Workflow Failed',
      color: '#E01E5A',
      note: 'The workflow execution encountered errors. Check workflow logs for details.'
    };
  }
} else if (hasPublishedRelease) {
  statusConfig = {
    emoji: ':rocket:',
    title: `Release v${releaseInfo.version} Published`,
    color: '#2EB67D',
    note: `Successfully published version *v${releaseInfo.version}* (${releaseInfo.gitTag || `v${releaseInfo.version}`})`
  };
} else {
  statusConfig = {
    emoji: ':heavy_check_mark:',
    title: 'CI Passed (No Release Triggered)',
    color: '#439FE0',
    note: 'Build and tests succeeded. No commits matching release rules (feat, fix, docs(readme)) were found.'
  };
}

const repositoryUrl = `${SERVER_URL}/${REPOSITORY}`;
const commitUrl = COMMIT_URL || `${repositoryUrl}/commit/${COMMIT_SHA}`;
const effectiveBranch = TARGET_BRANCH || REF_NAME || 'main';

const escapeSlack = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const commitMessage = (COMMIT_MESSAGE || 'No commit message available')
  .split('\n')[0]
  .slice(0, 500)
  .replace(/`/g, "'");

const actionElements = [];

if (RUN_URL) {
  actionElements.push({
    type: 'button',
    text: {
      type: 'plain_text',
      text: 'View Workflow Run'
    },
    url: RUN_URL,
    style: isJobSuccess ? 'primary' : 'danger'
  });
}

if (hasPublishedRelease && releaseInfo.gitTag) {
  actionElements.push({
    type: 'button',
    text: {
      type: 'plain_text',
      text: `View Release (${releaseInfo.gitTag})`
    },
    url: `${repositoryUrl}/releases/tag/${releaseInfo.gitTag}`
  });
} else {
  actionElements.push({
    type: 'button',
    text: {
      type: 'plain_text',
      text: 'View Commit'
    },
    url: commitUrl
  });
}

const sectionLines = [
  `*Repository:* <${repositoryUrl}|${escapeSlack(REPOSITORY)}>`,
  `*Target Branch:* \`${escapeSlack(effectiveBranch)}\``,
  `*Commit:* <${commitUrl}|\`${COMMIT_SHA.slice(0, 7)} — ${escapeSlack(commitMessage)}\`>`,
  `*Triggered by:* ${escapeSlack(ACTOR || 'CI System')}`
];

if (statusConfig.note) {
  sectionLines.push(`*Status Note:* ${statusConfig.note}`);
}

const payload = {
  text: `${statusConfig.emoji} ${statusConfig.title}: ${REPOSITORY} (${effectiveBranch})`,
  attachments: [
    {
      color: statusConfig.color,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${statusConfig.emoji} ${statusConfig.title}`,
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: sectionLines.join('\n')
          }
        },
        ...(actionElements.length > 0
          ? [
              {
                type: 'actions',
                elements: actionElements
              }
            ]
          : [])
      ]
    }
  ]
};

try {
  const response = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[notify-slack] Slack API returned HTTP ${response.status}: ${errorText}`);
    process.exitCode = 1;
  } else {
    console.log(`[notify-slack] Notification sent successfully (${statusConfig.title}).`);
  }
} catch (error) {
  console.error('[notify-slack] Failed to deliver Slack message:', error.message);
  // Do not fail CI if Slack notification fails due to network/webhook issues
  process.exitCode = 0;
}
