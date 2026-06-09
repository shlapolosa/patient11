// GQL-HIVE-MIGRATE (#160): GraphQL Hive Gateway (Mesh v1) runtime config.
//
// start.sh runs `hive-gateway supergraph supergraph.graphql -c gateway.config.ts`.
//
// CD contract:
//   - /graphql        federated GraphQL endpoint
//   - /health         k8s probe target -> 200 JSON {status:"healthy", service}
//                     (mirrors the python/java templates; Hive's native checks are
//                     moved off this path to /_hc and /_ready so our JSON wins)
//   - FORWARD_AUTH (default on): propagate the incoming Authorization header to every
//     subgraph request (belt-and-suspenders with the per-subgraph operationHeaders
//     baked into the supergraph).
import { defineConfig } from '@graphql-hive/gateway';

const FORWARD_AUTH = process.env.FORWARD_AUTH !== 'false';
const SERVICE = process.env.GATEWAY_NAME || 'patient11-graph';

export const gatewayConfig = defineConfig({
  graphqlEndpoint: '/graphql',
  // Keep Hive's native health/readiness off the platform contract path so the JSON
  // /health handler below is authoritative.
  healthCheckEndpoint: '/_hc',
  readinessCheckEndpoint: '/_ready',
  ...(FORWARD_AUTH
    ? {
        propagateHeaders: {
          fromClientToSubgraphs: ({ request }: { request: Request }) => ({
            Authorization: request.headers.get('authorization') || '',
          }),
        },
      }
    : {}),
  plugins: () => [
    {
      // Platform /health + /healthz contract: 200 JSON {status, service}.
      onRequest({ request, endResponse }: any) {
        const path = new URL(request.url).pathname;
        if (path === '/health' || path === '/healthz') {
          endResponse(
            new Response(JSON.stringify({ status: 'healthy', service: SERVICE }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
          );
        }
      },
    },
  ],
});
