import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Baseline generation entry point. CI can run this against a live FastAPI OpenAPI document.
const output = resolve("src/features/cad/api/generated/openapi.ts");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, "// Generated contract baseline. Run npm run generate:cad-contracts after OpenAPI export.\nexport {};\n");
