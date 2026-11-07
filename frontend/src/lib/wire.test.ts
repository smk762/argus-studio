import { describe, expect, it } from "vitest";
import { MANIFEST_VERSION } from "@/components/curator/types";
import curator from "../../schema/curator-wire.schema.json";

describe("pinned wire schemas", () => {
  it("stamps the manifest version the curator schema declares", () => {
    expect(curator.$defs.ManifestRow.properties.manifest_version.default).toBe(MANIFEST_VERSION);
  });
});
