# DevSuite — container image (BACKLOG ROAD-3). Local-first: publish the port on loopback only.
#   docker compose up -d        → http://localhost:8000
# Note: the SSH/local terminal run INSIDE the container (a shell in the container, not on your host).

# ── build stage: resolve and install Python dependencies into a venv ──────────
FROM python:3.12-slim AS build
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /build
RUN python -m venv /opt/venv
COPY requirements.txt .
RUN /opt/venv/bin/pip install -r requirements.txt

# ── runtime stage ─────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime
# System libraries WeasyPrint needs for HTML/DOCX→PDF, plus a font and OpenSSH client tools
# (ssh-keygen/ssh-keyscan are used by the SFTP host-key approval flow).
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libffi8 shared-mime-info fonts-dejavu-core openssh-client \
 && rm -rf /var/lib/apt/lists/*

# Non-root user; all persistent data (the encrypted DevDB, audit log) lives in /data via HOME.
RUN useradd --create-home --home-dir /data --uid 10001 --shell /usr/sbin/nologin devsuite \
 && mkdir -p /app && chown devsuite:devsuite /data /app
ENV HOME=/data \
    PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    PORT=8000
COPY --from=build /opt/venv /opt/venv
WORKDIR /app
COPY --chown=devsuite:devsuite main.py deps.py devdb.py roadmap_utils.py ./
COPY --chown=devsuite:devsuite routes ./routes
COPY --chown=devsuite:devsuite static ./static
USER devsuite
VOLUME ["/data"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/auth/status', timeout=4).status==200 else 1)"
CMD ["python", "main.py"]
