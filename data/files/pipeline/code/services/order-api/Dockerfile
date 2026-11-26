# syntax=docker/dockerfile:1
# ShopStream order-api. Build context = pipeline/code/services (so common/ is visible):
#   docker build -f order-api/Dockerfile -t shopstream/order-api:dev .
# Stage 1 "builder": install dependencies into a virtualenv (has pip, caches).
FROM python:3.12-slim AS builder
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /venv
COPY order-api/requirements.txt /tmp/requirements.txt
RUN /venv/bin/pip install -r /tmp/requirements.txt

# Stage 2 "runtime": only the venv + our code. No compilers, no pip cache.
FROM python:3.12-slim
ENV PATH=/venv/bin:$PATH PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=/app
# Run as an unprivileged user (uid 10001), never as root.
RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin app
COPY --from=builder /venv /venv
WORKDIR /app
COPY common/shopstream_common.py ./
COPY order-api/*.py ./
USER 10001
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
