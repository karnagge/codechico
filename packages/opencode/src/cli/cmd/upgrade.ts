import type { Argv } from "yargs"
import { UI } from "../ui"
import * as prompts from "@clack/prompts"
import { Installation } from "../../installation"

export const UpgradeCommand = {
  command: "upgrade [target]",
  describe: "atualizar opencode para a versão mais recente ou uma específica",
  builder: (yargs: Argv) => {
    return yargs
      .positional("target", {
        describe: "versão para atualizar, por exemplo '0.1.48' ou 'v0.1.48'",
        type: "string",
      })
      .option("method", {
        alias: "m",
        describe: "método de instalação a usar",
        type: "string",
        choices: ["curl", "npm", "pnpm", "bun", "brew"],
      })
  },
  handler: async (args: { target?: string; method?: string }) => {
    UI.empty()
    UI.println(UI.logo("  "))
    UI.empty()
    prompts.intro("Atualização")
    const detectedMethod = await Installation.method()
    const method = (args.method as Installation.Method) ?? detectedMethod
    if (method === "unknown") {
      prompts.log.error(`opencode está instalado em ${process.execPath} e pode ser gerenciado por um gerenciador de pacotes`)
      const install = await prompts.select({
        message: "Instalar mesmo assim?",
        options: [
          { label: "Sim", value: true },
          { label: "Não", value: false },
        ],
        initialValue: false,
      })
      if (!install) {
        prompts.outro("Pronto!")
        return
      }
    }
    prompts.log.info("Usando método: " + method)
    const target = args.target ? args.target.replace(/^v/, "") : await Installation.latest()

    if (Installation.VERSION === target) {
      prompts.log.warn(`Atualização ignorada: ${target} já está instalado`)
      prompts.outro("Pronto!")
      return
    }

    prompts.log.info(`De ${Installation.VERSION} → ${target}`)
    const spinner = prompts.spinner()
    spinner.start("Atualizando...")
    const err = await Installation.upgrade(method, target).catch((err) => err)
    if (err) {
      spinner.stop("Atualização falhou", 1)
      if (err instanceof Installation.UpgradeFailedError) prompts.log.error(err.data.stderr)
      else if (err instanceof Error) prompts.log.error(err.message)
      prompts.outro("Pronto!")
      return
    }
    spinner.stop("Atualização concluída!")
    prompts.outro("Pronto!")
  },
}
