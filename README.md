# Cofounder Live

Cofounder Live turns one founder brief into a published investor page and an interactive product concept. Maya, the Creative Cofounder, defines and reviews the experience. Theo, the Technical Cofounder, builds, revises, and publishes it.

## Submission links

- **Live application:** https://nano-banana-guide-26967920041.us-central1.run.app
- **Source repository:** https://github.com/stalkiq/cofounderlive
- **Generated product deliveries:** https://github.com/stalkiq/cofounderlive-deliveries
- **Example autonomous delivery:** https://github.com/stalkiq/cofounderlive-deliveries/pull/3
- **Demo video:** Add the public YouTube or Vimeo URL before Devpost submission

## Hackathon track

All Things Agentic · **Taskmaster** — one goal enters; deployed artifacts come out.

This is an agentic workflow, not a chat wrapper. Gemini chooses and calls application tools, observes their results, and continues until the required artifact has been reviewed and revised.

## Problem and value proposition

Founders can describe an idea, but turning it into something reviewable usually requires disconnected branding, product, engineering, testing, deployment, and repository work. Cofounder Live gives the founder two collaborating AI agents that complete that workflow visibly.

Maya protects product clarity and design quality. Theo turns the approved direction into durable artifacts, selects a useful Google capability, deploys the concept, and packages a clean repository delivery. The founder can inspect every tool action and continue revising the product in AI Build Studio.

## Features

- Two role-specialized, voice-enabled AI cofounders
- Autonomous function-calling workflows with tool-result feedback
- Published investor landing pages with evidence guards
- Product-specific interactive concepts rather than a fixed dashboard template
- Automatic Google Maps, Calendar, BigQuery, or Gemini capability selection
- Persistent revisions and project restoration through Firestore
- Live progress through Server-Sent Events
- AI Build Studio for iterative product changes
- Portable ZIP exports with deployment files
- Idempotent GitHub branches and pull requests for finished revisions

## How to use Cofounder Live

The experience is a sequence of agent workflows. Each step can take one or two minutes because Maya and Theo are generating, reviewing, revising, and publishing real artifacts. Keep the page open and wait until the active button changes before continuing.

