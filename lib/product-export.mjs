import { renderMvpPage } from "./investor-page.mjs";

const PUBLIC_BASE = String(
  process.env.PUBLIC_BASE_URL || "https://nano-banana-guide-26967920041.us-central1.run.app",
).replace(/\/$/, "");

export function productSlug(record) {
  return String(record?.mvp?.name || record?.brand?.name || "product-concept")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "product-concept";
}

function capabilityName(record) {
  return {
    maps: "Google Maps",
    calendar: "Google Calendar",
    bigquery: "BigQuery",
    gemini: "Gemini",
  }[record?.mvp?.googleCapability?.service] || "Google Cloud";
}

export function buildProductFiles(record) {
  const name = record?.mvp?.name || record?.brand?.name || "Product Concept";
  const slug = productSlug(record);
  const capability = capabilityName(record);
  const missionId = record?.missionId || "";
  const revision = Number(record?.revision || 1);
  const indexHtml = renderMvpPage({
    ...record,
    runtimeBaseUrl: PUBLIC_BASE,
  });
  const readme = `# ${name}

An interactive product concept created by Maya and Theo in [Cofounder Live](${PUBLIC_BASE}).

## Product

${record?.mvp?.subheadline || record?.idea || "A focused interactive product concept."}

- Revision: ${revision}
- Google capability: ${capability}
- Capability rationale: ${record?.mvp?.googleCapability?.rationale || "Selected by Theo for the product's core workflow."}

## Run locally

Open \`index.html\` in a modern browser. The interface has no build step.

The ${capability} interaction uses the hosted Cofounder Live runtime for mission \`${missionId}\` when a server-side Google Cloud action is required.

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

${capability} was selected by Theo because: ${record?.mvp?.googleCapability?.rationale || "it supports the core workflow."}

Maps and Calendar actions open official Google destinations. Gemini and BigQuery actions use the Cofounder Live Google Cloud runtime referenced by the generated interface; replace that runtime with your own authenticated backend before production use.
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
  return {
    name,
    slug,
    revision,
    files: {
      "index.html": indexHtml,
      "product-spec.json": `${JSON.stringify(record.mvp, null, 2)}\n`,
      "README.md": readme,
      "DEPLOY.md": deploy,
      "Dockerfile": dockerfile,
      "nginx.conf": nginx,
      ".gitignore": ".DS_Store\n*.local\n.env\n",
    },
  };
}
