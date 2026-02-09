#!/bin/bash
# Backup manual único: copia la base de datos a un archivo fijo.
# Ejecutar una sola vez cuando quieras tener una copia de seguridad manual.
# No modifica ni lee nada más que el archivo de la base de datos.

SOURCE="/data/juegos.db"
DEST="/data/juegos_backup_manual.db"

if [ ! -f "$SOURCE" ]; then
	echo "Error: No existe $SOURCE. No se puede hacer el backup."
	exit 1
fi

if [ -f "$DEST" ]; then
	echo "El backup manual ya existe: $DEST"
	echo "No se sobrescribe. Si quieres regenerarlo, borra ese archivo y vuelve a ejecutar."
	exit 0
fi

cp "$SOURCE" "$DEST"
if [ $? -eq 0 ]; then
	echo "Backup manual creado correctamente: $DEST"
else
	echo "Error al copiar. Comprueba permisos y espacio."
	exit 1
fi
