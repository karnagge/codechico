import type { Argv } from "yargs"
import { Session } from "../../session"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { UI } from "../ui"
import * as prompts from "@clack/prompts"
import { EOL } from "os"

export const ExportCommand = cmd({
  command: "export [sessionID]",
  describe: "exportar dados da sessão como JSON",
  builder: (yargs: Argv) => {
    return yargs.positional("sessionID", {
      describe: "id da sessão para exportar",
      type: "string",
    })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      let sessionID = args.sessionID

      if (!sessionID) {
        UI.empty()
        prompts.intro("Exportar sessão")

        const sessions = []
        for await (const session of Session.list()) {
          sessions.push(session)
        }

        if (sessions.length === 0) {
          prompts.log.error("Nenhuma sessão encontrada")
          prompts.outro("Pronto!")
          return
        }

        sessions.sort((a, b) => b.time.updated - a.time.updated)

        const selectedSession = await prompts.autocomplete({
          message: "Selecione a sessão para exportar",
          maxItems: 10,
          options: sessions.map((session) => ({
            label: session.title,
            value: session.id,
            hint: `${new Date(session.time.updated).toLocaleString()} • ${session.id.slice(-8)}`,
          })),
        })

        if (prompts.isCancel(selectedSession)) {
          throw new UI.CancelledError()
        }

        sessionID = selectedSession as string

        prompts.outro("Exportando sessão...")
      }

      try {
        const sessionInfo = await Session.get(sessionID!)
        const messages = await Session.messages(sessionID!)

        const exportData = {
          info: sessionInfo,
          messages: messages.map((msg) => ({
            info: msg.info,
            parts: msg.parts,
          })),
        }

        process.stdout.write(JSON.stringify(exportData, null, 2))
        process.stdout.write(EOL)
      } catch (error) {
        UI.error(`Sessão não encontrada: ${sessionID!}`)
        process.exit(1)
      }
    })
  },
})
