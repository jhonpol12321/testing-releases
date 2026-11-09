const fs = require('fs');

/**
 * Custom semantic-release plugin to record release execution details.
 * When a release is published, the 'success' step writes .release-status.json
 * and sets GitHub Actions step outputs if running in GHA.
 */
module.exports = {
  success: (pluginConfig, context) => {
    const { nextRelease, logger } = context;
    if (!nextRelease) return;

    if (logger && logger.log) {
      logger.log(`Recording published release status for version ${nextRelease.version}`);
    }

    const payload = {
      published: true,
      version: nextRelease.version,
      gitTag: nextRelease.gitTag,
      type: nextRelease.type,
      channel: nextRelease.channel,
      notes: nextRelease.notes || ''
    };

    fs.writeFileSync('.release-status.json', JSON.stringify(payload, null, 2), 'utf8');

    if (process.env.GITHUB_OUTPUT) {
      try {
        fs.appendFileSync(
          process.env.GITHUB_OUTPUT,
          `new_release_published=true\nnew_release_version=${nextRelease.version}\nnew_release_git_tag=${nextRelease.gitTag}\n`
        );
      } catch (_) {}
    }
  }
};
