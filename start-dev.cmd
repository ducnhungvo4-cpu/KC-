@echo off
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" "node_modules\vite\bin\vite.js" --host 127.0.0.1 --port 5173 > "%~dp0vite.out.log" 2> "%~dp0vite.err.log"
