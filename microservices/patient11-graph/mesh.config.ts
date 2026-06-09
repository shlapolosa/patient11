// GQL-HIVE-MIGRATE (#160): mesh-compose config for GraphQL Hive Gateway (Mesh v1).
//
// At container start, start.sh runs `mesh-compose -c mesh.config.ts -o supergraph.graphql`.
// This config reads MESH_SOURCES (a JSON array injected by the patient11-graph CD /
// app.submit) and declares one OpenAPI subgraph per entry via @omnigraph/openapi's
// loadOpenAPISubgraph. Each entry: { name, source } where `source` is a full OpenAPI
// spec URL (e.g. http://patient9-api.default.svc.cluster.local/openapi.json).
//
// Per-subgraph operations are prefixed `<name>_` (e.g. Patient9_listItems) so multiple
// sources sharing the same OpenAPI operationId never collide and every source stays
// independently addressable in the federated schema.
import { defineConfig, createPrefixTransform } from '@graphql-mesh/compose-cli';
import { loadOpenAPISubgraph } from '@omnigraph/openapi';

const FORWARD_AUTH = process.env.FORWARD_AUTH !== 'false';

// GraphQL names must match [_a-zA-Z0-9]; service names (patient11-api) have
// hyphens that break prefix/subgraph naming. Sanitize to underscores.
const gqlSafe = (s: string): string => s.replace(/[^_a-zA-Z0-9]/g, '_');

interface MeshSource {
  name: string;
  source: string;
  headers?: Record<string, string>;
}

let entries: MeshSource[] = [];
try {
  entries = JSON.parse(process.env.MESH_SOURCES || '[]');
} catch (err) {
  console.error('Failed to parse MESH_SOURCES JSON:', (err as Error).message);
  entries = [];
}
if (!Array.isArray(entries)) entries = [];

export const composeConfig = defineConfig({
  subgraphs: entries.map((e) => {
    // endpoint = the spec URL host root, so REST paths resolve against the service,
    // not the spec file path.
    const u = new URL(e.source);
    const endpoint = `${u.protocol}//${u.host}`;

    // FORWARD_AUTH (default on): forward the caller's already-validated JWT to every
    // upstream via Hive's `{context.headers.authorization}` interpolation. Plus any
    // static headers the source declared.
    const operationHeaders: Record<string, string> = { ...(e.headers || {}) };
    if (FORWARD_AUTH) {
      operationHeaders.Authorization = '{context.headers.authorization}';
    }

    return {
      sourceHandler: loadOpenAPISubgraph(gqlSafe(e.name), {
        source: e.source,
        endpoint,
        operationHeaders,
      }),
      transforms: [
        createPrefixTransform({ value: `${gqlSafe(e.name)}_`, includeRootOperations: true }),
      ],
    };
  }),
});
