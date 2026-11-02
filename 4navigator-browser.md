# 4Navigator — Navegador 4-Grid para Jogos Idle

## Goal
Construir um navegador desktop em Electron com grade 2x2 capaz de rodar 4 jogos idle simultaneamente na mesma tela, com zero congelamento em segundo plano (`backgroundThrottling: false`) e controles individuais de navegação, zoom e áudio por quadrante.

## Tasks
- [x] Task 1: Inicializar estrutura do projeto (`package.json`, `.gitignore`) e instalar Electron → Verify: `package.json` com scripts `start` e dependência do Electron instalada.
- [x] Task 2: Configurar o processo principal (`src/main.js`) com janela do Electron e flags anti-throttling → Verify: `backgroundThrottling: false` ativo e janela carrega `index.html`.
- [x] Task 3: Criar script de Preload seguro (`src/preload.js`) via `contextBridge` → Verify: Funções de IPC (áudio, zoom, reload, presets) expostas com segurança.
- [x] Task 4: Desenvolver o Shell visual em Dark Mode (`src/renderer/index.html` e `styles.css`) com CSS Grid 2x2 e Barra Global → Verify: Layout 2x2 responsivo e estético sem quebra de proporção.
- [x] Task 5: Implementar a lógica dos 4 quadrantes e toolbars individuais (`src/renderer/app.js`) → Verify: Cada quadrante possui URL bar, botões de Recarregar, Mute, Zoom e DevTools operando a `<webview>` correspondente.
- [x] Task 6: Implementar isolamento e controle de áudio individual → Verify: `webview.setAudioMuted(true/false)` silencia apenas o quadrante desejado com feedback visual.
- [x] Task 7: Implementar Presets de Jogos Idle e ações globais na barra superior → Verify: Carregar preset preenche automaticamente os 4 quadrantes com jogos salvos no `localStorage`.
- [x] Task 8: Execução e verificação integrada dos 4 jogos idle → Verify: `npm start` inicializa a aplicação executando 4 instâncias estáveis sem throttling.

## Done When
- [x] A aplicação desktop abre em grade 2x2 com 4 webviews independentes.
- [x] Jogos idle continuam acumulando progresso mesmo quando o usuário foca em outro quadrante ou janela.
- [x] Cada quadrante pode ser mutado, recarregado e ter sua URL alterada independentemente.
- [x] Presets de jogos podem ser salvos e restaurados.

## Notes
- Stack definida: Electron + Vanilla HTML/CSS/JS.
- Anti-throttling ativo: `disable-background-timer-throttling`, `disable-backgrounding-occluded-windows`, `backgroundThrottling: false`.
- Todos os arquivos criados e validados sintaticamente.

