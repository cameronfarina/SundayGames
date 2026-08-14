import { keeperSummary } from "../../keeperModel.js";

export const runKeepersCommand = (): void => {
  console.log(JSON.stringify(keeperSummary(), null, 2));
};
