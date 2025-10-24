import { Auth } from "../../auth"
import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import { ModelsDev } from "../../provider/models"
import { map, pipe, sortBy, values } from "remeda"
import path from "path"
import os from "os"
import { Global } from "../../global"
import { Plugin } from "../../plugin"
import { Instance } from "../../project/instance"

export const AuthCommand = cmd({
  command: "auth",
  describe: "gerenciar credenciais",
  builder: (yargs) =>
    yargs.command(AuthLoginCommand).command(AuthLogoutCommand).command(AuthListCommand).demandCommand(),
  async handler() {},
})

export const AuthListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "listar provedores",
  async handler() {
    UI.empty()
    const authPath = path.join(Global.Path.data, "auth.json")
    const homedir = os.homedir()
    const displayPath = authPath.startsWith(homedir) ? authPath.replace(homedir, "~") : authPath
    prompts.intro(`Credenciais ${UI.Style.TEXT_DIM}${displayPath}`)
    const results = await Auth.all().then((x) => Object.entries(x))
    const database = await ModelsDev.get()

    for (const [providerID, result] of results) {
      const name = database[providerID]?.name || providerID
      prompts.log.info(`${name} ${UI.Style.TEXT_DIM}${result.type}`)
    }

    prompts.outro(`${results.length} credenciais`)

    // Environment variables section
    const activeEnvVars: Array<{ provider: string; envVar: string }> = []

    for (const [providerID, provider] of Object.entries(database)) {
      for (const envVar of provider.env) {
        if (process.env[envVar]) {
          activeEnvVars.push({
            provider: provider.name || providerID,
            envVar,
          })
        }
      }
    }

    if (activeEnvVars.length > 0) {
      UI.empty()
      prompts.intro("Ambiente")

      for (const { provider, envVar } of activeEnvVars) {
        prompts.log.info(`${provider} ${UI.Style.TEXT_DIM}${envVar}`)
      }

      prompts.outro(`${activeEnvVars.length} variável${activeEnvVars.length === 1 ? "" : "is"} de ambiente`)
    }
  },
})

