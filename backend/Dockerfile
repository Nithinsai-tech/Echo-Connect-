FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

# Ensure upload directory exists for sharing files
RUN mkdir -p uploads

EXPOSE 5000

CMD ["node", "src/server.js"]
