import { runCli } from "./cli/runCli.js";

runCli(process.argv.slice(2)).then(exitCode => {
  if (exitCode !== undefined) process.exitCode = exitCode;
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
