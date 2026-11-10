FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/realtime/package*.json ./apps/realtime/
RUN npm install
COPY apps/realtime ./apps/realtime
RUN npm run build --workspace @syncspace/realtime
ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm","run","start","--workspace","@syncspace/realtime"]