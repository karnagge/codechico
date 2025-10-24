import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import { Global } from "../../global"
import { Agent } from "../../agent/agent"
import path from "path"
import matter from "gray-matter"
import { Instance } from "../../project/instance"

const AgentCreateCommand = cmd({
  command: "create",
  describe: "criar um novo agente",
  async handler() {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("Criar agente")
        const project = Instance.project

        let scope: "global" | "project" = "global"
        if (project.vcs === "git") {
          const scopeResult = await prompts.select({
            message: "Localização",
            options: [
              {
                label: "Projeto atual",
                value: "project" as const,
                hint: Instance.worktree,
              },
              {
                label: "Global",
                value: "global" as const,
                hint: Global.Path.config,
              },
            ],
          })
          if (prompts.isCancel(scopeResult)) throw new UI.CancelledError()
          scope = scopeResult
        }

        const query = await prompts.text({
          message: "Descrição",
          placeholder: "O que esse agente deve fazer?",
          validate: (x) => (x && x.length > 0 ? undefined : "Obrigatório"),
        })
        if (prompts.isCancel(query)) throw new UI.CancelledError()

        const spinner = prompts.spinner()

        spinner.start("Gerando configuração do agente...")
        const generated = await Agent.generate({ description: query }).catch((error) => {
          spinner.stop(`A IA falhou ao gerar o agente: ${error.message}`, 1)
          throw new UI.CancelledError()
        })
        spinner.stop(`Agente ${generated.identifier} gerado com sucesso!`)

        const availableTools = [
          "bash",
          "read",
          "write",
          "edit",
          "list",
          "glob",
          "grep",
          "webfetch",
          "task",
          "todowrite",
          "todoread",
        ]

        const selectedTools = await prompts.multiselect({
          message: "Selecione as ferramentas para habilitar",
          options: availableTools.map((tool) => ({
            label: tool,
            value: tool,
          })),
          initialValues: availableTools,
        })
        if (prompts.isCancel(selectedTools)) throw new UI.CancelledError()

        const modeResult = await prompts.select({
          message: "Modo do agente",
          options: [
            {
              label: "Todos",
              value: "all" as const,
              hint: "Pode funcionar tanto como agente principal quanto subagente",
            },
            {
              label: "Principal",
              value: "primary" as const,
              hint: "Atua como agente principal",
            },
            {
              label: "Subagente",
              value: "subagent" as const,
              hint: "Pode ser usado como subagente por outros agentes",
            },
          ],
          initialValue: "all",
        })
        if (prompts.isCancel(modeResult)) throw new UI.CancelledError()

        const tools: Record<string, boolean> = {}
        for (const tool of availableTools) {
          if (!selectedTools.includes(tool)) {
            tools[tool] = false
          }
        }

        const frontmatter: any = {
          description: generated.whenToUse,
          mode: modeResult,
        }
        if (Object.keys(tools).length > 0) {
          frontmatter.tools = tools
        }

        const content = matter.stringify(generated.systemPrompt, frontmatter)
        const filePath = path.join(
          scope === "global" ? Global.Path.config : path.join(Instance.worktree, ".opencode"),
          `agent`,
          `${generated.identifier}.md`,
        )

        await Bun.write(filePath, content)

        prompts.log.success(`Agente criado: ${filePath}`)
        prompts.outro("Pronto!")
      },
    })
  },
})

export const AgentCommand = cmd({
  command: "agent",
  describe: "gerenciar agentes",
  builder: (yargs) => yargs.command(AgentCreateCommand).demandCommand(),
  async handler() {},
})
