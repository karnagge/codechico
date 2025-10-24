package commands

import (
	"encoding/json"
	"log/slog"
	"slices"
	"strings"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/sst/opencode-sdk-go"
)

type ExecuteCommandMsg Command
type ExecuteCommandsMsg []Command
type CommandExecutedMsg Command

type Keybinding struct {
	RequiresLeader bool
	Key            string
}

func (k Keybinding) Matches(msg tea.KeyPressMsg, leader bool) bool {
	key := k.Key
	key = strings.TrimSpace(key)
	return key == msg.String() && (k.RequiresLeader == leader)
}

type CommandName string
type Command struct {
	Name        CommandName
	Description string
	Keybindings []Keybinding
	Trigger     []string
	Custom      bool
}

func (c Command) Keys() []string {
	var keys []string
	for _, k := range c.Keybindings {
		keys = append(keys, k.Key)
	}
	return keys
}

func (c Command) HasTrigger() bool {
	return len(c.Trigger) > 0
}

func (c Command) PrimaryTrigger() string {
	if len(c.Trigger) > 0 {
		return c.Trigger[0]
	}
	return ""
}

func (c Command) MatchesTrigger(trigger string) bool {
	return slices.Contains(c.Trigger, trigger)
}

type CommandRegistry map[CommandName]Command

func (r CommandRegistry) Sorted() []Command {
	var commands []Command
	for _, command := range r {
		commands = append(commands, command)
	}
	slices.SortFunc(commands, func(a, b Command) int {
		// Priority order: session_new, session_share, model_list, agent_list, app_help first, app_exit last
		priorityOrder := map[CommandName]int{
			SessionNewCommand:   0,
			AppHelpCommand:      1,
			SessionShareCommand: 2,
			ModelListCommand:    3,
			AgentListCommand:    4,
		}

		aPriority, aHasPriority := priorityOrder[a.Name]
		bPriority, bHasPriority := priorityOrder[b.Name]

		if aHasPriority && bHasPriority {
			return aPriority - bPriority
		}
		if aHasPriority {
			return -1
		}
		if bHasPriority {
			return 1
		}
		if a.Name == AppExitCommand {
			return 1
		}
		if b.Name == AppExitCommand {
			return -1
		}
		if a.Custom && !b.Custom {
			return 1
		}
		if !a.Custom && b.Custom {
			return -1
		}

		return strings.Compare(string(a.Name), string(b.Name))
	})
	return commands
}

func (r CommandRegistry) Matches(msg tea.KeyPressMsg, leader bool) []Command {
	var matched []Command
	for _, command := range r.Sorted() {
		if command.Matches(msg, leader) {
			matched = append(matched, command)
		}
	}
	return matched
}

const (
	SessionChildCycleCommand        CommandName = "session_child_cycle"
	SessionChildCycleReverseCommand CommandName = "session_child_cycle_reverse"
	ModelCycleRecentReverseCommand  CommandName = "model_cycle_recent_reverse"
	AgentCycleCommand               CommandName = "agent_cycle"
	AgentCycleReverseCommand        CommandName = "agent_cycle_reverse"
	AppHelpCommand                  CommandName = "app_help"
	SwitchAgentCommand              CommandName = "switch_agent"
	SwitchAgentReverseCommand       CommandName = "switch_agent_reverse"
	EditorOpenCommand               CommandName = "editor_open"
	SessionNewCommand               CommandName = "session_new"
	SessionListCommand              CommandName = "session_list"
	SessionTimelineCommand          CommandName = "session_timeline"
	SessionShareCommand             CommandName = "session_share"
	SessionUnshareCommand           CommandName = "session_unshare"
	SessionInterruptCommand         CommandName = "session_interrupt"
	SessionCompactCommand           CommandName = "session_compact"
	SessionExportCommand            CommandName = "session_export"
	ToolDetailsCommand              CommandName = "tool_details"
	ThinkingBlocksCommand           CommandName = "thinking_blocks"
	ModelListCommand                CommandName = "model_list"
	AgentListCommand                CommandName = "agent_list"
	ModelCycleRecentCommand         CommandName = "model_cycle_recent"
	ThemeListCommand                CommandName = "theme_list"
	FileListCommand                 CommandName = "file_list"
	FileCloseCommand                CommandName = "file_close"
	FileSearchCommand               CommandName = "file_search"
	FileDiffToggleCommand           CommandName = "file_diff_toggle"
	ProjectInitCommand              CommandName = "project_init"
	InputClearCommand               CommandName = "input_clear"
	InputPasteCommand               CommandName = "input_paste"
	InputSubmitCommand              CommandName = "input_submit"
	InputNewlineCommand             CommandName = "input_newline"
	MessagesPageUpCommand           CommandName = "messages_page_up"
	MessagesPageDownCommand         CommandName = "messages_page_down"
	MessagesHalfPageUpCommand       CommandName = "messages_half_page_up"
	MessagesHalfPageDownCommand     CommandName = "messages_half_page_down"
	MessagesPreviousCommand         CommandName = "messages_previous"
	MessagesNextCommand             CommandName = "messages_next"
	MessagesFirstCommand            CommandName = "messages_first"
	MessagesLastCommand             CommandName = "messages_last"
	MessagesLayoutToggleCommand     CommandName = "messages_layout_toggle"
	MessagesCopyCommand             CommandName = "messages_copy"
	MessagesUndoCommand             CommandName = "messages_undo"
	MessagesRedoCommand             CommandName = "messages_redo"
	AppExitCommand                  CommandName = "app_exit"
)

