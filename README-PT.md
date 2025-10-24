# CodeChico - Versão em Português 🇧🇷

Esta é uma versão customizada do OpenCode com suporte completo para comandos em português.

## 🚀 Instalação Rápida

```bash
./install-local.sh
```

Isso irá compilar e instalar o CodeChico em `~/.local/bin/codechico`.

## 📦 Compilação Manual

```bash
cd packages/opencode
./script/build-dev.sh
```

## 🎯 Comandos em Português

Dentro da interface TUI, você pode usar os seguintes comandos:

### Comandos Principais
- `/modelos` - Listar modelos disponíveis
- `/ajuda` - Mostrar ajuda
- `/agentes` - Listar agentes
- `/temas` - Listar temas

### Sessões
- `/nova` ou `/limpar` - Nova sessão
- `/sessoes` ou `/retomar` ou `/continuar` - Listar/retomar sessões
- `/exportar` - Exportar conversa
- `/compartilhar` - Compartilhar sessão
- `/descompartilhar` - Parar compartilhamento
- `/compactar` ou `/resumir` - Compactar sessão

### Navegação
- `/linha` ou `/historico` - Linha do tempo
- `/detalhes` - Alternar detalhes
- `/pensamento` - Alternar blocos de pensamento

### Edição
- `/desfazer` - Desfazer última mensagem
- `/refazer` - Refazer mensagem
- `/iniciar` - Criar/atualizar AGENTS.md

### Sistema
- `/sair` - Sair do aplicativo

## 🌐 Comandos Bilíngues

Todos os comandos funcionam tanto em **português** quanto em **inglês**:

| Português | Inglês |
|-----------|--------|
| `/modelos` | `/models` |
| `/ajuda` | `/help` |
| `/agentes` | `/agents` |
| `/nova` | `/new` |
| `/sair` | `/exit` |

## 🔧 Uso

```bash
# Iniciar interface
codechico

# Ver versão
codechico --version

# Listar modelos
codechico models

# Ver ajuda completa
codechico --help
```

## 📝 Desenvolvimento

### Estrutura Modificada

- `packages/tui/internal/commands/command.go` - Comandos traduzidos
- `packages/tui/internal/completions/commands.go` - Mensagens de completamento
- `packages/tui/internal/components/commands/commands.go` - Componentes de UI
- `packages/opencode/script/build-dev.sh` - Script de build personalizado
- `packages/script/src/index.ts` - Suporte para OPENCODE_VERSION

### Rebuild após mudanças

```bash
./install-local.sh
```

## 🎨 Atalhos de Teclado

- `Ctrl+X M` ou `Ctrl+X` seguido de `M` - Abrir menu de modelos
- `Ctrl+X H` - Mostrar ajuda
- `Ctrl+X N` - Nova sessão
- `Ctrl+X L` - Listar sessões
- `Tab` - Próximo agente
- `Shift+Tab` - Agente anterior
- `F2` - Próximo modelo recente
- `Esc` - Interromper sessão
- `Ctrl+C` ou `Ctrl+X Q` - Sair

## 📚 Documentação Original

Para mais informações, consulte a [documentação oficial do OpenCode](https://opencode.ai/docs).

## ✨ Versão

Versão atual: **0.15.13**
Canal: **dev**
