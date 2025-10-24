import { cmd } from "./cmd"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"

export const McpCommand = cmd({
  command: "mcp",
  builder: (yargs) => yargs.command(McpAddCommand).demandCommand(),
  async handler() {},
})

export const McpAddCommand = cmd({
  command: "add",
  describe: "adicionar um servidor MCP",
  async handler() {
    UI.empty()
    prompts.intro("Adicionar servidor MCP")

    const name = await prompts.text({
      message: "Digite o nome do servidor MCP",
      validate: (x) => (x && x.length > 0 ? undefined : "Obrigatório"),
    })
    if (prompts.isCancel(name)) throw new UI.CancelledError()

    const type = await prompts.select({
      message: "Selecione o tipo de servidor MCP",
      options: [
        {
          label: "Local",
          value: "local",
          hint: "Executar um comando local",
        },
        {
          label: "Remoto",
          value: "remote",
          hint: "Conectar a uma URL remota",
        },
      ],
    })
    if (prompts.isCancel(type)) throw new UI.CancelledError()

    if (type === "local") {
      const command = await prompts.text({
        message: "Digite o comando para executar",
        placeholder: "ex: opencode x @modelcontextprotocol/server-filesystem",
        validate: (x) => (x && x.length > 0 ? undefined : "Obrigatório"),
      })
      if (prompts.isCancel(command)) throw new UI.CancelledError()

      prompts.log.info(`Servidor MCP local "${name}" configurado com o comando: ${command}`)
      prompts.outro("Servidor MCP adicionado com sucesso!")
      return
    }

    if (type === "remote") {
      const url = await prompts.text({
        message: "Digite a URL do servidor MCP",
        placeholder: "ex: https://example.com/mcp",
        validate: (x) => {
          if (!x) return "Obrigatório"
          if (x.length === 0) return "Obrigatório"
          const isValid = URL.canParse(x)
          return isValid ? undefined : "URL inválida"
        },
      })
      if (prompts.isCancel(url)) throw new UI.CancelledError()

      const client = new Client({
        name: "opencode",
        version: "1.0.0",
      })
      const transport = new StreamableHTTPClientTransport(new URL(url))
      await client.connect(transport)
      prompts.log.info(`Servidor MCP remoto "${name}" configurado com a URL: ${url}`)
    }

    prompts.outro("Servidor MCP adicionado com sucesso!")
  },
})
