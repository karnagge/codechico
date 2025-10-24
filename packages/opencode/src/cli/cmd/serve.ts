import { Server } from "../../server/server"
import { cmd } from "./cmd"

export const ServeCommand = cmd({
  command: "serve",
  builder: (yargs) =>
    yargs
      .option("port", {
        alias: ["p"],
        type: "number",
        describe: "porta para escutar",
        default: 0,
      })
      .option("hostname", {
        alias: ["h"],
        type: "string",
        describe: "hostname para escutar",
        default: "127.0.0.1",
      }),
  describe: "iniciar um servidor opencode sem interface",
  handler: async (args) => {
    const hostname = args.hostname
    const port = args.port
    const server = Server.listen({
      port,
      hostname,
    })
    console.log(`🚀 Servidor opencode escutando em http://${server.hostname}:${server.port}`)
    await new Promise(() => {})
    server.stop()
  },
})
