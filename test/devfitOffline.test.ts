import { expect } from "chai";
import { DevFitService } from "../src/devfit/service";
import { DevFit_localClient } from "../src/devfit/localClient";
import { PlannerProgram_evaluateFull } from "../src/pages/planner/models/plannerProgram";
import { Settings_build } from "../src/models/settings";

describe("DevFit offline services", () => {
  const offline: Window["fetch"] = async () => {
    throw new Error("No internet");
  };

  it("lists and loads bundled programs without internet", async () => {
    const service = new DevFitService(offline);
    const index = await service.programsIndex();
    expect(index.length).to.be.greaterThan(5);
    for (const entry of index) {
      const program = await service.programDetail(entry.id);
      expect(program.planner.weeks.length, entry.id).to.be.greaterThan(0);
    }
  });

  it("keeps separate copies of program templates", async () => {
    const service = new DevFitService(offline);
    const [entry] = await service.programsIndex();
    const first = await service.programDetail(entry.id);
    first.planner.name = "My edited program";
    expect((await service.programDetail(entry.id)).planner.name).not.to.equal(first.planner.name);
  });

  it("evaluates bundled Liftoscript using the existing engine", async () => {
    const service = new DevFitService(offline);
    const program = await service.programDetail("basicBeginner");
    const text = program.planner.weeks.map((week) =>
      `# ${week.name}\n${week.days.map((day) => `## ${day.name}\n${day.exerciseText}`).join("\n")}`
    ).join("\n");
    const result = PlannerProgram_evaluateFull(text, Settings_build());
    expect(result.evaluatedWeeks.success).to.equal(true);
  });

  it("blocks production API traffic before any transport runs", async () => {
    let calls = 0;
    const client = DevFit_localClient(async () => { calls += 1; return {} as Response; });
    for (const address of ["https://api3.liftosaur.com/api/sync2", "https://www.liftosaur.com/api/event"]) {
      try {
        await client(address, { method: "POST", body: "private training data" });
        expect.fail("Production API should be disabled");
      } catch (error) {
        expect(String(error)).to.include("disabled in DevFit");
      }
    }
    expect(calls).to.equal(0);
    await client("https://www.liftosaur.com/images/exercise.png");
    expect(calls).to.equal(1);
  });
});
