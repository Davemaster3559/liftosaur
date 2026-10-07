import { expect } from "chai";
import { Capabilities_hasLocal, ILocalCapability } from "../src/devfit/capabilities";
import { DevFitConfig } from "../src/devfit/config";
import { Subscriptions_hasSubscription } from "../src/utils/subscriptions";

describe("DevFit local capabilities", () => {
  it("enables only implemented local features without a subscription", () => {
    for (const feature of ["graphs", "plates", "muscles", "insights", "notifications"] as const) {
      expect(Capabilities_hasLocal(feature)).to.equal(true);
    }
    for (const feature of ["officialApi", "officialMcp", "store", "toString", "constructor"]) {
      expect(Capabilities_hasLocal(feature as ILocalCapability)).to.equal(false);
    }
  });

  it("leaves real Liftosaur entitlements unchanged", () => {
    const subscription = { apple: [], google: [] };
    expect(Subscriptions_hasSubscription(subscription)).to.equal(false);
    Capabilities_hasLocal("graphs");
    expect(subscription).to.deep.equal({ apple: [], google: [] });
    expect(Subscriptions_hasSubscription(subscription)).to.equal(false);
  });

  it("defaults to an embedded, private, local application", () => {
    expect(DevFitConfig.applicationId).to.equal("com.devfit.app");
    expect(DevFitConfig.telemetryEnabled).to.equal(false);
    expect(DevFitConfig.otaEnabled).to.equal(false);
    expect(DevFitConfig.officialCloudEnabled).to.equal(false);
    expect(DevFitConfig.storeEnabled).to.equal(false);
  });
});
