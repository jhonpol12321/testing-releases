const fs = require('node:fs');

const isGitLabCI = process.env.GITLAB_CI === 'true';
const hasOpenApi = fs.existsSync('openapi.yaml');

// Catálogo de archivos estándar donde suele persistirse la versión del proyecto.
// Solo se activan y agregan a Git si el archivo existe físicamente en el repositorio.
const candidateReplacements = [
  // 1. Documentación y Badges
  {
    file: 'README.md',
    replacements: [
      {
        from: /Version:\s*[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?/gi,
        to: 'Version: ${nextRelease.version}'
      },
      {
        from: /badge\/version-[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?/gi,
        to: 'badge/version-${nextRelease.version}'
      }
    ]
  },
  // 2. Archivo de versión plano (ej. VERSION o version.txt)
  {
    file: 'VERSION',
    replacements: [
      {
        from: /^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?/gm,
        to: '${nextRelease.version}'
      }
    ]
  },
  {
    file: 'version.txt',
    replacements: [
      {
        from: /^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?/gm,
        to: '${nextRelease.version}'
      }
    ]
  },
  // 3. Constantes de versión en código fuente
  {
    file: 'src/version.ts',
    replacements: [
      {
        from: /(VERSION\s*=\s*['"])[^'"]+(['"])/g,
        to: '$1${nextRelease.version}$2'
      }
    ]
  },
  {
    file: 'src/version.js',
    replacements: [
      {
        from: /(VERSION\s*=\s*['"])[^'"]+(['"])/g,
        to: '$1${nextRelease.version}$2'
      }
    ]
  },
  {
    file: 'version.json',
    replacements: [
      {
        from: /"version"\s*:\s*"[^"]+"/g,
        to: '"version": "${nextRelease.version}"'
      }
    ]
  },
  // 4. Manifests (PWA / Web Extensions / Apps)
  {
    file: 'manifest.json',
    replacements: [
      {
        from: /"version"\s*:\s*"[^"]+"/g,
        to: '"version": "${nextRelease.version}"'
      }
    ]
  },
  {
    file: 'public/manifest.json',
    replacements: [
      {
        from: /"version"\s*:\s*"[^"]+"/g,
        to: '"version": "${nextRelease.version}"'
      }
    ]
  },
  // 5. Calidad y SonarQube / SonarCloud
  {
    file: 'sonar-project.properties',
    replacements: [
      {
        from: /sonar\.projectVersion\s*=\s*.*/g,
        to: 'sonar.projectVersion=${nextRelease.version}'
      }
    ]
  },
  // 6. Contenedores (Docker / Podman)
  {
    file: 'Dockerfile',
    replacements: [
      {
        from: /(LABEL\s+version\s*=\s*["'])[^"']+(["'])/gi,
        to: '$1${nextRelease.version}$2'
      },
      {
        from: /(ARG\s+(?:APP_)?VERSION\s*=\s*["']?)[^"'\s]+(["']?)/gi,
        to: '$1${nextRelease.version}$2'
      }
    ]
  },
  {
    file: 'Containerfile',
    replacements: [
      {
        from: /(LABEL\s+version\s*=\s*["'])[^"']+(["'])/gi,
        to: '$1${nextRelease.version}$2'
      },
      {
        from: /(ARG\s+(?:APP_)?VERSION\s*=\s*["']?)[^"'\s]+(["']?)/gi,
        to: '$1${nextRelease.version}$2'
      }
    ]
  },
  // 7. Kubernetes Helm Chart
  {
    file: 'Chart.yaml',
    replacements: [
      {
        from: /^version:\s*.*/gm,
        to: 'version: ${nextRelease.version}'
      },
      {
        from: /^appVersion:\s*["']?[^"'\n\r]+["']?/gm,
        to: 'appVersion: "${nextRelease.version}"'
      }
    ]
  },
  // 8. Mobile (Expo / React Native)
  {
    file: 'app.json',
    replacements: [
      {
        from: /"version"\s*:\s*"[^"]+"/g,
        to: '"version": "${nextRelease.version}"'
      }
    ]
  }
];

// Filtramos únicamente las reglas y archivos que realmente existen en el disco
const activeReplacements = [];
const dynamicAssets = [];

for (const candidate of candidateReplacements) {
  if (fs.existsSync(candidate.file)) {
    for (const rule of candidate.replacements) {
      activeReplacements.push({
        files: [candidate.file],
        from: rule.from,
        to: rule.to
      });
    }
    dynamicAssets.push(candidate.file);
  }
}

// Unificamos los assets de git sin duplicados
const gitAssets = Array.from(new Set([
  "package.json",
  "CHANGELOG.md",
  ...dynamicAssets,
  ...(hasOpenApi ? ["openapi.yaml"] : [])
]));

module.exports = {
  branches: [
    "main",
    {
      name: "next",
      prerelease: true
    },
    {
      name: "beta",
      prerelease: true
    },
    {
      name: "1.x",
      range: "1.x",
      channel: "1.x"
    }
  ],
  tagFormat: "v${version}",
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules: [
          { breaking: true, release: "major" },
          { revert: true, release: "patch" },
          { type: "feat", release: "minor" },
          { type: "fix", release: "patch" },
          { type: "perf", release: "patch" },
          { type: "docs", scope: "README", release: "patch" },
          { type: "docs", release: false },
          { type: "style", release: false },
          { type: "refactor", release: "patch" },
          { type: "test", release: false },
          { type: "build", release: "patch" },
          { type: "ci", release: false },
          { type: "chore", release: false }
        ]
      }
    ],
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "conventionalcommits"
      }
    ],
    [
      "@semantic-release/changelog",
      {
        changelogFile: "CHANGELOG.md"
      }
    ],
    [
      "@semantic-release/npm",
      {
        npmPublish: false
      }
    ],
    ...(activeReplacements.length > 0
      ? [
          [
            "semantic-release-replace-plugin",
            {
              replacements: activeReplacements
            }
          ]
        ]
      : []
    ),
    ...(hasOpenApi
      ? [
          [
            "semantic-release-openapi",
            {
              apiSpecFiles: ["openapi.yaml"]
            }
          ]
        ]
      : []
    ),
    ...(isGitLabCI
      ? [
          [
            '@semantic-release/gitlab',
            { useJobToken: true }
          ]
        ]
      : [
          [
            '@semantic-release/github',
            {
              successComment: false,
              failComment: false
            }
          ]
        ]
    ),
    [
      "@semantic-release/git",
      {
        assets: gitAssets,
        message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
      }
    ],
    "semantic-release-major-tag"
  ]
};
