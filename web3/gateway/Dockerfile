FROM node:22-alpine AS deps
WORKDIR /app
COPY web3/gateway/package*.json ./
RUN npm install

FROM deps AS build
COPY web3/gateway ./
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules node_modules
COPY --from=build /app/dist dist
COPY web3/gateway/package.json package.json
CMD ["node", "dist/src/server.js"]
