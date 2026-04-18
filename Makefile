.PHONY: install run test demo fastapi-dev

install:
	npm run install:all

run:
	./run.sh current

test:
	./run.sh test

demo:
	./run.sh demo

fastapi-dev:
	cd backend_fastapi && uvicorn app.main:app --reload --port 8000
