FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FORGE_HOST=0.0.0.0 \
    FORGE_PORT=3000

# App is stdlib-only; copy source and run as non-root.
COPY agent.py commodities.py envconfig.py market.py psx.py server.py \
     fob_freight.py tradedeck.py lcd.py ./
COPY data ./data
COPY static ./static

RUN useradd --create-home --uid 10001 forge \
 && mkdir -p /app/.cache \
 && chown -R forge:forge /app

USER forge
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:3000/', timeout=3)"

CMD ["python", "server.py", "--host", "0.0.0.0", "--port", "3000"]
