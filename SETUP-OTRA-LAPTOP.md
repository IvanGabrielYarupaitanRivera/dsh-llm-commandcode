# Setup en otra laptop — dsh-llm-commandcode

Dos niveles, según cuánta UI quieras:

- **Nivel 1 (funcional):** solo el plugin. La tarjeta mostrará el aviso
  "Other fields live in settings.yaml" y la key se pone por variable de entorno
  o settings.yaml. Modelos: los 5 por defecto, o editar `models` a mano.
- **Nivel 2 (UI completa):** harness parcheado (tarjeta con campo de API key +
  selector de modelos mejorado). Es el setup de esta máquina.

---

## Nivel 1 — Solo el plugin (rápido)

Requisitos: Node ≥ 22 y `npm i -g @deepseek-ai/dsh` (CLI publicado).

1. Copia la carpeta del plugin (esta carpeta `dsh-llm-commandcode`) a la otra
   laptop (USB/nube), o si el repo es público:
   `dsh plugin --profile web add github:IvanGabrielYarupaitanRivera/dsh-llm-commandcode`
2. Desde un terminal:
   ```sh
   dsh web                              # primera vez crea el perfil web
   dsh plugin --profile web add <ruta-al-plugin>   # o el github:...
   ```
3. Reinicia el servidor (`Ctrl+C` → `dsh web`).
4. Poner la key (el plugin la lee primero del servicio de credenciales y luego
   de la variable de entorno):
   ```sh
   # Windows PowerShell:
   setx COMMANDCODE_API_KEY user_XXXX   # luego reinicia el servidor
   ```
   o en `$DSH_HOME/settings.yaml`:
   ```yaml
   llm-commandcode:
     models:
       - id: google/gemini-3.7-flash
         name: Gemini 3.7 Flash
   ```
5. Listo: nueva sesión → elegir modelo (los 5 por defecto o los de `models`).

---

## Nivel 2 — UI completa (harness parcheado)

La UI mejorada vive en el código fuente del harness, así que la otra laptop
debe ejecutar el harness desde un checkout con el parche aplicado (igual que
esta máquina).

### Opción A — Con tu fork de deepseek-harness (si lo creaste para el PR)

En ESTA laptop, sube tu branch al fork (una vez):
```sh
git -C C:/Users/Admin/deepseek-harness remote add fork https://github.com/IvanGabrielYarupaitanRivera/deepseek-harness.git
git -C C:/Users/Admin/deepseek-harness push -u fork feat/model-picker-ux
```
En la OTRA laptop:
```sh
git clone https://github.com/IvanGabrielYarupaitanRivera/deepseek-harness
cd deepseek-harness
git switch feat/model-picker-ux
pnpm install
pnpm build          # compila libs + frontend (tarda unos minutos)
pnpm dsh web        # arranca con la UI parcheada
# en otra terminal:
dsh plugin --profile web add <ruta-al-plugin>
```

### Opción B — Con el archivo de parche (sin fork, recomendado)

En ESTA laptop ya generamos `harness-model-picker-ux.patch` (cópialo junto con
la carpeta del plugin). En la OTRA laptop:
```sh
git clone https://github.com/deepseek-ai/deepseek-harness
cd deepseek-harness
git apply harness-model-picker-ux.patch
pnpm install
pnpm build
pnpm dsh web
dsh plugin --profile web add <ruta-al-plugin>
```

### Después de cualquiera de las dos

- Key: en la tarjeta **Settings → Models → Command Code** (con el parche ya hay
  campo de API key), o variable de entorno como en el Nivel 1.
- Modelos: botón **Fetch available models** → buscador + seleccionar todo.

---

## Notas

- El parche `harness-model-picker-ux.patch` contiene los 2 commits de UI:
  selector de modelos + tarjeta commandcode. Se aplica con `git apply` sobre un
  checkout de `deepseek-ai/deepseek-harness` (rama master, rc.5).
- Si el harness publicado cambia de versión, el parche puede no aplicar limpio;
  en ese caso hay que rehacerlo contra la versión nueva.
- El plugin no requiere el parche para funcionar (solo para la UI bonita).
