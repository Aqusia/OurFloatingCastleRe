FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY client/package*.json client/
COPY admin-client/package*.json admin-client/
COPY server/package*.json server/
RUN npm ci --workspaces --include-workspace-root

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["npm", "start"]
