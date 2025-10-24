import { Instance } from "../project/instance"
import { Log } from "../util/log"

export namespace FileTime {
  const log = Log.create({ service: "file.time" })
  export const state = Instance.state(() => {
    const read: {
      [sessionID: string]: {
        [path: string]: Date | undefined
      }
    } = {}
    return {
      read,
    }
  })

  export function read(sessionID: string, file: string) {
    log.info("read", { sessionID, file })
    const { read } = state()
    read[sessionID] = read[sessionID] || {}
    read[sessionID][file] = new Date()
  }

  export function get(sessionID: string, file: string) {
    return state().read[sessionID]?.[file]
  }

  export async function assert(sessionID: string, filepath: string) {
    const time = get(sessionID, filepath)
    if (!time) throw new Error(`Você precisa ler o arquivo ${filepath} antes de sobrescrevê-lo. Use a ferramenta de Leitura primeiro`)
    const stats = await Bun.file(filepath).stat()
    if (stats.mtime.getTime() > time.getTime()) {
      throw new Error(
        `Arquivo ${filepath} foi modificado desde a última leitura.\nÚltima modificação: ${stats.mtime.toISOString()}\nÚltima leitura: ${time.toISOString()}\n\nPor favor, leia o arquivo novamente antes de modificá-lo.`,
      )
    }
  }
}
