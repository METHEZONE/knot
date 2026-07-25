FROM python:3.12-slim
WORKDIR /app
COPY backend/pyproject.toml pyproject.toml
COPY backend/apps apps
COPY backend/libs libs
RUN pip install --no-cache-dir .
ENV KNOT_SERVICE_NAME=knot-creator-agent
CMD ["uvicorn", "apps.creator_agent.main:app", "--host", "0.0.0.0", "--port", "8080"]
