import { playerEvidenceTemplateCsv } from "../../modeling/playerEvidenceTemplate.js";
import type { CliArguments } from "../arguments.js";
import { playerEvidenceQueue } from "../evidenceQueues.js";

export const runEvidenceTemplateCommand = async (arguments_: CliArguments): Promise<void> => {
  console.log(playerEvidenceTemplateCsv(await playerEvidenceQueue(arguments_, "evidence-template")));
};
