#!/bin/bash
# Script para compilar o CodeChico com a versão do package.json

# Ler a versão do package.json
VERSION=$(node -p "require('./package.json').version")

echo "📦 Compilando CodeChico v$VERSION..."
OPENCODE_VERSION="$VERSION" bun run build

echo "✅ Compilação concluída!"
echo ""
echo "Para testar localmente, use:"
echo "  bun run dev"
