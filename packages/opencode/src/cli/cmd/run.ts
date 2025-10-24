import type { Argv } from "yargs"
import path from "path"
import { Bus } from "../../bus"
import { Provider } from "../../provider/provider"
import { Session } from "../../session"
import { UI } from "../ui"
import { cmd } from "./cmd"
import { Flag } from "../../flag/flag"
import { Config } from "../../config/config"
import { bootstrap } from "../bootstrap"
import { MessageV2 } from "../../session/message-v2"
import { Identifier } from "../../id/id"
import { Agent } from "../../agent/agent"
import { Command } from "../../command"
import { SessionPrompt } from "../../session/prompt"
import { EOL } from "os"

const TOOL: Record<string, [string, string]> = {
  todowrite: ["Tarefa", UI.Style.TEXT_WARNING_BOLD],
  todoread: ["Tarefa", UI.Style.TEXT_WARNING_BOLD],
  bash: ["Terminal", UI.Style.TEXT_DANGER_BOLD],
  edit: ["Editar", UI.Style.TEXT_SUCCESS_BOLD],
  glob: ["Buscar", UI.Style.TEXT_INFO_BOLD],
  grep: ["Procurar", UI.Style.TEXT_INFO_BOLD],
  list: ["Listar", UI.Style.TEXT_INFO_BOLD],
  read: ["Ler", UI.Style.TEXT_HIGHLIGHT_BOLD],
  write: ["Escrever", UI.Style.TEXT_SUCCESS_BOLD],
  websearch: ["Pesquisar", UI.Style.TEXT_DIM_BOLD],
}

