import { describe, expect, it } from "vitest";
import { expandToolGrants, getTool, isKnownTool, toolAvailability } from "../../src/tools";

const env = (set: string[]) => (name: string) => set.includes(name);

describe("tool authorization", () => {
  it("expands legacy capabilities into concrete tools", () => {
    expect(expandToolGrants(["research.market", "analytics.compute_metrics", "unknown"]).sort()).toEqual(
      ["analytics.compute_metrics", "web.fetch_page", "web.search"].sort(),
    );
    expect(isKnownTool("research.market")).toBe(true);
    expect(getTool("research.market")?.status).toBe("legacy");
  });

  it("decides availability from grants, status, configuration and autonomy", () => {
    const grants = ["web.search", "web.fetch_page", "docs.create", "meta_ads.execute_change"];
    expect(toolAvailability("web.fetch_page", { grants, autonomyLevel: 1, configuredEnv: env([]) })).toBe("ok");
    expect(toolAvailability("analytics.compute_metrics", { grants, autonomyLevel: 4, configuredEnv: env([]) })).toBe("not_granted");
    expect(toolAvailability("web.search", { grants, autonomyLevel: 2, configuredEnv: env([]) })).toBe("missing_config");
    expect(toolAvailability("web.search", { grants, autonomyLevel: 2, configuredEnv: env(["BRAVE_SEARCH_API_KEY"]) })).toBe("ok");
    expect(toolAvailability("docs.create", { grants, autonomyLevel: 4, configuredEnv: env([]) })).toBe("planned");
    expect(toolAvailability("meta_ads.execute_change", { grants, autonomyLevel: 4, configuredEnv: env([]) })).toBe("planned");
    expect(toolAvailability("nope", { grants, autonomyLevel: 4, configuredEnv: env([]) })).toBe("not_granted");
  });
});
