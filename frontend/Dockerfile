# Stage 1: Build the React application
FROM node:20-alpine AS build

# Set the working directory
WORKDIR /app

# Copy dependency files first for layer caching
COPY package.json package-lock.json ./

# Install dependencies using clean install
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the production bundle
RUN npm run build

# Stage 2: Serve the application with Nginx (unprivileged)
FROM nginxinc/nginx-unprivileged:alpine

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 8018
EXPOSE 8018

# Nginx starts automatically by default in the base image
