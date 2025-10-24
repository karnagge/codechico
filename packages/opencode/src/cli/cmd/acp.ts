import { ACPServer } from "../../acp/server"
import { cmd } from "./cmd"

export const AcpCommand = cmd({
  command: "acp",
  describe: "Iniciar servidor ACP (Agent Client Protocol)",
  builder: (yargs) => {
    return yargs.option("cwd", {
      describe: "diretório de trabalho",
      type: "string",
      default: process.cwd(),
    })
  },
  handler: async (opts) => {
    if (opts.cwd) process.chdir(opts["cwd"])
    await ACPServer.start()
  },
})
