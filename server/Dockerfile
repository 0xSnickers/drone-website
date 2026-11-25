FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.7 /uv /usr/local/bin/uv
ARG UV_INDEX_URL=""
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_HTTP_TIMEOUT=120
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN if [ -n "$UV_INDEX_URL" ]; then uv sync --frozen --no-dev --default-index "$UV_INDEX_URL"; else uv sync --frozen --no-dev; fi
COPY . .
RUN chmod +x /app/scripts/entrypoint.sh
EXPOSE 9000
ENTRYPOINT ["/app/scripts/entrypoint.sh"]
CMD ["web"]
