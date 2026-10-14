import { getPayload, type SanitizedConfig } from "payload";

// These suites destroy their instance in afterAll. Payload keeps destroyed
// instances cached, so each suite must own a key separate from the default.
export function getBrowserSuitePayload(
  suite: "rebuild-activity" | "site",
  config: SanitizedConfig | Promise<SanitizedConfig>,
) {
  return getPayload({ config, key: `e2e-${suite}` });
}
