FROM node:20-bookworm-slim

WORKDIR /app

COPY backend/package*.json ./backend/
RUN cd backend && npm ci

COPY backend ./backend
COPY ai-service ./ai-service
COPY shared ./shared

WORKDIR /app/backend

EXPOSE 3000

CMD ["npm", "run", "dev"]
