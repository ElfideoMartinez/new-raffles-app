# Graphics — prompts (estilo unificado)

**Formato:** feed 1080x1350 (4:5). Story crops safe-zone: mantener texto dentro del 80% central.
**Estilo maestro (todas las imágenes):** cartel de noche de peleas, fondo oscuro carbón (#12100E), acento naranja-ámbar (#FF8A3D) y acento amarillo (#FFC845), tipografía condensed bold estilo deportivo, textura sutil de grano/cámara, SIN fotos reales de peleadores (derechos), SIN logos de UFC, SIN iconografía de apuestas/casino. Nada de dinero en la imagen.
**Nota:** se generaron 3 de las 4 imágenes en `graphics/` (`card-ufc333.png`, `countdown-0730.png`, `hype-maincard.png`, 1080x1350). La story vertical (9:16) quedó **prompts-only** — Daniel puede generarla con cualquier herramienta o pedirla al agente. La primera versión del card graphic salió con texto corrupto en la lista de peleas; se regeneró **sin nombres** (solo headline + bandas de horario) — la lista completa va en el pie de foto del post. Verificar tipografía antes de publicar cualquier imagen.

---

## 1. Event card graphic (slot 08:00) — `card-ufc333.png`
> Promotional fight-night poster, portrait 4:5. Dark charcoal background (#12100E) with dramatic amber spotlight beams from the top corners. Top third: huge condensed bold headline "UFC 333" with subheadline "VOLKANOVSKI VS. EVLOEV" beneath, in off-white (#F5F1E8) with orange accent underline. Middle: a clean vertical list of 14 matchups in small condensed type, grouped under labels "MAIN CARD 12:00", "PRELIMS 10:00", "EARLY PRELIMS 08:00". Bottom strip: a subtle arena silhouette (Abu Dhabi skyline hint) and a small badge reading "RIFAS MTZ · RIFA DE LA NOCHE". Grainy film texture, no photographic faces, no logos, no gambling imagery.

## 2. Countdown (slot 07:30) — `countdown-0730.png`
> Bold minimalist countdown poster, portrait 4:5. Deep charcoal background with a single warm amber ring glow in the center like a clock face, hands pointing near 8. Huge condensed numerals "30 MIN" overlaid, and below in smaller caps: "EARLY PRELIMS · 08:00 HORA CHIHUAHUA". Top corner small badge "RIFAS MTZ". Off-white text, orange accents, subtle grain, no faces, no logos, no money imagery.

## 3. Hype main card (slot 12:00) — `hype-maincard.png`
> High-energy fight-night hype poster, portrait 4:5. Dark arena background with blurred crowd bokeh in warm tones, two crossed spotlight beams framing the center. Giant condensed type: "MAIN CARD" on top, "EN VIVO 12:00" beneath, and the matchup "VOLKANOVSKI VS. EVLOEV" with a second line "YAN VS. DVALISHVILI" below it. Thin orange divider lines, off-white text, small "RIFAS MTZ · COMUNIDAD" badge bottom center. Grain texture, no photographic faces, no logos, no gambling imagery.

## 4. Story version (any slot, 1080x1920) — `story-hype-ufc333.png`
> Vertical story-sized (9:16) version of the hype poster: same charcoal background and amber spotlights, headline "UFC 333" centered upper third, "VOLKANOVSKI VS. EVLOEV" mid-frame, "MAÑANA SÁBADO" in a pill-shaped orange badge. All critical text inside the central 80% safe zone for Instagram stories. Small "RIFAS MTZ" badge near the bottom, above the platform UI safe area. Grain, no faces, no logos.

---

### Uso
- Generar 1x cada uno (máx. 4 imágenes). El card graphic es el más importante; si solo se genera una, es esa.
- Antes de publicar: revisar que ningún texto salga mal (los generadores a veces deforman tipografía). Si el texto sale mal, recortar/sustituir o usar la versión sin texto + texto de IG.
