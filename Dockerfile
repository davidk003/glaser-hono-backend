# Base image
FROM ubuntu:22.04

# Set environment variables for production
ENV NODE_ENV=production

# Set the working directory inside the container
WORKDIR /usr/src/app

# Install system dependencies: curl, bash, Node.js, and pnpm
RUN apt-get update && \
    apt-get install -y curl bash build-essential && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    apt-get install -y unzip && \
    npm install -g pnpm && \
    rm -rf /var/lib/apt/lists/*

# Install Bun in a user-accessible directory and ensure the binary is available globally
# RUN curl -fsSL https://bun.sh/install | bash -s -- --location /usr/local/bun && \
#     ln -s /usr/local/bun/bin/bun /usr/local/bin/bun && \
#     chmod +x /usr/local/bin/bun
RUN npm install -g bun@1.1.25

# Verify Bun installation
RUN bun --version

# Copy package.json and lock files to install dependencies
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]

# Install dependencies using pnpm
RUN pnpm install --production

# Copy the rest of the application files
COPY . .
COPY .env /usr/src/app


# Ensure all files are owned by the node user
RUN useradd -m node && chown -R node:node /usr/src/app

# Expose the application port
EXPOSE 3000

# Switch to the node user
USER node

# Run the application using pnpm
# CMD ["pnpm", "run", "dev", "src/index.ts"]
CMD ["bun", "run", "src/index.ts"]