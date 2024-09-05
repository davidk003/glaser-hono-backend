FROM oven/bun
RUN curl -fsSL https://bun.sh/install | bash
# FROM oven/bun:1
FROM node:lts-alpine
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install -g pnpm
RUN pnpm install --production
# RUN mv node_modules ../
COPY . .
EXPOSE 3000
RUN chown -R node /usr/src/app
USER node
CMD ["pnpm", "run", "dev", "src/index.ts"]
