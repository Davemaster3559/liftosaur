import { Service, IProgramDetail } from "../api/service";
import type { IProgramIndexEntry } from "../models/program";
import { DevFit_localClient } from "./localClient";
import catalog from "./programCatalog.generated.json";

export class DevFitService extends Service {
  constructor(client: Window["fetch"]) {
    super(DevFit_localClient(client));
  }

  public async programsIndex(): Promise<IProgramIndexEntry[]> {
    return JSON.parse(JSON.stringify(catalog.index));
  }

  public async programDetail(id: string, category: string = "builtin"): Promise<IProgramDetail> {
    const programs = catalog.programs as Record<string, IProgramDetail | undefined>;
    const program = programs[`${category}/${id}`] ?? programs[`community/${id}`];
    if (!program) throw new Error(`Program ${id} is not bundled with DevFit. Import its JSON or Liftoscript instead.`);
    return JSON.parse(JSON.stringify(program));
  }
}
