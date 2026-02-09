#!/bin/bash
# Backup diario de la base de datos SQLite.
# Pensado para ejecutarse desde un Cron Job en Render (ej. todos los días a las 03:00).
# Crea /data/backups si no existe y copia juegos.db con nombre juegos_YYYY-MM-DD.db.
# No borra ni sobrescribe backups ya existentes.

SOURCE="/data/juegos.db"
BACKUP_DIR="/data/backups"
DATE=$(date +%Y-%m-%d)
DEST="${BACKUP_DIR}/juegos_${DATE}.db"

if [ ! -f "$SOURCE" ]; then
	echo "Error: No existe $SOURCE. No se puede hacer el backup."
	exit 1
fi

mkdir -p "$BACKUP_DIR"
if [ $? -ne 0 ]; then
	echo "Error: No se pudo crear $BACKUP_DIR"
	exit 1
fi

if [ -f "$DEST" ]; then
	echo "Backup de hoy ya existe: $DEST (no se sobrescribe)"
	exit 0
fi

cp "$SOURCE" "$DEST"
if [ $? -eq 0 ]; then
	echo "Backup diario creado: $DEST"
else
	echo "Error al copiar. Comprueba permisos y espacio."
	exit 1
fi
