### `scripts/notify-slack.mjs`

```javascript
const {
  SLACK_WEBHOOK_URL,
  REPOSITORY,
  REF_NAME,
  TARGET_BRANCH,
  COMMIT_SHA,
  COMMIT_MESSAGE,
  SERVER_URL,
  COMMIT_URL,
  JOB_STATUS,
  ACTOR,
  RUN_URL
} = process.env;

const required = {
  SLACK_WEBHOOK_URL,
  REPOSITORY,
  COMMIT_SHA,
  SERVER_URL,
  RUN_URL
};

for (const [key, value] of Object.entries(required)) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const normalizedStatus = (JOB_STATUS || 'failed').toLowerCase();

const success = normalizedStatus === 'success';

const cancelled = [
  'cancelled',
  'canceled',
  'aborted'
].includes(normalizedStatus);

const status = success
  ? {
      emoji: ':rocket:',
      title: 'Release Successfully Published',
      color: '#2EB67D'
    }
  : cancelled
    ? {
        emoji: ':warning:',
        title: 'Release Cancelled',
        color: '#ECB22E'
      }
    : {
        emoji: ':red_circle:',
        title: 'Release Failed',
        color: '#E01E5A'
      };

const repositoryUrl = `${SERVER_URL}/${REPOSITORY}`;
const commitUrl =
  COMMIT_URL ||
  `${repositoryUrl}/commit/${COMMIT_SHA}`;

const escapeSlack = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const commitMessage = (COMMIT_MESSAGE || 'No commit message available')
  .split('\n')[0]
  .slice(0, 500)
  .replace(/`/g, "'");

const payload = {
  text: `${status.emoji} ${status.title}: ${REPOSITORY} (${TARGET_BRANCH || REF_NAME})`,
  attachments: [
    {
      color: status.color,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${status.emoji} ${status.title}`,
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: [
              `*Repository:* <${repositoryUrl}|${escapeSlack(REPOSITORY)}>`,
              `*Target Branch:* \`${escapeSlack(TARGET_BRANCH || REF_NAME || 'unknown')}\``,
              `*Triggered Ref:* \`${escapeSlack(REF_NAME || 'unknown')}\``,
              `*Commit:* <${commitUrl}|\`${COMMIT_SHA.slice(0, 7)} — ${escapeSlack(commitMessage)}\`>`,
              `*Triggered by:* ${escapeSlack(ACTOR || 'Unknown')}`
            ].join('\n')
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Pipeline'
              },
              url: RUN_URL,
              style: success ? 'primary' : 'danger'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Commit'
              },
              url: commitUrl
            }
          ]
        }
      ]
    }
  ]
};

const response = await fetch(SLACK_WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(10000)
});

if (!response.ok) {
  throw new Error(
    `Slack notification failed: ${response.status} ${await response.text()}`
  );
}
```

### Variables esperadas

| Variable | Descripción |
|---|---|
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook |
| `REPOSITORY` | `grupo/proyecto` |
| `SERVER_URL` | URL base del proveedor Git |
| `COMMIT_URL` | URL completa del commit |
| `COMMIT_SHA` | SHA completo |
| `COMMIT_MESSAGE` | Mensaje del commit |
| `REF_NAME` | Rama ejecutada |
| `TARGET_BRANCH` | Rama de release |
| `JOB_STATUS` | `success`, `failed`, `cancelled` |
| `ACTOR` | Usuario o proveedor que ejecutó |
| `RUN_URL` | URL del pipeline |

