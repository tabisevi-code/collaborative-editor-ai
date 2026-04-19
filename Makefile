.DEFAULT_GOAL := run

.PHONY: install run test fastapi-dev

install:
	npm run install:all

run:
	bash ./run.sh current

test:
	bash ./run.sh test

fastapi-dev:
	cd backend_fastapi && python3 -m uvicorn app.main:app --reload --port 8000
