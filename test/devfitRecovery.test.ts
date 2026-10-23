import { expect } from "chai";
import { getInitialState } from "../src/ducks/reducer";
import { Persistence, IPersistenceStore } from "../src/utils/persistence";
import { Storage_getDefault } from "../src/models/storage";

describe("DevFit local recovery", () => {
  const offline: Window["fetch"] = async () => {
    throw new Error("Unexpected network request");
  };
  it("blocks automatic saves when raw JSON is unreadable", async () => {
    const state = await getInitialState(offline, {
      url: new URL("https://www.liftosaur.com/app/?nosync=true"),
      rawStorage: "{damaged",
      deviceId: "test",
    });
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
    const store: IPersistenceStore = {
      get: async (key) => data[key],
      getAllKeys: async () => Object.keys(data),
      setMany: async () => {
        writes += 1;
      },
    };
    const persistence = new Persistence(store);
    expect(await persistence.load("liftosaur_account")).to.equal(undefined);
    expect(await persistence.hasStoredData("liftosaur_account")).to.equal(true);
    expect(await persistence.hasStoredData("liftosaur_new")).to.equal(false);
    expect(await persistence.recoverySnapshot("liftosaur_account")).to.eql({
      liftosaur_account: "{damaged",
      "liftosaurshard:liftosaur_account:history": "[damaged",
    });
    const state = await getInitialState(offline, {
      url: new URL("https://www.liftosaur.com/app/?nosync=true"),
      hasUnreadableStorage: true,
      deviceId: "test",
    });
    expect(state.errors.corruptedstorage?.backup).to.equal(false);
    expect(writes).to.equal(0);
  });
  it("does not silently replace damaged current shards with a stale legacy backup", async () => {
    const old = { storage: Storage_getDefault() };
    const data: Record<string, string> = {
      account: JSON.stringify(old),
      "liftosaurshard:account:manifest": "{damaged",
      "liftosaurshard:account:history": "[newer but damaged",
    };
    const persistence = new Persistence({
      get: async (key) => data[key],
      getAllKeys: async () => Object.keys(data),
      setMany: async () => {
        throw new Error("Unexpected write");
      },
    });
    expect(await persistence.load("account", true)).to.equal(undefined);
    expect(await persistence.hasStoredData("account")).to.equal(true);
    expect((await persistence.recoverySnapshot("account"))["liftosaurshard:account:history"]).to.equal(
      "[newer but damaged"
    );
  });
});
