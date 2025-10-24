import { cmd } from "./cmd"

interface SessionStats {
  totalSessions: number
  totalMessages: number
  totalCost: number
  totalTokens: {
    input: number
    output: number
    reasoning: number
    cache: {
      read: number
      write: number
    }
  }
  toolUsage: Record<string, number>
  dateRange: {
    earliest: number
    latest: number
  }
  days: number
  costPerDay: number
}

export const StatsCommand = cmd({
  command: "stats",
  handler: async () => {},
})

export function displayStats(stats: SessionStats) {
  const width = 56

  function renderRow(label: string, value: string): string {
    const availableWidth = width - 1
    const paddingNeeded = availableWidth - label.length - value.length
    const padding = Math.max(0, paddingNeeded)
    return `│${label}${" ".repeat(padding)}${value} │`
  }

  // Overview section
  console.log("┌────────────────────────────────────────────────────────┐")
  console.log("│                    VISÃO GERAL                         │")
  console.log("├────────────────────────────────────────────────────────┤")
  console.log(renderRow("Sessões", stats.totalSessions.toLocaleString()))
  console.log(renderRow("Mensagens", stats.totalMessages.toLocaleString()))
  console.log(renderRow("Dias", stats.days.toString()))
  console.log("└────────────────────────────────────────────────────────┘")
  console.log()

  // Cost & Tokens section
  console.log("┌────────────────────────────────────────────────────────┐")
  console.log("│                  CUSTO & TOKENS                        │")
  console.log("├────────────────────────────────────────────────────────┤")
  const cost = isNaN(stats.totalCost) ? 0 : stats.totalCost
  const costPerDay = isNaN(stats.costPerDay) ? 0 : stats.costPerDay
  console.log(renderRow("Custo Total", `$${cost.toFixed(2)}`))
  console.log(renderRow("Custo/Dia", `$${costPerDay.toFixed(2)}`))
  console.log(renderRow("Entrada", formatNumber(stats.totalTokens.input)))
  console.log(renderRow("Saída", formatNumber(stats.totalTokens.output)))
  console.log(renderRow("Cache Lido", formatNumber(stats.totalTokens.cache.read)))
  console.log(renderRow("Cache Escrito", formatNumber(stats.totalTokens.cache.write)))
  console.log("└────────────────────────────────────────────────────────┘")
  console.log()

  // Tool Usage section
  if (Object.keys(stats.toolUsage).length > 0) {
    const sortedTools = Object.entries(stats.toolUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)

    console.log("┌────────────────────────────────────────────────────────┐")
    console.log("│                  USO DE FERRAMENTAS                    │")
    console.log("├────────────────────────────────────────────────────────┤")

    const maxCount = Math.max(...sortedTools.map(([, count]) => count))
    const totalToolUsage = Object.values(stats.toolUsage).reduce((a, b) => a + b, 0)

    for (const [tool, count] of sortedTools) {
      const barLength = Math.max(1, Math.floor((count / maxCount) * 20))
      const bar = "█".repeat(barLength)
      const percentage = ((count / totalToolUsage) * 100).toFixed(1)

      const content = ` ${tool.padEnd(10)} ${bar.padEnd(20)} ${count.toString().padStart(3)} (${percentage.padStart(4)}%)`
      const padding = Math.max(0, width - content.length)
      console.log(`│${content}${" ".repeat(padding)} │`)
    }
    console.log("└────────────────────────────────────────────────────────┘")
  }
  console.log()
}
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M"
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K"
  }
  return num.toString()
}
