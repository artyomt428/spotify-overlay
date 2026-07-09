# Spotify Overlay

Виджет Now Playing поверх активных окон (Electron + TypeScript).

## Настройка

## Что уже работает

- OAuth 2.0 Authorization Code + PKCE (без client secret)
- Локальный сервер на 8888 ловит redirect с кодом авторизации
- Поллинг `currently-playing` раз в 2 секунды
- Play/Pause/Next/Previous через Web API
- Окно: `alwaysOnTop`, прозрачное, без рамки, перетаскивается за фон
- Управление доступно только с **Spotify Premium** (ограничение самого API)

## Что стоит доделать дальше

- Хранение refresh token в `safeStorage` / keychain, а не в памяти (сейчас
  токен теряется при перезапуске — придётся логиниться заново)
- Обработку ошибок сети/протухшего токена в UI (сейчас просто console.error)
- На Wayland (Linux) `alwaysOnTop` может не работать как ожидается — это
  ограничение протокола, не приложения
- Иконку в трее + возможность скрыть/показать оверлей хоткеем
  (`globalShortcut` в Electron)
- Кнопку logout и переключение между несколькими Spotify-аккаунтами

## Структура

```
src/
  main.ts       — окно, IPC-хендлеры
  preload.ts    — contextBridge мост в renderer
  spotify.ts    — OAuth PKCE, обёртки над Web API
  types.ts      — общие типы
  renderer/
    renderer.ts — логика UI (поллинг, кнопки)
renderer/
  index.html
  style.css
```
