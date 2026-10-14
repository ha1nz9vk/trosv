# ============================================================
# TROSV ai-service - Python 3.12, Debian 13 "trixie" (khop convention
# Debian cua cac image khac trong stack).
# ============================================================
FROM python:3.12-slim-trixie

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py knowledge.md* ./

EXPOSE 8001

# Khoi lenh that do compose gan (uvicorn ...); CMD giu cho chay doc lap.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
