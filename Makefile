install:
	cd backend && npm install
	cd frontend && npm install || true

test:
	cd backend && npm test

run-backend:
	cd backend && npm start

run-frontend:
	cd frontend && npm start || echo "Frontend not implemented yet"
