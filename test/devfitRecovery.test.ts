import { expect } from "chai";
import { getInitialState } from "../src/ducks/reducer";
import { Persistence, IPersistenceStore } from "../src/utils/persistence";

describe("DevFit local recovery", () => {
  const offline: Window["fetch"] = async () => { throw new Error("Unexpected network request"); };
  it("blocks automatic saves when raw JSON is unreadable", async () => {
    const state = await getInitialState(offline, { url: new URL("https://www.liftosaur.com/app/?nosync=true"),
      rawStorage: "{damaged", deviceId: "test" });
    expect(state.errors.corruptedstorage?.local).to.equal(true);
    expect(state.nosync).to.equal(true);
  });
  it("detects unreadable shards and exports their exact values without writing or including other profiles", async () => {
    const data: Record<string, string> = {
      liftosaur_account: "{damaged",
      "liftosaurshard:liftosaur_account:history": "[damaged",
      "liftosaurshard:liftosaur_other:history": "private other profile",
    };
    let writes = 0;
    const store: IPersistenceStore = { get: async (key) => data[key],
      getAllKeys: async () => Object.keys(data), setMany: async () => { writes += 1; } };
    const persistence = new Persistence(store);
    expect(await persistence.load("liftosaur_account")).to.equal(undefined);
    expect(await persistence.hasStoredData("liftosaur_account")).to.equal(true);
    expect(await persistence.hasStoredData("liftosaur_new")).to.equal(false);
    expect(await persistence.recoverySnapshot("liftosaur_account")).to.eql({
      liftosaur_account: "{damaged", "liftosaurshard:liftosaur_account:history": "[damaged" });
    const state = await getInitialState(offline, { url: new URL("https://www.liftosaur.com/app/?nosync=true"),
      hasUnreadableStorage: true, deviceId: "test" });
    expect(state.errors.corruptedstorage?.backup).to.equal(false);
    expect(writes).to.equal(0);
  });
});
