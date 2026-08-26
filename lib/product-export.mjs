import { renderMvpPage } from "./investor-page.mjs";

const PUBLIC_BASE = String(
  process.env.PUBLIC_BASE_URL || "https://nano-banana-guide-26967920041.us-central1.run.app",
).replace(/\/$/, "");
const MAPS_KEY_PLACEHOLDER = "REPLACE_WITH_RESTRICTED_MAPS_BROWSER_KEY";
const CREDENTIAL_PATTERNS = [
  { name: "Google API key", pattern: /AIza[0-9A-Za-z_-]{35}/ },
  { name: "GitHub token", pattern: /(?:gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{20,})/ },
  { name: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

function assertCredentialSafe(files) {
  for (const [filePath, content] of Object.entries(files)) {
    const match = CREDENTIAL_PATTERNS.find(({ pattern }) => pattern.test(String(content)));
    if (match) throw new Error(`Credential-safe export blocked a ${match.name} in ${filePath}.`);
  }
}

export function productSlug(record) {
  return String(record?.mvp?.name || record?.brand?.name || "product-concept")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "product-concept";
}

function capabilityName(record) {
  const capabilities = record?.mvp?.googleCapabilities
    || (record?.mvp?.googleCapability ? [record.mvp.googleCapability] : []);
  return capabilities.map((capability) => capability.label || capability.service).join(" + ") || "Google Cloud";
}

function capabilityRationale(record) {
  const capabilities = record?.mvp?.googleCapabilities
    || (record?.mvp?.googleCapability ? [record.mvp.googleCapability] : []);
  return capabilities.map((capability) =>
    `${capability.label || capability.service}: ${capability.rationale || "supports the core workflow"}`,
  ).join("\n");
}

export function buildProductFiles(record) {
  const name = record?.mvp?.name || record?.brand?.name || "Product Concept";
  const slug = productSlug(record);
  const capability = capabilityName(record);
  const rationale = capabilityRationale(record);
  const missionId = record?.missionId || "";
  const revision = Number(record?.revision || 1);
  const indexHtml = renderMvpPage({
    ...record,
    runtimeBaseUrl: PUBLIC_BASE,
    mapsBrowserKey: MAPS_KEY_PLACEHOLDER,
  });
  const readme = `# ${name}

An interactive product concept created by Maya and Theo in [Cofounder Live](${PUBLIC_BASE}).

## Product

${record?.mvp?.subheadline || record?.idea || "A focused interactive product concept."}

- Revision: ${revision}
- Google capabilities: ${capability}
- Capability rationale: ${rationale || "Selected by Theo for the product's core workflow."}

## Run locally

Open \`index.html\` in a modern browser. The interface has no build step.

The ${capability} interaction uses the hosted Cofounder Live runtime for mission \`${missionId}\` when a server-side Google Cloud action is required.

If the product includes a Google Map, replace \`${MAPS_KEY_PLACEHOLDER}\` in \`index.html\` with your own API- and referrer-restricted Maps JavaScript API key. Never commit a valid API key.

## Deploy

See [DEPLOY.md](./DEPLOY.md) for GitHub Pages and Google Cloud Run instructions.

## Repository files

- \`index.html\` — self-contained product interface
- \`product-spec.json\` — validated product specification
- \`Dockerfile\` and \`nginx.conf\` — Cloud Run container
- \`DEPLOY.md\` — deployment instructions

## Important

This repository contains an interactive product concept, not a production application. Displayed sample content is fictional and requires validation before use.
`;
  const deploy = `# Deployment

## GitHub Pages

1. Open **Settings → Pages** in this repository.
2. Choose **Deploy from a branch**.
3. Select the merged branch and the folder containing this product's \`index.html\`.

If this product is delivered inside a shared repository folder, copy that folder to a dedicated repository root before enabling Pages.

## Google Cloud Run

Install and authenticate the Google Cloud CLI, then run:

\`\`\`bash
gcloud run deploy ${slug} \\
  --source . \\
  --region us-central1 \\
  --allow-unauthenticated
\`\`\`

Cloud Run builds the included Dockerfile and serves the product on port 8080.

## Google capability

${rationale || `${capability} supports the core workflow.`}

The generated interface uses the hosted Cofounder Live runtime for server-side Google Cloud actions. Replace that runtime with your own authenticated backend before production use.

For a Google Map, replace \`${MAPS_KEY_PLACEHOLDER}\` in \`index.html\` at deployment time with your own Maps JavaScript API browser key. Restrict the key to the Maps JavaScript API and your deployed HTTP referrer; never commit it to source control.
`;
  const dockerfile = `FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
EXPOSE 8080
`;
  const nginx = `server {
  listen 8080;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;
  }
}
`;
  const files = {
    "index.html": indexHtml,
    "product-spec.json": `${JSON.stringify(record.mvp, null, 2)}\n`,
    "README.md": readme,
    "DEPLOY.md": deploy,
    "Dockerfile": dockerfile,
    "nginx.conf": nginx,
    ".gitignore": ".DS_Store\n*.local\n.env\n",
  };
  assertCredentialSafe(files);
  return {
    name,
    slug,
    revision,
    files,
  };
}
