FROM node:20-bookworm-slim

WORKDIR /app

# Install only backend production deps for the API image.
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY backend ./backend
COPY scripts ./scripts

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0
EXPOSE 4000

CMD ["node", "backend/server.js"]
