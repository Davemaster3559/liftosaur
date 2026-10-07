import { getIdbKey } from "../ducks/reducer";
import { IThunk } from "../ducks/types";
import { Exporter_toFile } from "../utils/exporter";
import { Dialog_alert } from "../utils/dialog";

export function DevFit_exportRecovery(): IThunk {
  return async (_dispatch, _getState, env) => {
    try {
      const key = await getIdbKey();
      const raw = await env.persistence.recoverySnapshot(key);
      Exporter_toFile(
        `devfit-recovery-${Date.now()}.json`,
        JSON.stringify({ format: "devfit-raw-recovery-v1", raw }, null, 2)
      );
    } catch (error) {
      Dialog_alert(`Could not export recovery data: ${String(error)}`);
    }
  };
}
