FROM oven/bun:canary-slim

WORKDIR /app

# 1. Copy semua file (pastikan ada .dockerignore!)
COPY . .

# 2. Install dep (tanpa dev)
RUN bun install --production

# 3. Build React frontend (gunakan perintah build dari package.json)
RUN bun run build

# 4. Jalankan server
EXPOSE 3000

CMD ["bun", "src/index.tsx"]