# 4Navigator — Power Features: Auto-Clicker, Backup Manager, Mini Widget, Bloco de Notas e FPS Limiter

## Goal
Adicionar um conjunto avançado de recursos idle ao 4Navigator: Auto-Clicker por quadrante, Backup e Restauração centralizada de saves, Modo Mini-Widget flutuante (always-on-top), Bloco de Notas retrátil lateral e Limitador de FPS opcional (com padrão mantido em 60 FPS).

## Tasks
- [x] Task 1: Atualizar IPC no `src/main.js` e `src/preload.js` para suportar modo Mini-Widget (always-on-top, redimensionamento dinâmico e restore) e diálogo de arquivos para backup/restauração se necessário.
- [x] Task 2: Implementar o Drawer do Bloco de Notas Lateral (`src/renderer/index.html` e `styles.css`) com abas para Notas Gerais e Notas específicas por Painel (P1-P4) e auto-save.
- [x] Task 3: Implementar o Gerenciador de Backup & Restauração de Saves (`src/renderer/app.js`) extraindo e injetando dados do `localStorage` dos 4 webviews.
- [x] Task 4: Implementar o Auto-Clicker nativo por quadrante (`src/renderer/app.js` e `styles.css`) com controle de CPS (5, 10, 20, 50) e tecla de atalho/toggle visual.
- [x] Task 5: Implementar o Seletor de Limitador de FPS opcional (60 FPS Padrão, 30 FPS, 15 FPS Eco) com feedback de status.
- [x] Task 6: Implementar o Modo Mini-Widget com alternância instantânea entre modo normal e janela flutuante Always-on-Top compacta.
- [x] Task 7: Verificação integrada, testes de execução e atualização da documentação.

## Done When
- [x] O usuário consegue ativar o Auto-clicker em qualquer quadrante e ver o clique contínuo funcionando.
- [x] O usuário consegue exportar e restaurar um arquivo `.json` com os saves dos 4 jogos.
- [x] O usuário pode abrir o bloco de notas lateral e suas anotações persistem ao fechar e reabrir.
- [x] O usuário pode alternar para o Modo Mini-Widget flutuante compacto e retornar à tela normal com 1 clique.
- [x] O usuário pode escolher entre 60 FPS (padrão), 30 FPS ou 15 FPS sem afetar a lógica de tempo dos jogos.