export const RunCommand = cmd({
  command: "run [message..]",
  describe: "executar opencode com uma mensagem",
  builder: (yargs: Argv) => {
    return yargs
      .positional("message", {
        describe: "mensagem para enviar",
        type: "string",
        array: true,
        default: [],
      })
      .option("command", {
        describe: "comando para executar, use message para os argumentos",
        type: "string",
      })
      .option("continue", {
        alias: ["c"],
        describe: "continuar a última sessão",
        type: "boolean",
      })
      .option("session", {
        alias: ["s"],
        describe: "id da sessão para continuar",
        type: "string",
      })
      .option("share", {
        type: "boolean",
        describe: "compartilhar a sessão",
      })
      .option("model", {
        type: "string",
        alias: ["m"],
        describe: "modelo a usar no formato provedor/modelo",
      })
      .option("agent", {
        type: "string",
        describe: "agente a usar",
      })
      .option("format", {
        type: "string",
        choices: ["default", "json"],
        default: "default",
        describe: "formato: default (formatado) ou json (eventos JSON puros)",
      })
      .option("file", {
        alias: ["f"],
        type: "string",
        array: true,
        describe: "arquivo(s) para anexar à mensagem",
      })
  },
  handler: async (args) => {
    let message = args.message.join(" ")

    let fileParts: any[] = []
    if (args.file) {
      const files = Array.isArray(args.file) ? args.file : [args.file]

      for (const filePath of files) {
        const resolvedPath = path.resolve(process.cwd(), filePath)
        const file = Bun.file(resolvedPath)
        const stats = await file.stat().catch(() => {})
        if (!stats) {
          UI.error(`Arquivo não encontrado: ${filePath}`)
          process.exit(1)
        }
        if (!(await file.exists())) {
          UI.error(`Arquivo não encontrado: ${filePath}`)
          process.exit(1)
        }

        const stat = await file.stat()
        const mime = stat.isDirectory() ? "application/x-directory" : "text/plain"

        fileParts.push({
          type: "file",
          url: `file://${resolvedPath}`,
          filename: path.basename(resolvedPath),
          mime,
        })
      }
    }

    if (!process.stdin.isTTY) message += "\n" + (await Bun.stdin.text())

    if (message.trim().length === 0 && !args.command) {
      UI.error("Você precisa fornecer uma mensagem ou um comando")
      process.exit(1)
    }

    await bootstrap(process.cwd(), async () => {
      if (args.command) {
        const exists = await Command.get(args.command)
        if (!exists) {
          UI.error(`Comando "${args.command}" não encontrado`)
          process.exit(1)
        }
      }
      const session = await (async () => {
        if (args.continue) {
          const it = Session.list()
          try {
            for await (const s of it) {
              if (s.parentID === undefined) {
                return s
              }
            }
            return
          } finally {
            await it.return()
          }
        }

        if (args.session) return Session.get(args.session)

        return Session.create({})
      })()

      if (!session) {
        UI.error("Sessão não encontrada")
        process.exit(1)
      }

      const cfg = await Config.get()
      if (cfg.share === "auto" || Flag.OPENCODE_AUTO_SHARE || args.share) {
        try {
          await Session.share(session.id)
          UI.println(UI.Style.TEXT_INFO_BOLD + "~  https://opencode.ai/s/" + session.id.slice(-8))
        } catch (error) {
          if (error instanceof Error && error.message.includes("disabled")) {
            UI.println(UI.Style.TEXT_DANGER_BOLD + "!  " + error.message)
          } else {
            throw error
          }
        }
      }

      const agent = await (async () => {
        if (args.agent) return Agent.get(args.agent)
        const build = Agent.get("build")
        if (build) return build
        return Agent.list().then((x) => x[0])
      })()

      const { providerID, modelID } = await (async () => {
        if (args.model) return Provider.parseModel(args.model)
        if (agent.model) return agent.model
        return await Provider.defaultModel()
      })()

      function printEvent(color: string, type: string, title: string) {
        UI.println(
          color + `|`,
          UI.Style.TEXT_NORMAL + UI.Style.TEXT_DIM + ` ${type.padEnd(7, " ")}`,
          "",
          UI.Style.TEXT_NORMAL + title,
        )
      }

      function outputJsonEvent(type: string, data: any) {
        if (args.format === "json") {
          const jsonEvent = {
            type,
            timestamp: Date.now(),
            sessionID: session?.id,
            ...data,
          }
          process.stdout.write(JSON.stringify(jsonEvent) + EOL)
          return true
        }
        return false
      }

      const messageID = Identifier.ascending("message")

      Bus.subscribe(MessageV2.Event.PartUpdated, async (evt) => {
        if (evt.properties.part.sessionID !== session.id) return
        if (evt.properties.part.messageID === messageID) return
        const part = evt.properties.part

        if (part.type === "tool" && part.state.status === "completed") {
          if (outputJsonEvent("tool_use", { part })) return
          const [tool, color] = TOOL[part.tool] ?? [part.tool, UI.Style.TEXT_INFO_BOLD]
          const title =
            part.state.title ||
            (Object.keys(part.state.input).length > 0 ? JSON.stringify(part.state.input) : "Unknown")

          printEvent(color, tool, title)

          if (part.tool === "bash" && part.state.output && part.state.output.trim()) {
            UI.println()
            UI.println(part.state.output)
          }
        }

        if (part.type === "step-start") {
          if (outputJsonEvent("step_start", { part })) return
        }

        if (part.type === "step-finish") {
          if (outputJsonEvent("step_finish", { part })) return
        }

        if (part.type === "text") {
          const text = part.text
          const isPiped = !process.stdout.isTTY

          if (part.time?.end) {
            if (outputJsonEvent("text", { part })) return
            if (!isPiped) UI.println()
            process.stdout.write((isPiped ? text : UI.markdown(text)) + EOL)
            if (!isPiped) UI.println()
          }
        }
      })

      let errorMsg: string | undefined
      Bus.subscribe(Session.Event.Error, async (evt) => {
        const { sessionID, error } = evt.properties
        if (sessionID !== session.id || !error) return
        let err = String(error.name)

        if ("data" in error && error.data && "message" in error.data) {
          err = error.data.message
        }
        errorMsg = errorMsg ? errorMsg + EOL + err : err

        if (outputJsonEvent("error", { error })) return
        UI.error(err)
      })

      await (async () => {
        if (args.command) {
          return await SessionPrompt.command({
            messageID,
            sessionID: session.id,
            agent: agent.name,
            model: providerID + "/" + modelID,
            command: args.command,
            arguments: message,
          })
        }
        return await SessionPrompt.prompt({
          sessionID: session.id,
          messageID,
          model: {
            providerID,
            modelID,
          },
          agent: agent.name,
          parts: [
            ...fileParts,
            {
              id: Identifier.ascending("part"),
              type: "text",
              text: message,
            },
          ],
        })
      })()
      if (errorMsg) process.exit(1)
    })
  },
})
