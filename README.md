# 🎮 4Navigator — Multi-Quadrant Idle Game Browser

Um navegador desktop construído em **Electron** projetado especialmente para entusiastas de jogos *idle* e incrementais. O 4Navigator permite executar 4 instâncias de jogos simultaneamente em grade na mesma tela, garantindo que o progresso continue a todo vapor sem o congelamento habitual do navegador.

---

## ✨ Principais Recursos

- **⚙️ Menu de Opções Unificado:** Menu moderno suspenso que centraliza:
  - **📑 Presets Prontos & Personalizados:** Clássicos, RPG & Estratégia, Sci-Fi e salvar/carregar seu próprio quarteto de jogos.
  - **💾 Gerenciador de Backup & Restauração:** Exportação e restauração de saves em formato `.json`.
  - **⚡ Limitador de FPS Interativo:** Botões pill para alternar entre 60 FPS (Padrão), 30 FPS (Eco) e 15 FPS (Ultra-Eco).
  - **🖥️ Aceleração de Hardware por GPU (Opcional - Padrão Ligada):** Interruptor toggle para ativar ou desativar a aceleração gráfica por hardware da GPU, com persistência e reinicialização rápida.
  - **🔐 Cofre de Logins & Senhas Salvas (Criptografia AES-256 + PIN Mestre PBKDF2):** Gerencie todas as suas contas, credenciais e logins de jogos em um painel seguro centralizado, protegido opcionalmente por PIN Mestre (hash SHA-256 + Salt PBKDF2 com 100.000 iterações), bloqueio automático por inatividade (5 minutos), cópia rápida e busca inteligente.
- **🛡️ Suite Completa de Segurança e Proteção do Usuário:**
  - **1. Proteção de Hardware & Anti-Cryptojacking:** Bloqueio nativo no nível de rede (`webRequest.onBeforeRequest`) contra scripts de mineração oculta de criptomoedas (Coinhive, Crypto-loot, Webminepool, Coinimp, Minr, etc.), preservando sua CPU/GPU 100% para os jogos.
  - **2. Cofre com PIN Mestre & Auto-Lock:** Camada extra de segurança por senha/PIN no cofre de credenciais para impedir acesso não autorizado ao deixar o computador ligado.
  - **3. Sandboxing Rigoroso de Dispositivos e Sensores:** Bloqueio e negação preventiva de permissões arriscadas de hardware (câmera, microfone, geolocalização, notificações, sensores corporais, dispositivos USB/Bluetooth e sintetizadores MIDI) em todas as partições.
  - **4. Navigation Guard & Escudo de Protocolo (HTTPS/HTTP):** Indicador visual luminoso de segurança em cada barra de URL (`🔒` verde para HTTPS criptografado com SSL/TLS e `⚠️` vermelho pulsante de alerta para sites sem criptografia HTTP), com contenção de pop-ups (`new-window`) dentro da grade do quadrante.
  - **5. Download Guard contra Executáveis Perigosos:** Interceptação automática em tempo real no processo principal de downloads suspeitos com cancelamento imediato de arquivos maliciosos (`.exe`, `.bat`, `.cmd`, `.msi`, `.vbs`, `.ps1`, `.scr`) e notificação toast em tela.
- **🔑 Salvar Login e Preenchimento Automático por Quadrante:**
  - Botão de chave (`🔑`) na barra de ferramentas de cada quadrante com indicação luminosa quando o jogo possui credencial salva.
  - Modal rápido para salvar usuário e senha para o domínio do jogo atual.
  - **⚡ Preenchimento Automático Direto na Tela:** Botão para injetar instantaneamente o login e a senha nos campos de formulário do jogo dentro do webview com simulação de eventos para máxima compatibilidade com React, Vue e WebGL.
