FROM node:20-bookworm-slim
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-venv \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY requirements-antigravity.txt ./
RUN python3 -m venv /opt/antigravity \
  && /opt/antigravity/bin/pip install --no-cache-dir -r requirements-antigravity.txt

COPY server.mjs ./
COPY lib/ ./lib/
COPY web/ ./web/
COPY workers/ ./workers/

ENV PORT=8080
ENV ANTIGRAVITY_PYTHON=/opt/antigravity/bin/python
ENV ANTIGRAVITY_MODEL=gemini-3.5-flash
EXPOSE 8080
CMD ["node", "server.mjs"]
