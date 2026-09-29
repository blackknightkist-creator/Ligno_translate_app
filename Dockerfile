FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code and build
COPY . .
RUN npm run build

# Expose port (7860 for Hugging Face Spaces, 3000 for Railway/Local)
EXPOSE 7860
EXPOSE 3000
ENV PORT=7860
ENV NODE_ENV=production

CMD ["npm", "start"]
