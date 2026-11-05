import { describe, expect, it } from "vitest";
import { buildOpenApi } from "./openapi";

describe("openapi", () => {
  it("builds a spec covering the API", () => {
    const spec = buildOpenApi("http://x");
    expect(Object.keys(spec.paths).length).toBeGreaterThan(40);
    expect(JSON.stringify(spec.paths["/reports"])).toContain("radiusKm");
  });
});
