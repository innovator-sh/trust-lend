# Build from the repository root so the image also gets src/contracts (ABIs and addresses):
#   docker build -f ml-api/Dockerfile -t trustlend-ml .
#   docker run --rm -p 8000:8000 -e ML_RPC_URL=<rpc> -e ML_ALLOWED_ORIGINS=<site origin> trustlend-ml
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY ml-api/requirements.txt ml-api/requirements.txt
RUN pip install --no-cache-dir -r ml-api/requirements.txt

COPY ml-api/app ml-api/app
COPY ml-api/models ml-api/models
COPY src/contracts src/contracts

RUN useradd --create-home --uid 10001 appuser && chown -R appuser /app
USER appuser

WORKDIR /app/ml-api
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
