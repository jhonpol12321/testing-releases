
pipeline {
    agent {
        docker {
            image 'node:22-bookworm'
        }
    }

    options {
        disableConcurrentBuilds(abortPrevious: false)
        timestamps()
    }

    environment {
        GITHUB_TOKEN = credentials('github-token')
        SLACK_WEBHOOK_URL = credentials('slack-webhook-url')
        REPOSITORY = 'jhonpol12321/testing-releases'
        SERVER_URL = 'https://github.com'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm

                sh '''
                    git fetch --tags --force
                    git fetch --unshallow 2>/dev/null || true
                '''

                script {
                    env.RELEASE_BRANCH =
                        env.BRANCH_NAME ?:
                        env.GIT_BRANCH?.replaceFirst(/^origin\\//, '')

                    env.RELEASE_COMMIT_MESSAGE = sh(
                        script: 'git log -1 --pretty=%B',
                        returnStdout: true
                    ).trim()

                    env.COMMIT_SHA = sh(
                        script: 'git rev-parse HEAD',
                        returnStdout: true
                    ).trim()
                }
            }
        }

        stage('Release') {
            when {
                expression {
                    return (
                        env.RELEASE_BRANCH in [
                            'main', 'next', 'beta', '1.x'
                        ] &&
                        !env.RELEASE_COMMIT_MESSAGE.contains('skip ci')
                    )
                }
            }

            steps {
                sh '''
                    corepack enable
                    pnpm install --frozen-lockfile
                    pnpm test
                    pnpm exec semantic-release
                '''
            }
        }
    }

    post {
        always {
            script {
                def branch = env.RELEASE_BRANCH ?: ''

                def shouldNotify =
                    branch in ['main', 'next', 'beta', '1.x'] &&
                    !(env.RELEASE_COMMIT_MESSAGE ?: '').contains('skip ci')

                if (shouldNotify) {
                    withEnv([
                        "REF_NAME=${branch}",
                        "TARGET_BRANCH=${branch}",
                        "COMMIT_MESSAGE=${env.RELEASE_COMMIT_MESSAGE ?: 'No commit message available'}",
                        "ACTOR=${env.BUILD_USER ?: 'Jenkins'}",
                        "JOB_STATUS=${currentBuild.currentResult?.toLowerCase() ?: 'success'}",
                        "RUN_URL=${env.BUILD_URL}"
                    ]) {
                        sh 'node scripts/notify-slack.mjs'
                    }
                }
            }
        }
    }
}
