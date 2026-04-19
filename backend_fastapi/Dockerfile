FROM python:3.11-slim

WORKDIR /app

COPY backend_fastapi/pyproject.toml ./pyproject.toml
COPY backend_fastapi/app ./app
COPY backend_fastapi/README.md ./README.md

RUN python -m pip install --upgrade pip && python -m pip install .

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
