FROM node:20-bookworm-slim

WORKDIR /app

COPY realtime/package*.json ./realtime/
RUN cd realtime && npm ci

COPY realtime ./realtime
COPY backend ./backend
COPY shared ./shared

WORKDIR /app/realtime

EXPOSE 3001

CMD ["npm", "run", "dev"]
