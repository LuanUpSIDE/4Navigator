# 🎮 4Navigator — Multi-Quadrant Idle Game Browser

Um navegador desktop construído em **Electron** projetado especialmente para entusiastas de jogos *idle* e incrementais. O 4Navigator permite executar 4 instâncias de jogos simultaneamente em grade na mesma tela, garantindo que o progresso continue a todo vapor sem o congelamento habitual do navegador.

---

## ✨ Principais Recursos

- **⭐ Barra de Favoritos & Adicionar aos Favoritos:** Barra horizontal dedicada logo abaixo do cabeçalho com acesso rápido aos seus jogos favoritos. Adicione qualquer site aos favoritos com 1 clique no botão de estrela (`⭐`) de cada quadrante ou pelo botão `+ Adicionar` manual, com persistência e remoção simplificada.
- **📊 Monitor de Memória RAM & Consumo em Tempo Real:** Barra de status no rodapé (Resource HUD) que exibe o consumo individual de memória RAM e CPU de cada quadrante (`P1` a `P4`), a memória total consumida pelo navegador e um botão de **🧹 Otimizar RAM** para limpar caches e liberar memória imediatamente.
- **🎯 Auto-Clicker Integrado por Quadrante:** Ative ou desative cliques contínuos (20 CPS) em qualquer um dos 4 quadrantes com um clique no botão de mira (`🎯`) ou feedback visual luminoso.
- **💾 Gerenciador de Backup & Restauração de Saves:** Exporte todos os dados de `localStorage` dos 4 jogos em um único arquivo `.json` ou restaure backups anteriores para nunca perder seu progresso.
- **📌 Modo Mini-Widget (Always-on-Top):** Reduza o navegador para uma janela flutuante ultracompacta (480x480) que fica sempre visível enquanto você trabalha ou assiste séries.
- **📝 Bloco de Notas Lateral (Drawer):** Gaveta retrátil com abas dedicadas (Geral, P1, P2, P3, P4) e auto-save para anotar builds, links, guias e códigos de exportação.
- **⚡ Limitador de FPS Opcional (Padrão 60 FPS):** Mantenha os 60 FPS padrão ou selecione 30 FPS / 15 FPS (Eco Mode) para economizar CPU e bateria sem prejudicar a simulação dos jogos.
- **Grade 2x2 com 4 Quadrantes Simultâneos:** Jogue até 4 jogos lado a lado sem necessidade de gerenciar múltiplas janelas ou fazer Alt-Tab constante.
- **⚡ Zero Background Throttling:** As flags de timer do Chromium (`disable-background-timer-throttling`, `disable-backgrounding-occluded-windows`, `backgroundThrottling: false`) estão desativadas. Seus jogos não reduzem ticks por segundo quando a janela está desfocada ou minimizada.
- **🔇 Controle de Áudio Individual:** Silencie ou ative o som de cada quadrante individualmente, ou use o botão **Silenciar Tudo** na barra superior.
- **🔍 Controle de Zoom Independente:** Ajuste a escala de 50% a 200% em cada painel para adaptar jogos com interfaces muito pequenas ou densas.
- **🛠️ DevTools Integrado:** Abra o console de desenvolvedor de qualquer quadrante para importar/exportar saves ou inspecionar o código do jogo.
- **📑 Presets Prontos & Personalizados:**
  - *Clássicos:* Cookie Clicker, Universal Paperclips, Candy Box 2, A Dark Room.
  - *RPG & Estratégia:* Trimps, Melvor Idle, Evolve, Crank.
  - *Sci-Fi / Números:* Antimatter Dimensions, Synergism, Space Company, Swarm Sim.
  - *Salvar / Carregar Meu Preset:* Salve seus 4 jogos favoritos para abrir tudo com um único clique.
- **◫ Alternador de Layouts:**
  - Grade 2x2 (4 telas simétricas).
  - Layout Foco (1 tela principal expandida na esquerda + 3 laterais na direita).
  - Maximizar Quadrante (expandir temporariamente 1 jogo em tela cheia para ascensão/prestige).

---

## 🚀 Como Executar e Empacotar

### Modo de Desenvolvimento
```bash
# Iniciar diretamente via código-fonte
npm start
```

### 📦 Gerar Executáveis Nativos (Dois Cliques)

Você não precisa abrir pelo terminal! Os executáveis prontos ficam gerados na pasta `dist/`:

```bash
# Gerar AppImage portátil (executa direto com 2 cliques em qualquer Linux)
npm run dist:appimage

# Gerar instalador .deb (Ubuntu, Debian, Pop!_OS, Mint)
npm run dist:deb

# Gerar executável descompactado
npm run pack
```

#### Arquivos Disponíveis para Download (Windows & Linux):
- **Windows:**
  - 💾 **[4Navigator Setup 1.0.0.exe](https://github.com/LuanUpSIDE/4Navigator/releases/download/v1.0.0/4Navigator.Setup.1.0.0.exe)** — Instalador padrão para Windows 10/11.
  - ⚡ **[4Navigator 1.0.0.exe](https://github.com/LuanUpSIDE/4Navigator/releases/download/v1.0.0/4Navigator.1.0.0.exe)** — Versão portátil (sem instalação).
- **Linux:**
  - 🐧 **[4Navigator-1.0.0.AppImage](https://github.com/LuanUpSIDE/4Navigator/releases/download/v1.0.0/4Navigator-1.0.0.AppImage)** — Executável universal para Linux (dois cliques).
  - 📦 **[4navigator_1.0.0_amd64.deb](https://github.com/LuanUpSIDE/4Navigator/releases/download/v1.0.0/4navigator_1.0.0_amd64.deb)** — Instalador Debian/Ubuntu.
- 🔗 Todas as versões na **[Página de Releases do GitHub](https://github.com/LuanUpSIDE/4Navigator/releases/tag/v1.0.0)**.



---

## 🏗️ Estrutura do Código

```
4Navigator/
├── src/
│   ├── main.js           # Processo principal Electron (janela nativa, flags anti-throttling, IPC)
│   ├── preload.js        # Context bridge segura para APIs de janela
│   └── renderer/
│       ├── index.html    # Shell visual com barra global e os 4 quadrantes
│       ├── styles.css    # Design System dark mode gamer com CSS Grid responsivo
│       └── app.js        # Lógica de controle de navegação, zoom, mute e presets
├── package.json          # Metadados e dependência do Electron
├── 4navigator-browser.md # Plano de tarefas e critérios de conclusão
└── README.md
```

---

## 🔒 Licença
MIT
