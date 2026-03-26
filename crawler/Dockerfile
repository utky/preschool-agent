FROM node:22-slim

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY dist/ ./dist/

CMD ["node", "dist/main.js"]
