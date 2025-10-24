#!/bin/bash
# Script de instalação local do CodeChico

set -e

echo "🚀 Instalando CodeChico localmente..."
echo ""

# Detectar plataforma
case "$(uname -s)" in
    Linux)  PLATFORM="linux" ;;
    Darwin) PLATFORM="darwin" ;;
    *)      echo "❌ Plataforma não suportada: $(uname -s)"; exit 1 ;;
esac

# Detectar arquitetura
case "$(uname -m)" in
    x86_64|amd64) ARCH="x64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *)      echo "❌ Arquitetura não suportada: $(uname -m)"; exit 1 ;;
esac

PKG_NAME="opencode-${PLATFORM}-${ARCH}"
INSTALL_DIR="${HOME}/.local/bin"

echo "📦 Plataforma detectada: ${PLATFORM}-${ARCH}"
echo "📁 Diretório de instalação: ${INSTALL_DIR}"
echo ""

# Compilar
echo "🔨 Compilando CodeChico..."
cd packages/opencode
./script/build-dev.sh
cd ../..
echo ""

# Instalar
echo "📦 Instalando binário..."
mkdir -p "${INSTALL_DIR}"
cp -v "packages/opencode/dist/${PKG_NAME}/bin/opencode" "${INSTALL_DIR}/codechico"
chmod +x "${INSTALL_DIR}/codechico"
echo ""

# Verificar instalação
VERSION=$(${INSTALL_DIR}/codechico --version 2>&1)
echo "✅ CodeChico v${VERSION} instalado com sucesso!"
echo ""
echo "Para usar, execute:"
echo "  codechico --help"
echo ""
echo "Comandos disponíveis em português:"
echo "  /modelos  - listar modelos"
echo "  /ajuda    - mostrar ajuda"
echo "  /agentes  - listar agentes"
echo "  /temas    - listar temas"
echo "  /nova     - nova sessão"
echo "  /sair     - sair"