export const AuthLoginCommand = cmd({
  command: "login [url]",
  describe: "fazer login em um provedor",
  builder: (yargs) =>
    yargs.positional("url", {
      describe: "provedor de autenticação opencode",
      type: "string",
    }),
  async handler(args) {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("Adicionar credencial")
        if (args.url) {
          const wellknown = await fetch(`${args.url}/.well-known/opencode`).then((x) => x.json())
          prompts.log.info(`Executando \`${wellknown.auth.command.join(" ")}\``)
          const proc = Bun.spawn({
            cmd: wellknown.auth.command,
            stdout: "pipe",
          })
          const exit = await proc.exited
          if (exit !== 0) {
            prompts.log.error("Falhou")
            prompts.outro("Pronto!")
            return
          }
          const token = await new Response(proc.stdout).text()
          await Auth.set(args.url, {
            type: "wellknown",
            key: wellknown.auth.env,
            token: token.trim(),
          })
          prompts.log.success("Login efetuado em " + args.url)
          prompts.outro("Pronto!")
          return
        }
        await ModelsDev.refresh().catch(() => {})
        const providers = await ModelsDev.get()
        const priority: Record<string, number> = {
          opencode: 0,
          anthropic: 1,
          "github-copilot": 2,
          openai: 3,
          google: 4,
          openrouter: 5,
          vercel: 6,
        }
        let provider = await prompts.autocomplete({
          message: "Selecione o provedor",
          maxItems: 8,
          options: [
            ...pipe(
              providers,
              values(),
              sortBy(
                (x) => priority[x.id] ?? 99,
                (x) => x.name ?? x.id,
              ),
              map((x) => ({
                label: x.name,
                value: x.id,
                hint: priority[x.id] <= 1 ? "recomendado" : undefined,
              })),
            ),
            {
              value: "other",
              label: "Outro",
            },
          ],
        })

        if (prompts.isCancel(provider)) throw new UI.CancelledError()

        const plugin = await Plugin.list().then((x) => x.find((x) => x.auth?.provider === provider))
        if (plugin && plugin.auth) {
          let index = 0
          if (plugin.auth.methods.length > 1) {
            const method = await prompts.select({
              message: "Método de login",
              options: [
                ...plugin.auth.methods.map((x, index) => ({
                  label: x.label,
                  value: index.toString(),
                })),
              ],
            })
            if (prompts.isCancel(method)) throw new UI.CancelledError()
            index = parseInt(method)
          }
          const method = plugin.auth.methods[index]
          if (method.type === "oauth") {
            await new Promise((resolve) => setTimeout(resolve, 10))
            const authorize = await method.authorize()

            if (authorize.url) {
              prompts.log.info("Acesse: " + authorize.url)
            }

            if (authorize.method === "auto") {
              if (authorize.instructions) {
                prompts.log.info(authorize.instructions)
              }
              const spinner = prompts.spinner()
              spinner.start("Aguardando autorização...")
              const result = await authorize.callback()
              if (result.type === "failed") {
                spinner.stop("Falha ao autorizar", 1)
              }
              if (result.type === "success") {
                if ("refresh" in result) {
                  await Auth.set(provider, {
                    type: "oauth",
                    refresh: result.refresh,
                    access: result.access,
                    expires: result.expires,
                  })
                }
                if ("key" in result) {
                  await Auth.set(provider, {
                    type: "api",
                    key: result.key,
                  })
                }
                spinner.stop("Login realizado com sucesso!")
              }
            }

            if (authorize.method === "code") {
              const code = await prompts.text({
                message: "Cole o código de autorização aqui: ",
                validate: (x) => (x && x.length > 0 ? undefined : "Obrigatório"),
              })
              if (prompts.isCancel(code)) throw new UI.CancelledError()
              const result = await authorize.callback(code)
              if (result.type === "failed") {
                prompts.log.error("Falha ao autorizar")
              }
              if (result.type === "success") {
                if ("refresh" in result) {
                  await Auth.set(provider, {
                    type: "oauth",
                    refresh: result.refresh,
                    access: result.access,
                    expires: result.expires,
                  })
                }
                if ("key" in result) {
                  await Auth.set(provider, {
                    type: "api",
                    key: result.key,
                  })
                }
                prompts.log.success("Login realizado com sucesso!")
              }
            }
            prompts.outro("Pronto!")
            return
          }
        }

        if (provider === "other") {
          provider = await prompts.text({
            message: "Digite o id do provedor",
            validate: (x) => (x && x.match(/^[0-9a-z-]+$/) ? undefined : "apenas a-z, 0-9 e hífens"),
          })
          if (prompts.isCancel(provider)) throw new UI.CancelledError()
          provider = provider.replace(/^@ai-sdk\//, "")
          if (prompts.isCancel(provider)) throw new UI.CancelledError()
          prompts.log.warn(
            `Isso apenas armazena a credencial para ${provider} - você precisará configurá-lo no opencode.json, veja a documentação para exemplos.`,
          )
        }

        if (provider === "amazon-bedrock") {
          prompts.log.info(
            "Amazon bedrock pode ser configurado com variáveis de ambiente AWS padrão como AWS_BEARER_TOKEN_BEDROCK, AWS_PROFILE ou AWS_ACCESS_KEY_ID",
          )
          prompts.outro("Pronto!")
          return
        }

        if (provider === "google-vertex") {
          prompts.log.info(
            "Google Cloud Vertex AI usa Application Default Credentials. Configure GOOGLE_APPLICATION_CREDENTIALS ou execute 'gcloud auth application-default login'. Opcionalmente configure GOOGLE_CLOUD_PROJECT e GOOGLE_CLOUD_LOCATION (ou VERTEX_LOCATION)",
          )
          prompts.outro("Pronto!")
          return
        }

        if (provider === "opencode") {
          prompts.log.info("Crie uma chave API em https://opencode.ai/auth")
        }

        if (provider === "vercel") {
          prompts.log.info("Você pode criar uma chave API em https://vercel.link/ai-gateway-token")
        }

        const key = await prompts.password({
          message: "Digite sua chave API",
          validate: (x) => (x && x.length > 0 ? undefined : "Obrigatório"),
        })
        if (prompts.isCancel(key)) throw new UI.CancelledError()
        await Auth.set(provider, {
          type: "api",
          key,
        })

        prompts.outro("Pronto!")
      },
    })
  },
})

export const AuthLogoutCommand = cmd({
  command: "logout",
  describe: "fazer logout de um provedor configurado",
  async handler() {
    UI.empty()
    const credentials = await Auth.all().then((x) => Object.entries(x))
    prompts.intro("Remover credencial")
    if (credentials.length === 0) {
      prompts.log.error("Nenhuma credencial encontrada")
      return
    }
    const database = await ModelsDev.get()
    const providerID = await prompts.select({
      message: "Selecione o provedor",
      options: credentials.map(([key, value]) => ({
        label: (database[key]?.name || key) + UI.Style.TEXT_DIM + " (" + value.type + ")",
        value: key,
      })),
    })
    if (prompts.isCancel(providerID)) throw new UI.CancelledError()
    await Auth.remove(providerID)
    prompts.outro("Logout realizado com sucesso!")
  },
})