func (k Command) Matches(msg tea.KeyPressMsg, leader bool) bool {
	for _, binding := range k.Keybindings {
		if binding.Matches(msg, leader) {
			return true
		}
	}
	return false
}

func parseBindings(bindings ...string) []Keybinding {
	var parsedBindings []Keybinding
	for _, binding := range bindings {
		if binding == "none" {
			continue
		}
		for p := range strings.SplitSeq(binding, ",") {
			requireLeader := strings.HasPrefix(p, "<leader>")
			keybinding := strings.ReplaceAll(p, "<leader>", "")
			keybinding = strings.TrimSpace(keybinding)
			parsedBindings = append(parsedBindings, Keybinding{
				RequiresLeader: requireLeader,
				Key:            keybinding,
			})
		}
	}
	return parsedBindings
}

func LoadFromConfig(config *opencode.Config, customCommands []opencode.Command) CommandRegistry {
	defaults := []Command{
		{
			Name:        AppHelpCommand,
			Description: "mostrar ajuda",
			Keybindings: parseBindings("<leader>h"),
			Trigger:     []string{"help", "ajuda"},
		},
		{
			Name:        EditorOpenCommand,
			Description: "abrir editor",
			Keybindings: parseBindings("<leader>e"),
			Trigger:     []string{"editor", "editor"},
		},
		{
			Name:        SessionExportCommand,
			Description: "exportar conversa",
			Keybindings: parseBindings("<leader>x"),
			Trigger:     []string{"export", "exportar"},
		},
		{
			Name:        SessionNewCommand,
			Description: "nova sessão",
			Keybindings: parseBindings("<leader>n"),
			Trigger:     []string{"new", "clear", "nova", "limpar"},
		},
		{
			Name:        SessionListCommand,
			Description: "listar sessões",
			Keybindings: parseBindings("<leader>l"),
			Trigger:     []string{"sessions", "resume", "continue", "sessoes", "retomar", "continuar"},
		},
		{
			Name:        SessionTimelineCommand,
			Description: "mostrar linha do tempo",
			Keybindings: parseBindings("<leader>g"),
			Trigger:     []string{"timeline", "history", "goto", "linha", "historico", "ir"},
		},
		{
			Name:        SessionShareCommand,
			Description: "compartilhar sessão",
			Keybindings: parseBindings("<leader>s"),
			Trigger:     []string{"share", "compartilhar"},
		},
		{
			Name:        SessionUnshareCommand,
			Description: "parar compartilhamento",
			Trigger:     []string{"unshare", "descompartilhar"},
		},
		{
			Name:        SessionInterruptCommand,
			Description: "interromper sessão",
			Keybindings: parseBindings("esc"),
		},
		{
			Name:        SessionCompactCommand,
			Description: "compactar sessão",
			Keybindings: parseBindings("<leader>c"),
			Trigger:     []string{"compact", "summarize", "compactar", "resumir"},
		},
		{
			Name:        SessionChildCycleCommand,
			Description: "próxima sessão filha",
			Keybindings: parseBindings("ctrl+right"),
		},
		{
			Name:        SessionChildCycleReverseCommand,
			Description: "sessão filha anterior",
			Keybindings: parseBindings("ctrl+left"),
		},
		{
			Name:        ToolDetailsCommand,
			Description: "alternar detalhes",
			Keybindings: parseBindings("<leader>d"),
			Trigger:     []string{"details", "detalhes"},
		},
		{
			Name:        ThinkingBlocksCommand,
			Description: "alternar pensamento",
			Keybindings: parseBindings("<leader>b"),
			Trigger:     []string{"thinking", "pensamento"},
		},
		{
			Name:        ModelListCommand,
			Description: "listar modelos",
			Keybindings: parseBindings("<leader>m"),
			Trigger:     []string{"models", "modelos"},
		},
		{
			Name:        ModelCycleRecentCommand,
			Description: "próximo modelo recente",
			Keybindings: parseBindings("f2"),
		},
		{
			Name:        ModelCycleRecentReverseCommand,
			Description: "modelo recente anterior",
			Keybindings: parseBindings("shift+f2"),
		},
		{
			Name:        AgentListCommand,
			Description: "listar agentes",
			Keybindings: parseBindings("<leader>a"),
			Trigger:     []string{"agents", "agentes"},
		},
		{
			Name:        AgentCycleCommand,
			Description: "próximo agente",
			Keybindings: parseBindings("tab"),
		},
		{
			Name:        AgentCycleReverseCommand,
			Description: "agente anterior",
			Keybindings: parseBindings("shift+tab"),
		},
		{
			Name:        ThemeListCommand,
			Description: "listar temas",
			Keybindings: parseBindings("<leader>t"),
			Trigger:     []string{"themes", "temas"},
		},
		{
			Name:        ProjectInitCommand,
			Description: "criar/atualizar AGENTS.md",
			Keybindings: parseBindings("<leader>i"),
			Trigger:     []string{"init", "iniciar"},
		},
		{
			Name:        InputClearCommand,
			Description: "limpar entrada",
			Keybindings: parseBindings("ctrl+c"),
		},
		{
			Name:        InputPasteCommand,
			Description: "colar conteúdo",
			Keybindings: parseBindings("ctrl+v", "super+v"),
		},
		{
			Name:        InputSubmitCommand,
			Description: "enviar mensagem",
			Keybindings: parseBindings("enter"),
		},
		{
			Name:        InputNewlineCommand,
			Description: "inserir nova linha",
			Keybindings: parseBindings("shift+enter", "ctrl+j"),
		},
		{
			Name:        MessagesPageUpCommand,
			Description: "página anterior",
			Keybindings: parseBindings("pgup"),
		},
		{
			Name:        MessagesPageDownCommand,
			Description: "próxima página",
			Keybindings: parseBindings("pgdown"),
		},
		{
			Name:        MessagesHalfPageUpCommand,
			Description: "meia página acima",
			Keybindings: parseBindings("ctrl+alt+u"),
		},
		{
			Name:        MessagesHalfPageDownCommand,
			Description: "meia página abaixo",
			Keybindings: parseBindings("ctrl+alt+d"),
		},

		{
			Name:        MessagesFirstCommand,
			Description: "primeira mensagem",
			Keybindings: parseBindings("ctrl+g"),
		},
		{
			Name:        MessagesLastCommand,
			Description: "última mensagem",
			Keybindings: parseBindings("ctrl+alt+g"),
		},

		{
			Name:        MessagesCopyCommand,
			Description: "copiar mensagem",
			Keybindings: parseBindings("<leader>y"),
		},
		{
			Name:        MessagesUndoCommand,
			Description: "desfazer última mensagem",
			Keybindings: parseBindings("<leader>u"),
			Trigger:     []string{"undo", "desfazer"},
		},
		{
			Name:        MessagesRedoCommand,
			Description: "refazer mensagem",
			Keybindings: parseBindings("<leader>r"),
			Trigger:     []string{"redo", "refazer"},
		},
		{
			Name:        AppExitCommand,
			Description: "sair do aplicativo",
			Keybindings: parseBindings("ctrl+c", "<leader>q"),
			Trigger:     []string{"exit", "quit", "q", "sair"},
		},
	}
	registry := make(CommandRegistry)
	keybinds := map[string]string{}
	marshalled, _ := json.Marshal(config.Keybinds)
	json.Unmarshal(marshalled, &keybinds)
	for _, command := range defaults {
		// Remove share/unshare commands if sharing is disabled
		if config.Share == opencode.ConfigShareDisabled &&
			(command.Name == SessionShareCommand || command.Name == SessionUnshareCommand) {
			slog.Info("Removing share/unshare commands")
			continue
		}
		if keybind, ok := keybinds[string(command.Name)]; ok && keybind != "" {
			command.Keybindings = parseBindings(keybind)
		}
		registry[command.Name] = command
	}
	for _, command := range customCommands {
		registry[CommandName(command.Name)] = Command{
			Name:        CommandName(command.Name),
			Description: command.Description,
			Trigger:     []string{command.Name},
			Keybindings: []Keybinding{},
			Custom:      true,
		}
	}

	slog.Info("Loaded commands", "commands", registry)
	return registry
}
