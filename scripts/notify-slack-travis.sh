#!/usr/bin/env bash

set -euo pipefail

export JOB_STATUS="${1:?Missing job status}"

export REPOSITORY="${TRAVIS_REPO_SLUG}"
export REF_NAME="${TRAVIS_BRANCH}"
export TARGET_BRANCH="${TRAVIS_BRANCH}"
export COMMIT_SHA="${TRAVIS_COMMIT}"
export COMMIT_MESSAGE="${TRAVIS_COMMIT_MESSAGE}"
export SERVER_URL="https://github.com"
export ACTOR="Travis CI"
export RUN_URL="${TRAVIS_BUILD_WEB_URL}"

node scripts/notify-slack.mjs
