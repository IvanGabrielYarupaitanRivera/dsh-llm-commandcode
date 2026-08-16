# Mensaje para el agente de la otra laptop

Copia y pega esto tal cual en el chat del agente de la otra laptop:

---

Necesito que instales y verifiques un plugin del DeepSeek Harness en esta laptop (Windows).

**Contexto:**
- `dsh` ya está instalado (el CLI del harness).
- El archivo del plugin está en el Desktop: `dsh-llm-commandcode-0.1.1.tgz`. Si el Desktop no está en `C:\Users\<usuario>\Desktop`, localízalo con `[Environment]::GetFolderPath('Desktop')`.

**Tareas:**

1. Localiza el archivo `.tgz` en el Desktop y anota su ruta completa.

2. Añade el plugin al perfil web (el comando crea el perfil si no existe):
   ```
   dsh plugin --profile web add "<ruta completa al .tgz>"
   ```

3. Verifica la instalación:
   - Lee `C:\Users\<usuario>\.dsh\profiles\web\package.json` → debe contener
     `dsh-llm-commandcode` en `dependencies` y en `dsh.profile.bundles`.
   - Comprueba que el paquete existe en el `node_modules` del perfil.
   - Prueba de carga (desde el directorio del perfil web):
     ```
     node -e "import('dsh-llm-commandcode').then(m => { console.log('OK', m.name) }).catch(e => { console.error(e); process.exit(1) })"
     ```
     Debe imprimir `OK llm-commandcode`. Si falla, pega el error.

4. Crea un acceso directo en el Desktop igual al que existe en la máquina original
   (`C:\Users\Admin\Desktop\DeepSeek Harness.lnk`), adaptado a esta laptop (sin
   checkout: el destino es el comando `dsh`). Ejecuta:
   ```powershell
   $ws = New-Object -ComObject WScript.Shell
   $desktop = [Environment]::GetFolderPath('Desktop')
   $dsh = (Get-Command dsh).Source
   $lnk = $ws.CreateShortcut("$desktop\DeepSeek Harness.lnk")
   $lnk.TargetPath = $dsh
   $lnk.Arguments = "web"
   $lnk.WorkingDirectory = "$env:USERPROFILE"
   $lnk.Description = "Arranca el servidor de DeepSeek Harness y abre el navegador"
   $lnk.Save()
   ```
   Verifica que el archivo `DeepSeek Harness.lnk` existe en el Desktop.

5. **NO reinicies el servidor `dsh web` si está corriendo** (cortaría la sesión si esta conversación va dentro de la GUI). Al terminar, indícale al usuario que:
   - Ponga su API key en PowerShell: `setx COMMANDCODE_API_KEY user_XXXX` (con su key real),
   - reinicie el servidor (`Ctrl+C` → `dsh web`, o doble clic en el acceso directo nuevo),
   - y que en la Web UI compruebe Settings → Models → Command Code.

6. Responde con un resumen corto: ruta del `.tgz` usada, resultado de cada verificación, confirmación del acceso directo y las instrucciones finales para el usuario.

Si algún comando falla, pega el error y explica qué viste.
