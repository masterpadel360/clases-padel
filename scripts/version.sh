#!/bin/sh
# Uso: sh scripts/version.sh  → sube la versión para que los celulares se actualicen solos.
cd "$(dirname "$0")/.." && V=$(date +%Y%m%d%H%M)
sed -i -E "s/\?v=[0-9a-z]+/?v=$V/g; s/window.APP_V = \"[0-9a-z]+\"/window.APP_V = \"$V\"/" index.html
printf '{"v":"%s"}\n' "$V" > version.json && echo "Versión $V"
