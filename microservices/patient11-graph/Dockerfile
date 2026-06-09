# GQL-HIVE-MIGRATE (#160): GraphQL Hive Gateway (Mesh v1) image.
# compose -> serve pipeline: mesh-compose generates a supergraph from MESH_SOURCES at
# container start, hive-gateway serves it on :8080.
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
# No native compilation needed for the Hive stack; plain install, no --force / --legacy-peer-deps.
RUN npm install --omit=dev

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY package.json mesh.config.ts gateway.config.ts start.sh ./

RUN chmod +x start.sh

# Writable supergraph output dir. Under Knative runAsNonRoot the root FS may be
# read-only; the CD mounts an emptyDir at /app/config. Pre-create + world-writable so
# the numeric (non-named) user can write the composed supergraph even before the mount.
RUN mkdir -p /app/config && chmod 0777 /app/config

# Knative runAsNonRoot rejects named users — use a NUMERIC uid.
USER 1000

EXPOSE 8080

# k8s probe contract: /health -> 200 JSON.
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT ["./start.sh"]