- **🔄 Sistema de Atualização Direto no Navegador (In-App Auto-Update):** Verifique e baixe novas versões diretamente pelo botão de **Atualizações** na barra superior ou através da verificação automática integrada com o GitHub Releases (`electron-updater`).
- **⭐ Barra de Favoritos & Adicionar aos Favoritos:** Barra horizontal dedicada logo abaixo do cabeçalho com acesso rápido aos seus jogos favoritos. Adicione qualquer site aos favoritos com 1 clique no botão de estrela (`⭐`) de cada quadrante ou pelo botão `+ Adicionar` manual, com persistência e remoção simplificada.
- **📊 Monitor de Memória RAM & Consumo em Tempo Real:** Barra de status no rodapé (Resource HUD) que exibe o consumo individual de memória RAM e CPU de cada quadrante (`P1` a `P4`), a memória total consumida pelo navegador e um botão de **🧹 Otimizar RAM** para limpar caches e liberar memória imediatamente.
- **🎯 Auto-Clicker Integrado por Quadrante:** Ative ou desative cliques contínuos (20 CPS) em qualquer um dos 4 quadrantes com um clique no botão de mira (`🎯`) ou feedback visual luminoso.
- **📌 Modo Mini-Widget (Always-on-Top):** Reduza o navegador para uma janela flutuante ultracompacta (480x480) que fica sempre visível enquanto você trabalha ou assiste séries.
- **📝 Bloco de Notas Lateral (Drawer):** Gaveta retrátil com abas dedicadas (Geral, P1, P2, P3, P4) e auto-save para anotar builds, links, guias e códigos de exportação.
- **Grade 2x2 com 4 Quadrantes Simultâneos:** Jogue até 4 jogos lado a lado sem necessidade de gerenciar múltiplas janelas ou fazer Alt-Tab constante.
- **⚡ Zero Background Throttling:** As flags de timer do Chromium (`disable-background-timer-throttling`, `disable-backgrounding-occluded-windows`, `backgroundThrottling: false`) estão desativadas. Seus jogos não reduzem ticks por segundo quando a janela está desfocada ou minimizada.
- **🔇 Controle de Áudio Individual:** Silencie ou ative o som de cada quadrante individualmente, ou use o botão **Silenciar Tudo** na barra superior.
- **🔍 Controle de Zoom Independente:** Ajuste a escala de 50% a 200% em cada painel para adaptar jogos com interfaces muito pequenas ou densas.
- **🛠️ DevTools Integrado:** Abra o console de desenvolvedor de qualquer quadrante para importar/exportar saves ou inspecionar o código do jogo.
- **🔲 Seletor Dinâmico de 1 a 4 Telas:** Alterne com 1 clique a quantidade de instâncias visíveis no topo (`[1]`, `[2]`, `[3]`, `[4]`):
  - **1 Tela:** Foco total em tela cheia para 1 jogo.
  - **2 Telas:** Divisão balanceada lado a lado (50% / 50%).
  - **3 Telas:** 1 tela principal expandida na esquerda + 2 menores na lateral direita.
  - **4 Telas:** Grade 2x2 clássica para quad-play com 4 jogos simultâneos.
  - O rodapé Resource HUD se adapta automaticamente, exibindo apenas as métricas das telas ativas.

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
  - 💾 **[4Navigator Setup 1.3.0.exe](https://github.com/LuanUpSIDE/4Navigator/releases/download/v1.3.0/4Navigator.Setup.1.3.0.exe)** — Instalador padrão para Windows 10/11 (com atalhos no Menu Iniciar e Desktop).
  - ⚡ **[4Navigator 1.3.0.exe](https://github.com/LuanUpSIDE/4Navigator/releases/download/v1.3.0/4Navigator.1.3.0.exe)** — Versão portátil (sem instalação).
- **Linux:**
  - 🐧 **[4Navigator-1.3.0.AppImage](https://github.com/LuanUpSIDE/4Navigator/releases/download/v1.3.0/4Navigator-1.3.0.AppImage)** — Executável universal para Linux (dois cliques).
  - 📦 **[4navigator_1.3.0_amd64.deb](https://github.com/LuanUpSIDE/4Navigator/releases/download/v1.3.0/4navigator_1.3.0_amd64.deb)** — Instalador Debian/Ubuntu.
- 🔗 Todas as versões na **[Página de Releases do GitHub](https://github.com/LuanUpSIDE/4Navigator/releases/tag/v1.3.0)**.



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
└── README.md
```

---

## 🔒 Licença
MIT
