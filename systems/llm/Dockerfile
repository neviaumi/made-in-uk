# Builder Stage
FROM python:3.12.4-slim AS base

WORKDIR /app

RUN pip install -U pdm
ENV PDM_CHECK_UPDATE=false
COPY pyproject.toml pdm.lock .python-version ./
COPY ./src/ ./src/
COPY ./tests/ ./tests/
COPY ./scripts/docker/ ./scripts/docker/
COPY ./gpt4all/ ./gpt4all/
HEALTHCHECK --interval=60s --timeout=180s --start-period=5s --retries=3 CMD [ "bash", "scripts/docker/health-check.sh" ]

FROM base AS dev
RUN bash ./scripts/docker/setup.sh --dev

FROM base
RUN bash ./scripts/docker/setup.sh --prod

