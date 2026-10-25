# UFC 333 — Content Pack (Instagram, ruta manual)

Event: UFC 333 Volkanovski vs. Evloev — 2026-10-24, hora Chihuahua (CST).
Early prelims 08:00 · prelims 10:00 · cartel principal 12:00.

## Assets

| # | File | Size | Publish time (CST) | Use |
|---|------|------|--------------------|-----|
| P3 | `p3-bets-post.png` | 1080×1350 (4:5 feed) | **10:00** | "¿Quién gana?" — última llamada para boletos |
| P4 | `p4-story-hype.png` | 1080×1920 (story) | **12:00** | Hype del estelar; añade sticker de encuesta en la zona marcada + sticker de link |
| P5 | `p5-results-template.png` | 1080×1350 (feed) | **~17:30–18:00** (solo con resultados verificados) | Plantilla del ganador — llenar [ GANADOR ], [ MÉTODO ], [ R ], [ FELICITADO ] |

Sources: los HTML junto a cada PNG son la fuente editable
(`p3-bets-post.html`, `p4-story-hype.html`, `p5-results-template.html`).
Re-render: headless Chrome con `--window-size=1080,1350` o `1080,1920`.

## Captions (español, tú form — copiar/pegar)

### P3 — 10:00
> ⏰ Ya van las preliminares. La pelea estelar empieza a las 12:00 — ¿quién gana: Volkanovski 🦅 o Evloev? 💥 Última llamada para tu boleto: link en bio. Gana con la rifa y vive la velada como se debe. #UFC333 #Rifa

### P4 — 12:00 (feed opcional si también postean la historia)
> 🔴 COMIENZA LA ESTELAR: Volkanovski vs. Evloev. Mientras definen al ganador, la rifa sigue en pie — el ganador se anuncia esta tarde en esta cuenta. 🏆 Boletos: link en bio. #UFC333

Story extra: sticker de encuesta "¿Quién gana?" — opciones `Volkanovski 🇦🇺` / `Evloev 🇷🇺` (verificar banderas representadas antes de publicar — incertidumbre señalada en promotion-options.md) + sticker de link al sitio.

### P5 — resultados (~17:30–18:00, SOLO con resultado verificado)
> 🏆 Resultado oficial de UFC 333: {GANADOR} ganó por {MÉTODO} en el round {R}. Y el ganador de nuestra rifa es… ¡{FELICITADO}! 🎉 Gracias a todos los que participaron — nos vemos en la próxima pelea. Sigue esta cuenta para la próxima rifa. #UFC333 #Rifa

**Gate:** no publicar P5 sin el resultado real verificado (alineado con la automatización de 17:30).

## Recordatorios

- Cuenta de Instagram: aún no existe — crearla primero (manual).
- P1 (07:30 countdown) y P2 (08:00 tarjeta) ya pasaron hoy; si se postean tarde, ajustar copy ("arrancó la velada").
- Nada de dinero real en los CTAs: rifa/boletos únicamente.