1. Open the [live application](https://nano-banana-guide-26967920041.us-central1.run.app).
2. Enter a detailed product idea in the prompt box. Include the intended user, the problem, and the desired outcome.
3. Click **Build it live** once.
4. Wait while Maya creates the creative direction and Theo builds the investor landing page. The live activity feed shows their tool calls and progress. Do not click the button repeatedly while the agents are working.
5. When the landing page is complete, review its preview and published link. The main button changes to **Launch MVP**.
6. Click **Launch MVP** and wait again. Theo builds the interactive product concept, Maya reviews it, and Theo applies the review. Theo also selects one or two relevant Google capabilities for the product.
7. When this workflow finishes, the button changes to **View Product Concept**. Click it to open the generated product in a separate tab.
8. The **AI Build Studio** also appears below the result. It provides a Cursor-style workspace with the live preview, component files, revision history, and build output.
9. Enter a change for Theo in the studio prompt, such as _“Add an onboarding screen and simplify the dashboard.”_ Click **Build change** once and wait for the new revision. Theo updates the product, Maya reviews the change, and the preview refreshes when the revision is ready.
10. Repeat the studio prompt-and-build process to continue improving the same product. Each successful change is saved as a separate revision.
11. Click **Code ↓** to download the current credential-safe codebase, or click **Create PR ↗** to deliver the current revision to the public GitHub delivery repository.

If a workflow reports **Needs attention**, read the latest activity or build-output message before retrying. Starting a different idea in the main prompt creates a separate project and revision history.

### Landing-page workflow

1. Maya calls `create_visual_direction`.
2. Theo calls `publish_landing_page`.
3. Maya calls `review_landing_page`.
4. Theo calls `revise_landing_page` and returns the durable URL.

### Product-concept workflow

1. Theo calls `build_mvp`.
2. Maya calls `review_mvp`.
3. Theo calls `revise_mvp`.
4. Theo includes one or two complementary, product-appropriate Google capabilities.
5. The founder can continue iterating in AI Build Studio, download the code, or create a reviewable GitHub delivery PR.

## Autonomous Google capabilities

Theo selects up to two complementary capabilities based on the founder brief and aligns each with a compatible product screen:

- **Google Maps JavaScript API** for real interactive world, regional, and local maps
- **Places API** for real place searches, ratings, addresses, and map markers
- **Routes API** for real routes, polylines, distance, and duration
- **Weather API** for live location-specific conditions
- **Air Quality API** for live AQI, pollutants, and health recommendations
- **Geocoding API** for resolving generated product locations into coordinates
- **Cloud Translation** for multilingual product workflows
- **Cloud Vision** for image labels and text extraction
- **BigQuery** for product-specific sample operations data and live analytics
- **Gemini** for recommendations, planning, summarization, and product copilots
- **Cloud Text-to-Speech** for spoken product results

Examples include Maps + Weather, Places + Maps, Routes + Air Quality, Vision + Translation, Gemini + Text-to-Speech, and BigQuery + Gemini. OAuth-based access to a judge's Gmail, Drive, Calendar, or Sheets account is intentionally excluded to keep the judging flow fast and consent-free.

## GitHub delivery

AI Build Studio can package the current revision into a clean repository folder containing the interface, product specification, README, deployment guide, Dockerfile, and nginx configuration. Theo creates one idempotent pull request per mission revision in the configured fixed delivery repository.

The Cloud Run runtime requires a fine-grained GitHub token limited to the delivery repository with **Contents: Read and write** and **Pull requests: Read and write**. Store it in Secret Manager and expose it as `GITHUB_DELIVERY_TOKEN`; do not commit it or use a broad personal token.

## Approved Google agent framework

The agent runtime uses the official **Google Gen AI SDK for JavaScript** (`@google/genai`). The SDK handles Vertex AI authentication, Gemini generation, structured JSON, and function calling. Cofounder Live executes the requested tools and sends their results back to Gemini for the next autonomous step.

There are no custom REST calls to Vertex AI and no Gemini API key. Cloud Run uses Application Default Credentials with the project service account, so model usage is billed to the configured Google Cloud project.

## Google Cloud stack

- Gemini 3.5 Flash on Vertex AI through `@google/genai`
- Cloud Run for the web app and agent runtime
- Firestore for published pages, product concepts, and revision history
- BigQuery for mission-specific sample analytics selected by Theo
- Google Maps Platform APIs for Maps, Places, Routes, Weather, Air Quality, and Geocoding
- Cloud Translation and Cloud Vision for language and image workflows
- Cloud Text-to-Speech for distinct cofounder voices
- Secret Manager for the optional repository-scoped GitHub credential
- Server-Sent Events for live tool and agent progress

## Architecture

```mermaid
flowchart LR
    Founder[Founder or judge] --> UI[Web UI and AI Build Studio]
    UI -->|Founder brief or revision| Run[Cloud Run Node.js runtime]
    Run --> Agent[Agent orchestrator]
    Agent -->|Google Gen AI SDK| Vertex[Gemini 3.5 Flash on Vertex AI]
    Vertex -->|Function calls| Agent
    Agent --> Maya[Maya creative tools]
    Agent --> Theo[Theo technical tools]
    Maya --> Firestore[(Firestore)]
    Theo --> Firestore
    Theo --> BigQuery[(BigQuery)]
    Theo --> GoogleActions[Maps Platform, Translation, Vision and TTS]
    Theo --> GitHub[GitHub delivery PR]
    Run --> TTS[Cloud Text-to-Speech]
    Run -->|SSE progress and artifact URLs| UI
```

Gemini decides which declared tool to call next. The Node.js orchestrator executes that tool, persists its result, and returns the structured function response to Gemini. The loop only completes after the required review and revision stages produce a durable artifact.

## Run locally

Requirements:

- Node.js 20+
- Google Cloud CLI
- A Google Cloud project with billing enabled
- Application Default Credentials with Vertex AI and Firestore access

```bash
git clone https://github.com/stalkiq/cofounderlive.git
cd cofounderlive
npm install
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable \
  aiplatform.googleapis.com \
  airquality.googleapis.com \
  bigquery.googleapis.com \
  firestore.googleapis.com \
  geocoding-backend.googleapis.com \
  maps-backend.googleapis.com \
  places.googleapis.com \
  routes.googleapis.com \
  texttospeech.googleapis.com \
  translate.googleapis.com \
  vision.googleapis.com \
  weather.googleapis.com
export GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID
npm start
```

Open `http://localhost:8080`. The health endpoint reports the active provider, SDK, project, location, and model at `http://localhost:8080/health`.

## Reproducible testing

These checks use Node.js 20+, Python 3, `curl`, and the authenticated Google Cloud setup described above. Run them from the repository root.

### 1. Verify the source and installed dependencies

```bash
npm ci
npm ls --depth=0

for file in server.mjs lib/*.mjs; do
  node --check "$file"
done
node --check web/app.js
git diff --check
```

Expected result: every command exits successfully with no syntax, dependency, or whitespace errors.

### 2. Start the application and verify runtime health

In one terminal:

```bash
export GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID
npm start
```

In a second terminal:

```bash
curl --fail --silent http://127.0.0.1:8080/health | python3 -m json.tool
```

Expected result: the response contains `"ok": true`, `"sdk": "@google/genai"`, the configured Gemini model, and the available Google capabilities.

### 3. Run the complete autonomous workflow

Create a landing page:

```bash
curl --silent --show-error --no-buffer --max-time 240 \
  --request POST http://127.0.0.1:8080/api/agent/run \
  --header "Content-Type: application/json" \
  --data '{"goal":"A wildfire operations map that uses route planning and live air quality to coordinate safer evacuations."}' \
  > /tmp/cofounder-landing.sse
```

Extract the generated mission ID:

```bash
MISSION_ID=$(python3 - <<'PY'
import json

events = []
for block in open("/tmp/cofounder-landing.sse").read().split("\n\n"):
    if block.startswith("data: "):
        events.append(json.loads(block[6:]))

errors = [event for event in events if event.get("type") in {"error", "tool_error"}]
done = next(event for event in reversed(events) if event.get("type") == "done")
assert not errors, errors
mission_id = done["proof"]["id"]
assert mission_id.startswith("ep_")
print(mission_id)
PY
)
echo "$MISSION_ID"
```

Build, review, revise, and publish its product concept:

```bash
curl --silent --show-error --no-buffer --max-time 300 \
  --request POST http://127.0.0.1:8080/api/agent/mvp \
  --header "Content-Type: application/json" \
  --data "{\"missionId\":\"$MISSION_ID\"}" \
  > /tmp/cofounder-mvp.sse

python3 - <<'PY'
import json

events = []
for block in open("/tmp/cofounder-mvp.sse").read().split("\n\n"):
    if block.startswith("data: "):
        events.append(json.loads(block[6:]))

errors = [event for event in events if event.get("type") in {"error", "tool_error"}]
done = next(event for event in reversed(events) if event.get("type") == "done")
proof = done["proof"]
capabilities = proof["mvp"].get("googleCapabilities", [])

assert not errors, errors
assert proof["status"] == "mvp_launched"
assert 1 <= len(capabilities) <= 2
print("PASS:", proof["mvpUrl"])
print("Capabilities:", [item["service"] for item in capabilities])
PY
```

Expected result: both workflows finish without tool errors, the final status is `mvp_launched`, and Theo selects one or two product-relevant Google capabilities.

### 4. Verify the interface and credential-safe export

Open `http://127.0.0.1:8080/mvp/$MISSION_ID` after replacing `$MISSION_ID` with the printed value. Confirm that:

1. Three product screens are navigable.
2. The generated layout and copy match the test brief.
3. The selected Google capability components return results.
4. The browser console contains no JavaScript, network, API-key, or referrer errors.

Download and inspect the generated code:

```bash
curl --fail --silent \
  "http://127.0.0.1:8080/api/workspace/$MISSION_ID/code" \
  --output /tmp/cofounder-product.zip

python3 - <<'PY'
import re
import zipfile

with zipfile.ZipFile("/tmp/cofounder-product.zip") as archive:
    content = b"\n".join(archive.read(name) for name in archive.namelist())

assert not re.search(rb"AIza[0-9A-Za-z_-]{35}", content)
assert not re.search(rb"github_pat_[A-Za-z0-9_]{20,}", content)
print("PASS: export contains no valid Google API key or GitHub token")
PY
```

Expected result: the archive contains `index.html`, `product-spec.json`, `README.md`, `DEPLOY.md`, `Dockerfile`, and `nginx.conf`, with no valid credentials. Map-enabled exports contain `REPLACE_WITH_RESTRICTED_MAPS_BROWSER_KEY` instead of a live key.

### 5. Optional GitHub delivery test

This test requires the GitHub delivery configuration described below:

```bash
curl --fail --silent \
  --request POST "http://127.0.0.1:8080/api/workspace/$MISSION_ID/github" \
  --header "Content-Type: application/json" \
  --data '{}' \
  | python3 -m json.tool
```

Expected result: the response provides a public repository URL, a pull-request URL, and a content-addressed branch name. Repeating the request reuses the same safe delivery instead of creating a duplicate.

## Deploy to Google Cloud Run

The runtime service account needs these roles:

- Vertex AI User
- Cloud Datastore User
- BigQuery Job User
- BigQuery Data Editor
- Cloud Translation API User
- Service Usage Consumer

Then deploy:

```bash
export GCP_PROJECT_ID=YOUR_PROJECT_ID
export GCP_REGION=us-central1
./deploy.sh
```

For GitHub delivery, create a fine-grained token restricted to one delivery repository. Give it **Contents: Read and write** and **Pull requests: Read and write**, then store it without committing it:

```bash
printf '%s' "$GITHUB_DELIVERY_TOKEN" | gcloud secrets create github-delivery-token \
  --data-file=- \
  --replication-policy=automatic \
  --project="$GCP_PROJECT_ID"
```

Grant the Cloud Run service account `roles/secretmanager.secretAccessor` on that secret and run `./deploy.sh` again. GitHub delivery is optional; all Google agent workflows work without it.

Real Maps Platform products require two API-restricted keys:

- `maps-browser-key` restricted to the Maps JavaScript API and the deployed app's HTTP referrer
- `google-capabilities-server-key` restricted to Places, Routes, Weather, Air Quality, and Geocoding and stored only in Secret Manager

The deployment script mounts these secrets as `MAPS_BROWSER_KEY` and `GOOGLE_CAPABILITIES_SERVER_KEY` when they exist.

## Configuration

- `GOOGLE_CLOUD_PROJECT` or `GCP_PROJECT` — Google Cloud project
- `VERTEX_LOCATION` — Vertex AI location; defaults to `global`
- `GEMINI_MODEL` — model; defaults to `gemini-3.5-flash`
- `PUBLIC_BASE_URL` — deployed Cloud Run URL used for published artifacts
- `GOOGLE_TTS_ENABLED` — enables cofounder speech
- `MAPS_BROWSER_KEY` — referrer- and API-restricted Maps JavaScript browser key
- `GOOGLE_CAPABILITIES_SERVER_KEY` — server-side key restricted to Places, Routes, Weather, Air Quality, and Geocoding
- `BIGQUERY_DATASET` — mission-specific product analytics dataset; defaults to `cofounder_live`
- `BIGQUERY_LOCATION` — BigQuery dataset location; defaults to `US`
- `GITHUB_DELIVERY_TOKEN` — fine-grained token restricted to the delivery repository
- `GITHUB_DELIVERY_OWNER` — fixed repository owner; defaults to `stalkiq`
- `GITHUB_DELIVERY_REPO` — fixed repository name; defaults to `cofounderlive-deliveries`
- `GITHUB_DELIVERY_BASE` — pull-request base branch; defaults to `main`

## Data sources

- Founder-provided product briefs
- Gemini-generated fictional sample product data
- Firestore records created by the agent workflows
- BigQuery sample tables created for product concepts that need analytics

The application does not claim that generated sample data represents real customers, traction, partnerships, or market performance.

## Findings and learnings

- Reliable autonomy needs explicit completion criteria. The agent prompts require publish, review, and revision tools instead of allowing Gemini to stop after advice.
- Structured function responses make multi-agent handoffs inspectable and recoverable.
- Product differentiation improved when Gemini selected from controlled archetypes and screen primitives instead of generating arbitrary code.
- Google capabilities are most convincing when selected for a product reason and connected to an observable action.
- Durable Firestore state is necessary because Cloud Run instances are ephemeral.
- Evidence guards are essential in startup workflows because persuasive copy can otherwise turn unverified assumptions into apparent facts.

## Competition requirement checklist

- [x] **One category selected:** Taskmaster
- [x] **Gemini 3.5 or newer:** Gemini 3.5 Flash through Vertex AI
- [x] **Approved Google agent framework:** official Google Gen AI SDK for JavaScript
- [x] **Google Cloud infrastructure:** Cloud Run, Firestore, BigQuery, Secret Manager, and Cloud Text-to-Speech
- [x] **Complete autonomous workflow:** agents take actions, inspect tool results, review work, revise it, and publish artifacts
- [x] **Hosted project URL:** linked above
- [x] **Code repository:** this repository
- [x] **Reproducible spin-up and deployment instructions:** included above
- [x] **Architecture diagram:** included above
- [x] **Features, technologies, data sources, and learnings:** documented above
- [ ] **Public demo video of four minutes or less:** record in English, upload to YouTube or Vimeo, and add the URL above
- [ ] **Demo must visibly prove Google Cloud deployment:** show the live `.run.app` URL and Cloud Run or Vertex AI evidence
- [ ] **Devpost short description and final submission form:** copy the problem, value proposition, features, technologies, data sources, and learnings from this README

## Evidence and safety

Generated business claims are treated as hypotheses unless the founder supplied evidence. Downloaded product concepts include a notice that sample data is fictional and that the preview is not a production application.
