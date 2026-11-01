# =============================================================================
# EOA Tactical Edge Mobile Terminal - Production Dockerfile (Phase 2)
# Standard Node/Alpine base serving Vite on Port 5173
# =============================================================================

FROM node:20-alpine

WORKDIR /app

# Install project dependencies
COPY package*.json ./
RUN npm install

# Copy application source code and compile production assets
COPY . ./
RUN npm run build

# Expose sovereign tactical edge port
EXPOSE 5173

# Serve production build using Vite preview bound to 0.0.0.0:5173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
