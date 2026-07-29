FROM node:22-bookworm-slim AS node-runtime

FROM python:3.12-slim
WORKDIR /app
COPY backend/pyproject.toml pyproject.toml
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node-runtime /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -sf ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && npm install -g @solana/pay@1.0.23 \
    && pip install --no-cache-dir ".[dev]"
COPY backend .
ENV KNOT_SERVICE_NAME=knot-api
CMD ["uvicorn", "apps.api.main:app", "--host", "0.0.0.0", "--port", "8080"]
