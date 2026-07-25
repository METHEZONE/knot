FROM python:3.12-slim
WORKDIR /app
COPY backend/pyproject.toml pyproject.toml
RUN pip install --no-cache-dir ".[dev]"
COPY backend .
ENV KNOT_SERVICE_NAME=knot-api
CMD ["uvicorn", "apps.api.main:app", "--host", "0.0.0.0", "--port", "8080"]
