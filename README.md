# CI/CD + Semantic Release — GitLab

Version: 1.3.1

## Configuración compartida

Todos los proveedores deben:
- Ejecutar `pnpm install --frozen-lockfile`.
- Ejecutar `pnpm test`.
- Ejecutar `pnpm exec semantic-release`.
- Tener acceso al repositorio GitLab y a sus tags.
- Definir `GL_TOKEN` y `SLACK_WEBHOOK_URL`.

El repositorio debe tener configurado su remoto GitLab y, preferentemente, el campo `repository` de `package.json`:

```json
{
  "repository": {
    "type": "git",
    "url": "https://gitlab.com/GROUP/PROJECT.git"
  }
}
```

## 1. GitLab CI

Archivo: `.gitlab-ci.yml`

1. Subir `.gitlab-ci.yml`, `.releaserc.json` y `scripts/notify-slack.mjs`.
2. Ir a **Settings → CI/CD → Variables**.
3. Crear:
   - `GL_TOKEN`: GitLab Personal Access Token con scope `api`.
   - `SLACK_WEBHOOK_URL`: Slack Incoming Webhook.
4. Habilitar runners para el proyecto.
5. Ejecutar un pipeline desde **Build → Pipelines**.

GitLab ejecutará automáticamente los pipelines en `main`, `next`, `beta` y `1.x`.

## 2. CircleCI

Archivo: `.circleci/config.yml`

1. Ingresar a CircleCI.
2. Seleccionar **Create Project**.
3. Conectar la cuenta GitLab y seleccionar el repositorio.
4. Agregar las variables de entorno:
   - `GL_TOKEN`
   - `SLACK_WEBHOOK_URL`
5. Subir el archivo de configuración.
6. Ejecutar un pipeline desde CircleCI.

**Importante:** adaptar las variables del notificador para usar GitLab:

```bash
export SERVER_URL="https://gitlab.com"
export REPOSITORY="${CIRCLE_PROJECT_USERNAME}/${CIRCLE_PROJECT_REPONAME}"
export COMMIT_URL="${SERVER_URL}/${REPOSITORY}/-/commit/${CIRCLE_SHA1}"
```

Documentación: https://circleci.com/docs/

## 3. Travis CI

Archivo: `.travis.yml`

1. Ingresar a https://app.travis-ci.com/.
2. Autorizar la integración con GitLab.
3. Activar el repositorio.
4. Agregar las variables:
   - `GL_TOKEN`
   - `SLACK_WEBHOOK_URL`
5. Subir `.travis.yml`.
6. Ejecutar el pipeline desde Travis.

Adaptar las variables del notificador:

```bash
export SERVER_URL="https://gitlab.com"
export REPOSITORY="${TRAVIS_REPO_SLUG}"
export COMMIT_URL="${SERVER_URL}/${REPOSITORY}/-/commit/${TRAVIS_COMMIT}"
```

Documentación: https://docs.travis-ci.com/

## 4. Jenkins

Archivo: `Jenkinsfile`

1. Instalar los plugins:
   - Pipeline
   - Docker Pipeline (si se usa el agente Docker)
   - Git
   - GitLab Branch Source (recomendado para Multibranch Pipeline)
2. Crear credenciales de tipo **Secret Text**:
   - ID: `gitlab-token` → valor de `GL_TOKEN`.
   - ID: `slack-webhook-url` → webhook de Slack.
3. Configurar el repositorio GitLab como SCM.
4. Crear un Multibranch Pipeline.
5. Configurar el descubrimiento de ramas.
6. Agregar un webhook de GitLab para notificar los pushes a Jenkins.

En el `Jenkinsfile`, utilizar `GL_TOKEN` en lugar de `GITHUB_TOKEN` y configurar:

```groovy
environment {
    GL_TOKEN = credentials('gitlab-token')
    SLACK_WEBHOOK_URL = credentials('slack-webhook-url')
    SERVER_URL = 'https://gitlab.com'
    REPOSITORY = 'GROUP/PROJECT'
}
```

La URL del commit debe ser:

```groovy
COMMIT_URL = "${SERVER_URL}/${REPOSITORY}/-/commit/${COMMIT_SHA}"
```

## 5. GitHub Actions

Archivo: `.github/workflows/release.yml`

GitHub Actions no recibe automáticamente los eventos push de un repositorio GitLab.

Para utilizarlo como proveedor externo:
1. Mantener el repositorio sincronizado con un mirror en GitHub.
2. Configurar los eventos del mirror para disparar el workflow.
3. Guardar `GL_TOKEN` y `SLACK_WEBHOOK_URL` como GitHub Actions Secrets.
4. Utilizar `@semantic-release/gitlab` en `.releaserc.json`.

Si GitLab es el repositorio principal, es preferible utilizar GitLab CI directamente.

## Catálogo de archivos estándar contemplados

El pipeline de Semantic Release (`release.config.cjs`) incluye detección dinámica mediante `semantic-release-replace-plugin`. Si cualquiera de estos archivos está presente en el repositorio, se actualizará su versión automáticamente y se incluirá en el commit de release:

| Categoría | Archivo estándar | Patrón que actualiza |
| :--- | :--- | :--- |
| **Docs y Badges** | `README.md` | `Version: x.y.z` y badges `badge/version-x.y.z` |
| **Versión plana** | `VERSION` / `version.txt` | El contenido de la versión en texto plano |
| **Código fuente** | `src/version.ts` / `src/version.js` | Constantes `VERSION = 'x.y.z'` |
| **Metadatos JSON** | `version.json` | `"version": "x.y.z"` |
| **Manifests web/PWA/ext** | `manifest.json` / `public/manifest.json` | `"version": "x.y.z"` |
| **Calidad / Sonar** | `sonar-project.properties` | `sonar.projectVersion = x.y.z` |
| **Contenedores** | `Dockerfile` / `Containerfile` | `LABEL version="x.y.z"` y `ARG APP_VERSION=x.y.z` |
| **Kubernetes / Helm** | `Chart.yaml` | `version: x.y.z` y `appVersion: "x.y.z"` |
| **Mobile** | `app.json` (Expo / React Native) | `"version": "x.y.z"` |
| **OpenAPI / Swagger** | `openapi.yaml` | Sincronizado dinámicamente mediante `semantic-release-openapi` |

## Validación

Antes de probar releases reales:

```bash
pnpm exec semantic-release --dry-run
```

El modo dry-run permite validar el análisis de commits y la próxima versión sin publicar el release.

Para publicar:

```bash
pnpm exec semantic-release
```

**No ejecutar simultáneamente varios proveedores sobre la misma rama:** todos pueden intentar publicar el mismo release. Elegir un proveedor como responsable de producción.

