FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.mjs ./
COPY lib/ ./lib/
COPY web/ ./web/
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.mjs"]
