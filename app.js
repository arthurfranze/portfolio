(() => {
  const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
  const HLS_JS = "https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.13/hls.min.js";
  const PHOTO_MS = 4500; // tempo da foto na roleta antes de girar
  const STEP = 28; // graus entre as faces do cilindro

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pad = (n) => String(n).padStart(2, "0");
  const fmtDur = (s) => `${Math.floor(s / 60)}:${pad(s % 60)}`;
  const ratioLabel = (w, h) => {
    const r = w / h;
    if (r > 1.7) return "16:9";
    if (r > 1.4) return "3:2";
    if (r < 0.6) return "9:16";
    return "4:5";
  };
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  // Texto editável: *palavra* vira itálico de destaque e quebra de linha vira <br>
  const rich = (t) => esc(t).replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/\n/g, "<br>");
  // Um vídeo pode estar em várias categorias ("cats"); "cat" é sempre a primeira
  const catsOf = (v) => (Array.isArray(v.cats) && v.cats.length ? v.cats : [v.cat]);
  // Link próprio de cada vídeo: /v/<id> (no GitHub Pages não há essa rota, então o link aponta para a Vercel)
  const SHARE_ORIGIN = location.hostname.endsWith("github.io") ? "https://arthur-franze.vercel.app" : location.origin;
  const canRoute = !LOCAL && !location.hostname.endsWith("github.io");
  const openId = window.__OPEN_VIDEO || (location.pathname.match(/^\/v\/([^/?#]+)/) || [])[1] || new URLSearchParams(location.search).get("v");

  async function loadContent() {
    for (const url of LOCAL ? ["content.json"] : ["/api/content", "content.json"]) {
      try {
        const r = await fetch(url, { cache: "no-cache" });
        if (r.ok) return await r.json();
      } catch (e) { /* tenta o próximo */ }
    }
    throw new Error("conteúdo indisponível");
  }

  loadContent().then(render).catch((e) => console.error(e));

  function render(C) {
    const cdn = (guid, file) => `https://${C.bunnyCdn}/${guid}/${file}`;
    const ytThumb = (id, q = "maxresdefault") => `https://i.ytimg.com/vi/${id}/${q}.jpg`;
    const posterOf = (it) => {
      if (it.poster && it.poster.startsWith("bunny:")) return cdn(it.guid, it.poster.slice(6));
      if (it.poster) return it.poster;
      return it.yt ? ytThumb(it.yt) : cdn(it.guid, "thumbnail.jpg");
    };
    const previewOf = (it) => cdn(it.guid, "play_480p.mp4");

    // Textos ----------------------------------------------------------
    $$("[data-t]").forEach((el) => {
      const v = C.texts[el.dataset.t];
      if (v != null) el.innerHTML = rich(v);
    });
    $("[data-stats]").innerHTML = C.stats.map((s) => `<li><b>${esc(s.value)}</b><span>${esc(s.label)}</span></li>`).join("");
    $("[data-services]").innerHTML = C.services.map((s, i) => `
      <article class="service reveal">
        <span class="service__n">${pad(i + 1)}</span>
        <h2>${esc(s.title)}</h2>
        <p>${esc(s.text)}</p>
        <ul class="tags">${s.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      </article>`).join("");

    // Celular: os cartões de serviço viram carrossel; os pontinhos mostram em qual está (o CSS esconde no computador)
    const svc = $("[data-services]");
    const svcDots = document.createElement("div");
    svcDots.className = "services__dots";
    svcDots.setAttribute("aria-hidden", "true");
    svcDots.innerHTML = C.services.map(() => "<i></i>").join("");
    svc.after(svcDots);
    const markSvc = () => {
      const n = C.services.length, max = svc.scrollWidth - svc.clientWidth;
      const i = max > 0 ? Math.round((svc.scrollLeft / max) * (n - 1)) : 0;
      $$("i", svcDots).forEach((d, j) => d.classList.toggle("is-on", j === i));
    };
    svc.addEventListener("scroll", markSvc, { passive: true });
    markSvc();

    const ct = C.contact;
    const waHref = `https://wa.me/${ct.whatsapp}?text=${encodeURIComponent(ct.whatsappText)}`;
    $$("[data-wa]").forEach((a) => { a.href = waHref; a.target = "_blank"; a.rel = "noopener"; });
    $("[data-wa-label]").textContent = ct.whatsappLabel;
    $("[data-ig]").href = `https://instagram.com/${ct.instagram}`;
    $("[data-ig]").textContent = `@${ct.instagram}`;
    $("[data-mail]").href = `mailto:${ct.email}`;
    $("[data-mail]").textContent = ct.email;
    $("[data-year]").textContent = new Date().getFullYear();

    // Nav, botão flutuante e luz do cursor ------------------------------
    const nav = $(".nav");
    const fab = $(".fab");
    const onScroll = () => {
      nav.classList.toggle("is-solid", scrollY > 40);
      fab.classList.toggle("is-visible", scrollY > innerHeight * 0.9);
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    if (finePointer && !reduced) {
      const root = document.documentElement;
      addEventListener("pointermove", (e) => {
        root.style.setProperty("--mx", e.clientX + "px");
        root.style.setProperty("--my", e.clientY + "px");
      }, { passive: true });
      $$(".service").forEach((el) => el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--x", e.clientX - r.left + "px");
        el.style.setProperty("--y", e.clientY - r.top + "px");
      }));
    }

    const reel = initReel(C.reel.filter((s) => !s.hidden && (s.type === "photo" || (s.guid && !s.pending))), cdn);

    // Portfólio ----------------------------------------------------------
    const items = C.videos.filter((v) => !v.hidden && !v.pending && (v.guid || v.yt));
    const cats = C.categories.filter((c) => !c.hidden && items.some((v) => catsOf(v).includes(c.id)));
    const catLabel = Object.fromEntries(C.categories.map((c) => [c.id, c.label]));
    const byCat = Object.fromEntries(cats.map((c) => [c.id, items.filter((i) => catsOf(i).includes(c.id))]));

    const chipsEl = $("[data-chips]");
    const rowsEl = $("[data-rows]");
    const chipDefs = [{ id: "all", label: "Todos", n: items.length }, ...cats.map((c) => ({ id: c.id, label: c.label, n: byCat[c.id].length }))];
    chipsEl.innerHTML = chipDefs.map((c, i) =>
      `<button class="chip" role="tab" aria-selected="${i === 0}" data-filter="${esc(c.id)}">${esc(c.label)}<sup>${c.n}</sup></button>`).join("");

    const arrowSvg = (d) => `<svg viewBox="0 0 24 24"><path d="${d}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const playSvg = `<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>`;
    const ytSvg = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.6 15.1V8.9l5.8 3.1-5.8 3.1z"/></svg>`;

    const cardHTML = (it, cat) => `
      <article class="card${it.w > it.h ? " card--h" : ""}" tabindex="0" role="button" aria-label="Assistir vídeo ${byCat[cat].indexOf(it) + 1} de ${esc(catLabel[cat])}" data-idx="${items.indexOf(it)}" style="--ar:${it.w} / ${it.h}">
        <img src="${esc(posterOf(it))}" alt="" loading="lazy" decoding="async" draggable="false"${it.yt && !it.poster ? ` onerror="this.onerror=null;this.src='${ytThumb(it.yt, "hqdefault")}'"` : ""}>
        <div class="card__top">
          <span class="badge${it.yt ? " badge--yt" : ""}">${it.yt ? `${ytSvg}YouTube` : ratioLabel(it.w, it.h)}</span>
          <span class="card__badges">${it.ia ? '<span class="badge badge--ia">IA</span>' : ""}${it.dur ? `<span class="badge">${fmtDur(it.dur)}</span>` : ""}</span>
        </div>
        <span class="card__play">${playSvg}</span>
        ${it.yt && it.channel ? `<span class="card__channel">${esc(it.channel)}</span>` : ""}
        <span class="card__bar"></span>
      </article>`;

    rowsEl.innerHTML = cats.map((c, ci) => `
      <section class="row" data-row="${esc(c.id)}" aria-label="${esc(c.label)}">
        <div class="row__head">
          <span class="row__n">${pad(ci + 1)}</span>
          <h3 class="row__title">${esc(c.label)}</h3>
          <span class="row__count">${byCat[c.id].length} projetos</span>
          <span class="row__line"><i></i></span>
          <div class="row__arrows">
            <button class="arrow" data-dir="-1" aria-label="Voltar">${arrowSvg("M15 5l-7 7 7 7")}</button>
            <button class="arrow" data-dir="1" aria-label="Avançar">${arrowSvg("M9 5l7 7-7 7")}</button>
          </div>
        </div>
        <div class="track">
          ${byCat[c.id].map((it) => cardHTML(it, c.id)).join("")}
          <div class="card card--end" data-end>
            <b>Gostou?<br>Vamos fazer o seu.</b>
            <span>Me conta a sua ideia no WhatsApp.</span>
            <a class="btn btn--accent btn--sm" href="${waHref}" target="_blank" rel="noopener">Pedir orçamento</a>
          </div>
        </div>
      </section>`).join("");

    chipsEl.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      $$(".chip", chipsEl).forEach((c) => c.setAttribute("aria-selected", c === chip));
      const f = chip.dataset.filter;
      $$(".row", rowsEl).forEach((row) => {
        const show = f === "all" || row.dataset.row === f;
        if (show && row.hidden) {
          row.hidden = false;
          row.classList.add("is-entering");
          requestAnimationFrame(() => requestAnimationFrame(() => row.classList.remove("is-entering")));
        } else if (!show) row.hidden = true;
        updateRow(row);
      });
    });

    function updateRow(row) {
      const track = $(".track", row);
      const max = track.scrollWidth - track.clientWidth;
      const p = max > 0 ? track.scrollLeft / max : 0;
      $(".row__line i", row).style.width = `${Math.max(4, p * 100)}%`;
      const [prev, next] = $$(".arrow", row);
      prev.disabled = track.scrollLeft < 8;
      next.disabled = track.scrollLeft > max - 8;
    }

    $$(".row", rowsEl).forEach((row) => {
      const track = $(".track", row);
      track.addEventListener("scroll", () => updateRow(row), { passive: true });
      $$(".arrow", row).forEach((b) => b.addEventListener("click", () => {
        track.scrollBy({ left: Number(b.dataset.dir) * track.clientWidth * 0.8, behavior: "smooth" });
      }));

      // Arrastar com o mouse (no toque o navegador já faz o swipe nativo)
      let down = false, startX = 0, startLeft = 0, moved = false;
      track.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "mouse" || e.button !== 0 || e.target.closest("a")) return;
        down = true; moved = false; startX = e.clientX; startLeft = track.scrollLeft;
      });
      addEventListener("pointermove", (e) => {
        if (!down) return;
        const dx = e.clientX - startX;
        if (!moved && Math.abs(dx) > 6) { moved = true; track.classList.add("is-dragging"); stopPreview(); }
        if (moved) track.scrollLeft = startLeft - dx;
      });
      addEventListener("pointerup", () => {
        if (!down) return;
        down = false;
        if (moved) {
          const left = track.scrollLeft;
          track.classList.remove("is-dragging");
          track.scrollLeft = left;
          const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
          track.addEventListener("click", swallow, { capture: true, once: true });
          setTimeout(() => track.removeEventListener("click", swallow, { capture: true }), 0);
        }
      });
      updateRow(row);
    });
    addEventListener("resize", () => $$(".row", rowsEl).forEach(updateRow));

    // Prévia ao passar o mouse
    let previewCard = null;
    function startPreview(card) {
      if (previewCard === card) return;
      stopPreview();
      const it = items[card.dataset.idx];
      if (it.yt) return; // vídeo do YouTube: sem prévia, abre no player ao clicar
      let v = $("video", card);
      if (!v) {
        v = document.createElement("video");
        v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto";
        v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
        v.src = previewOf(it);
        const bar = $(".card__bar", card);
        v.addEventListener("timeupdate", () => { if (v.duration) bar.style.width = `${(v.currentTime / v.duration) * 100}%`; });
        card.insertBefore(v, $(".card__top", card));
      }
      previewCard = card;
      v.play().then(() => { if (previewCard === card) card.classList.add("is-playing"); }).catch(() => {});
    }
    function stopPreview() {
      if (!previewCard) return;
      const v = $("video", previewCard);
      if (v) v.pause();
      previewCard.classList.remove("is-playing");
      previewCard = null;
    }
    if (finePointer) {
      rowsEl.addEventListener("pointerover", (e) => {
        const card = e.target.closest(".card[data-idx]");
        if (card && !card.closest(".is-dragging")) startPreview(card);
      });
      rowsEl.addEventListener("pointerout", (e) => {
        const card = e.target.closest(".card[data-idx]");
        if (card && !card.contains(e.relatedTarget)) stopPreview();
      });
    }

    // Player em tela cheia: HLS do Bunny (qualidade se adapta à internet de quem assiste)
    const lb = $("[data-lightbox]");
    const lbVideo = $("[data-lb-video]");
    const lbYt = $("[data-lb-yt]");
    const lbLinks = $("[data-lb-links]");
    const lbPlay = $("[data-lb-play]");
    const lbShare = $("[data-lb-share]");
    let list = [], pos = 0, lastFocus = null, hls = null, hlsLoad = null, listCat = null;
    // HLS nativo só no iPhone (sem MediaSource). Nos outros (inclusive o Chrome novo, que também toca HLS sozinho)
    // usa o hls.js, que deixa escolher a qualidade inicial.
    const nativeHls = lbVideo.canPlayType("application/vnd.apple.mpegurl") && !window.MediaSource;
    const getHls = () => hlsLoad || (hlsLoad = new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = HLS_JS; s.onload = () => ok(window.Hls); s.onerror = fail;
      document.head.appendChild(s);
    }));

    // Celular: controles próprios e discretos (os nativos demoram para sumir e cobrem o vídeo).
    // Toque no vídeo pausa/continua; tempo, som e tela cheia aparecem por 1,5 s e somem sozinhos.
    // No computador continua o player nativo.
    const tp = finePointer ? null : initTouchPlayer();
    function initTouchPlayer() {
      const ico = {
        play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>',
        on: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path class="s" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
        off: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path class="s" d="M17 9l5 6M22 9l-5 6"/></svg>',
        fs: '<svg viewBox="0 0 24 24"><path class="s" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
      };
      const box = document.createElement("div");
      box.className = "lbv";
      lbVideo.removeAttribute("controls");
      lbVideo.before(box);
      box.appendChild(lbVideo);
      box.insertAdjacentHTML("beforeend", `
        <button class="lbv__tap" aria-label="Pausar ou continuar"></button>
        <span class="lbv__state" aria-hidden="true">${ico.play}</span>
        <span class="lbv__spin" aria-hidden="true"></span>
        <div class="lbv__ui">
          <span class="lbv__time">0:00 / 0:00</span>
          <button class="lbv__btn" data-v="mute" aria-label="Som"></button>
          <button class="lbv__btn" data-v="fs" aria-label="Tela cheia">${ico.fs}</button>
        </div>
        <div class="lbv__seek" aria-hidden="true"><i></i></div>`);
      const time = $(".lbv__time", box), fill = $(".lbv__seek i", box), seek = $(".lbv__seek", box), muteBtn = $('[data-v="mute"]', box);
      const t = (s) => (isFinite(s) ? fmtDur(Math.floor(s)) : "0:00");
      let hideT = 0, raf = 0;
      const flashUI = (ms = 1500) => {
        box.classList.add("is-ui");
        clearTimeout(hideT);
        if (!lbVideo.paused) hideT = setTimeout(() => box.classList.remove("is-ui"), ms);
      };
      const draw = () => {
        const d = lbVideo.duration;
        fill.style.width = d ? `${(lbVideo.currentTime / d) * 100}%` : "0%";
        time.textContent = `${t(lbVideo.currentTime)} / ${t(d)}`;
      };
      const loop = () => { draw(); raf = lbVideo.paused ? 0 : requestAnimationFrame(loop); };
      const renderMute = () => { muteBtn.innerHTML = lbVideo.muted ? ico.off : ico.on; };
      lbVideo.addEventListener("play", () => { box.classList.remove("is-paused"); if (box.classList.contains("is-ui")) flashUI(); if (!raf) loop(); });
      lbVideo.addEventListener("pause", () => { box.classList.add("is-paused", "is-ui"); clearTimeout(hideT); draw(); });
      lbVideo.addEventListener("waiting", () => box.classList.add("is-loading"));
      ["playing", "canplay", "pause", "emptied"].forEach((ev) => lbVideo.addEventListener(ev, () => box.classList.remove("is-loading")));
      lbVideo.addEventListener("loadedmetadata", draw);
      lbVideo.addEventListener("volumechange", renderMute);
      renderMute();
      $(".lbv__tap", box).addEventListener("click", () => {
        if (lbVideo.paused) lbVideo.play().catch(() => {});
        else lbVideo.pause();
      });
      muteBtn.addEventListener("click", () => { lbVideo.muted = !lbVideo.muted; flashUI(); });
      $('[data-v="fs"]', box).addEventListener("click", async () => {
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else if (box.requestFullscreen) {
            await box.requestFullscreen();
            // vídeo deitado: gira a tela sozinho
            if (lbVideo.videoWidth > lbVideo.videoHeight && screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(() => {});
          } else if (lbVideo.webkitEnterFullscreen) lbVideo.webkitEnterFullscreen(); // iPhone: tela cheia do próprio sistema
        } catch (e) { if (lbVideo.webkitEnterFullscreen) lbVideo.webkitEnterFullscreen(); }
        if (lbVideo.paused) lbVideo.play().catch(() => {});
        flashUI();
      });
      document.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement && screen.orientation && screen.orientation.unlock) try { screen.orientation.unlock(); } catch (e) { /* ok */ }
      });
      // Arrastar na barrinha adianta/volta
      const seekTo = (x) => {
        const r = seek.getBoundingClientRect();
        if (lbVideo.duration) lbVideo.currentTime = Math.min(1, Math.max(0, (x - r.left) / r.width)) * lbVideo.duration;
        draw();
      };
      seek.addEventListener("pointerdown", (e) => { seek.setPointerCapture(e.pointerId); box.classList.add("is-seeking"); seekTo(e.clientX); flashUI(); });
      seek.addEventListener("pointermove", (e) => { if (seek.hasPointerCapture(e.pointerId)) seekTo(e.clientX); });
      const endSeek = () => { box.classList.remove("is-seeking"); flashUI(); };
      seek.addEventListener("pointerup", endSeek);
      seek.addEventListener("pointercancel", endSeek);
      return {
        box,
        // trocou de vídeo: tela limpa, só a barrinha
        reset() { clearTimeout(hideT); box.classList.remove("is-ui", "is-paused", "is-loading"); fill.style.width = "0%"; time.textContent = "0:00 / 0:00"; },
        // o navegador barrou o play automático: mostra o botão de play no meio
        blocked() { box.classList.add("is-paused", "is-ui"); },
      };
    }

    async function show(i) {
      pos = (i + list.length) % list.length;
      const it = list[pos];
      if (hls) { hls.destroy(); hls = null; }
      lbPlay.hidden = true;
      if (tp) tp.reset();
      $$("[data-lb-prev], [data-lb-next]").forEach((b) => (b.hidden = list.length < 2));
      if (canRoute) history.replaceState(null, "", `/v/${encodeURIComponent(it.id)}`);
      lbShare.textContent = "Compartilhar";
      $("[data-lb-cat]").textContent = `${catLabel[listCat || catsOf(it)[0]] || ""}${it.ia ? " · Criado com IA" : ""}${it.yt && it.channel ? ` · ${it.channel}` : ""}`;
      lbYt.innerHTML = "";
      lbLinks.innerHTML = "";
      lbYt.hidden = !it.yt;
      if (tp) tp.box.hidden = !!it.yt;
      else lbVideo.hidden = !!it.yt;
      if (it.yt) {
        // Vídeo longo do YouTube: toca aqui mesmo, com atalhos pro canal e pro vídeo
        lbVideo.pause(); lbVideo.removeAttribute("src"); lbVideo.load();
        lbYt.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${it.yt}?autoplay=1&rel=0&playsinline=1" title="Vídeo do YouTube" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
        lbLinks.innerHTML = `${it.channelUrl ? `<a class="btn btn--ghost btn--sm" href="${esc(it.channelUrl)}" target="_blank" rel="noopener">Ver o canal ↗</a>` : ""}<a class="btn btn--ghost btn--sm" href="https://www.youtube.com/watch?v=${it.yt}" target="_blank" rel="noopener">Abrir no YouTube ↗</a>`;
        return;
      }
      lbVideo.poster = posterOf(it);
      lbVideo.style.setProperty("--ar", it.w && it.h ? (it.w / it.h).toFixed(4) : ".5625");
      if (nativeHls) lbVideo.src = cdn(it.guid, "playlist.m3u8");
      else {
        try {
          const Hls = await getHls();
          if (list[pos] !== it) return;
          if (Hls.isSupported()) {
            // Começa já em 720p (o Bunny lista o 240p primeiro e o vídeo abria borrado); depois se adapta à internet
            hls = new Hls({ capLevelToPlayerSize: false, abrEwmaDefaultEstimate: 1e7, autoStartLoad: false });
            const h = hls;
            h.on(Hls.Events.MANIFEST_PARSED, (_, d) => {
              const i = d.levels.findIndex((l) => Math.min(l.width || 0, l.height || 0) >= 720);
              if (i >= 0) h.startLevel = i;
              h.startLoad(-1);
            });
            hls.loadSource(cdn(it.guid, "playlist.m3u8"));
            hls.attachMedia(lbVideo);
          } else lbVideo.src = cdn(it.guid, "play_720p.mp4");
        } catch (e) { lbVideo.src = cdn(it.guid, "play_720p.mp4"); }
      }
      // Sem um clique antes (ex.: quem chega pelo link), o navegador pode barrar o play com som: mostra o botão grande
      lbVideo.play().catch(() => {
        if (list[pos] !== it) return;
        if (tp) tp.blocked(); else lbPlay.hidden = false;
      });
    }
    function openLb(card) {
      const it = items[card.dataset.idx];
      openItem(it, card.closest("[data-row]").dataset.row, card);
    }
    function openItem(it, cat, from) {
      stopPreview();
      reel && reel.pause();
      listCat = cat && byCat[cat] ? cat : catsOf(it).find((c) => byCat[c] && byCat[c].includes(it)) || null;
      list = listCat ? byCat[listCat] : [it]; // oculto ("não listado"): abre só ele
      lastFocus = from || null;
      lb.hidden = false;
      document.body.classList.add("is-locked");
      requestAnimationFrame(() => lb.classList.add("is-open"));
      show(list.indexOf(it));
      $("[data-lb-close]").focus({ preventScroll: true });
    }
    function closeLb() {
      lb.classList.remove("is-open");
      lbVideo.pause();
      document.body.classList.remove("is-locked");
      setTimeout(() => {
        lb.hidden = true;
        if (hls) { hls.destroy(); hls = null; }
        lbVideo.removeAttribute("src"); lbVideo.load();
        lbYt.innerHTML = "";
      }, 300);
      if (lastFocus) lastFocus.focus({ preventScroll: true });
      if (canRoute && location.pathname.startsWith("/v/")) history.replaceState(null, "", "/#portfolio");
      reel && reel.resume();
    }
    lbPlay.addEventListener("click", () => { lbPlay.hidden = true; lbVideo.play().catch(() => {}); });
    lbVideo.addEventListener("play", () => (lbPlay.hidden = true));
    lbShare.addEventListener("click", async () => {
      const it = list[pos];
      const url = `${SHARE_ORIGIN}/v/${encodeURIComponent(it.id)}`;
      const title = it.title || `${catLabel[listCat || catsOf(it)[0]] || "Portfólio"} · Arthur Franze`;
      if (navigator.share && matchMedia("(pointer: coarse)").matches) { navigator.share({ title, url }).catch(() => {}); return; }
      try { await navigator.clipboard.writeText(url); lbShare.textContent = "Link copiado ✓"; }
      catch (e) { prompt("Copie o link do vídeo:", url); }
    });

    // Link próprio do vídeo (/v/<id>): já abre ele tocando
    if (openId) {
      const it = C.videos.find((v) => v.id === openId && !v.pending && !v.error && (v.guid || v.yt));
      if (it) openItem(it, null, null);
      else if (canRoute && location.pathname.startsWith("/v/")) history.replaceState(null, "", "/");
    }

    rowsEl.addEventListener("click", (e) => {
      const card = e.target.closest(".card[data-idx]");
      if (card) openLb(card);
    });
    rowsEl.addEventListener("keydown", (e) => {
      const card = e.target.closest(".card[data-idx]");
      if (card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openLb(card); }
    });
    $("[data-lb-close]").addEventListener("click", closeLb);
    $("[data-lb-prev]").addEventListener("click", () => show(pos - 1));
    $("[data-lb-next]").addEventListener("click", () => show(pos + 1));
    lb.addEventListener("click", (e) => { if (e.target === lb) closeLb(); });
    addEventListener("keydown", (e) => {
      if (lb.hidden) return;
      if (e.key === "Escape") closeLb();
      if (e.key === "ArrowRight") show(pos + 1);
      if (e.key === "ArrowLeft") show(pos - 1);
    });
    let sx = 0, sy = 0, onSeek = false;
    lb.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; onSeek = !!e.target.closest(".lbv__seek"); }, { passive: true });
    lb.addEventListener("touchend", (e) => {
      if (onSeek || document.fullscreenElement) return; // arrastando a barrinha ou em tela cheia: não troca nem fecha
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) show(pos + (dx < 0 ? 1 : -1));
      else if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.5) closeLb();
    }, { passive: true });

    // Animações de entrada ------------------------------------------------
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
    }), { threshold: 0.12 });
    $$(".reveal").forEach((el, i) => {
      el.style.setProperty("--d", `${(i % 6) * 0.08}s`);
      io.observe(el);
    });
    setTimeout(() => $$(".hero .reveal").forEach((el) => el.classList.add("is-in")), 60);
  }

  // Roleta do topo ------------------------------------------------------
  // Cada slide é uma face de um cilindro. O slide k fica de frente; k+1 aparece por cima e k-1 por baixo.
  // Avançar gira o cilindro pra baixo. Só as faces fora da vista são reposicionadas, então gira pra sempre.
  function initReel(slides, cdn) {
    const root = $("[data-reel]");
    if (!root || !slides.length) return null;
    const drum = $("[data-drum]", root);
    const tc = $("[data-timecode]", root);
    const countEl = $("[data-reel-count]", root);
    const bar = $("[data-reel-bar]", root);
    const soundBtn = $("[data-reel-sound]", root);
    const playBtn = $("[data-reel-play]", root);
    const dotsEl = $("[data-reel-dots]", root);
    const N = slides.length;
    const back = N >= 3 ? 1 : 0;
    // No celular a roleta é plana (troca com fade): o cilindro 3D "dava zoom" ao rolar a página
    const flatMQ = matchMedia("(max-width: 860px)");
    let flat = flatMQ.matches;
    root.classList.toggle("is-flat", flat);
    const mod = (a) => ((a % N) + N) % N;

    const faces = slides.map((s, j) => {
      const f = document.createElement("div");
      f.className = "reel__face";
      if (s.type === "photo") {
        f.innerHTML = `<img src="${esc(s.src)}" alt="Retrato de Arthur Franze" draggable="false" fetchpriority="high">`;
      } else {
        const v = document.createElement("video");
        v.muted = true; v.playsInline = true; v.preload = j === 1 ? "auto" : "metadata";
        v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
        v.poster = cdn(s.guid, "thumbnail.jpg");
        v.src = cdn(s.guid, "play_720p.mp4");
        v.addEventListener("ended", () => { if (cur() === j) go(1); });
        f.appendChild(v);
      }
      drum.appendChild(f);
      return f;
    });
    const videoOf = (j) => $("video", faces[j]);

    dotsEl.innerHTML = slides.map((s, j) => `<button aria-label="Ir para o item ${j + 1}"></button>`).join("");
    // Barrinhas estilo stories (o CSS só mostra no celular)
    const stories = document.createElement("div");
    stories.className = "reel__stories";
    stories.setAttribute("aria-hidden", "true");
    stories.innerHTML = slides.map(() => "<i><b></b></i>").join("");
    $(".reel__frame", root).appendChild(stories);
    const segs = $$("b", stories);
    if (N < 2) { dotsEl.hidden = true; $$(".reel__peek", root).forEach((b) => (b.hidden = true)); }

    let k = 0, layoutK = 0, R = 0;
    let timer = 0, photoStart = 0, playing = false, visible = true, held = false, soundOn = false;
    const cur = () => mod(k);
    const posAt = (j, base) => base - back + mod(j - (base - back));

    function layout() {
      layoutK = k;
      if (flat) { faces.forEach((f) => { f.style.transform = ""; }); return; }
      faces.forEach((f, j) => {
        const p = posAt(j, layoutK);
        const t = `rotateX(${p * STEP}deg) translateZ(${R}px)`;
        if (f.style.transform !== t) {
          f.style.transform = t;
          f.dataset.p = p;
        }
      });
    }
    function rotate(animate) {
      if (flat) { drum.style.transform = ""; return; }
      drum.classList.toggle("no-anim", !animate);
      drum.style.transform = `translateZ(${-R}px) rotateX(${-k * STEP}deg)`;
    }
    function measure() {
      const H = drum.offsetHeight;
      R = (H * 1.06) / (2 * Math.tan((STEP * Math.PI) / 360));
      layout();
      rotate(false);
    }
    drum.addEventListener("transitionend", (e) => { if (e.target === drum) layout(); });

    function stopCurrent() {
      clearTimeout(timer);
      faces.forEach((f, j) => { const v = videoOf(j); if (v && !v.paused) v.pause(); });
    }
    function activate() {
      stopCurrent();
      const j = cur();
      faces.forEach((f, i) => f.classList.toggle("is-active", i === j));
      $$("button", dotsEl).forEach((b, i) => b.setAttribute("aria-current", i === j));
      countEl.textContent = `${pad(j + 1)} / ${pad(N)}`;
      segs.forEach((s, i) => (s.style.width = i < j ? "100%" : "0%"));
      const v = videoOf(j);
      soundBtn.hidden = !v;
      playBtn.hidden = true;
      const nv = videoOf(mod(j + 1));
      if (nv) nv.preload = "auto";
      bar.style.width = "0%";
      if (!visible || held) return;
      if (v) {
        v.currentTime = 0;
        v.muted = !soundOn;
        v.play().then(() => (playing = true)).catch(() => {
          // sem autoplay (ex.: modo economia no celular): mostra o botão de play
          playing = false; playBtn.hidden = false;
        });
      } else {
        photoStart = performance.now();
        timer = setTimeout(() => go(1), PHOTO_MS);
      }
    }
    let layoutTimer = 0;
    function go(delta) { goTo(mod(cur() + delta), delta); }
    function goTo(j, dir) {
      if (N < 2 || j === cur()) return;
      let p = posAt(j, layoutK);
      // cliques rápidos antes do giro terminar: reposiciona já, pra girar no sentido pedido
      if ((dir > 0 && p <= k) || (dir < 0 && p >= k)) { layout(); p = posAt(j, layoutK); }
      k = p;
      rotate(!reduced);
      clearTimeout(layoutTimer);
      if (reduced) layout(); else layoutTimer = setTimeout(layout, 1300);
      activate();
    }

    function renderSound() {
      soundBtn.innerHTML = soundOn
        ? `<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>Som ligado`
        : `<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>Ativar som`;
      soundBtn.setAttribute("aria-label", soundOn ? "Desligar som" : "Ativar som");
    }
    function toggleSound() {
      soundOn = !soundOn;
      const v = videoOf(cur());
      if (v) { v.muted = !soundOn; if (v.paused) v.play().catch(() => {}); }
      renderSound();
    }
    renderSound();
    soundBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleSound(); });
    playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const v = videoOf(cur());
      if (v) v.play().then(() => { playing = true; playBtn.hidden = true; }).catch(() => {});
    });
    // Toque no vídeo da frente liga/desliga o som (igual Reels); na foto, avança
    drum.addEventListener("click", (e) => {
      const face = e.target.closest(".reel__face");
      if (!face) return;
      const j = faces.indexOf(face);
      // Celular (stories): toque no terço da esquerda volta, no resto avança
      if (flat) { const r = face.getBoundingClientRect(); return go(e.clientX - r.left < r.width / 3 ? -1 : 1); }
      if (j !== cur()) return goTo(j, Number(face.dataset.p) > k ? 1 : -1);
      if (videoOf(j)) toggleSound(); else go(1);
    });
    $("[data-reel-next]", root).addEventListener("click", () => go(1));
    $("[data-reel-prev]", root).addEventListener("click", () => go(-1));
    dotsEl.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b) goTo($$("button", dotsEl).indexOf(b));
    });
    root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); go(1); }
      if (e.key === "ArrowUp") { e.preventDefault(); go(-1); }
    });
    // Swipe lateral no celular (o vertical continua rolando a página)
    let tx = 0, ty = 0;
    root.addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
    root.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
    }, { passive: true });

    // HUD: timecode do vídeo (ou relógio na foto) e barra de progresso
    const t0 = performance.now();
    (function tick() {
      const j = cur();
      const v = videoOf(j);
      let f, p = null;
      if (v) {
        f = Math.floor(v.currentTime * 30);
        if (v.duration) p = v.currentTime / v.duration;
        tc.textContent = `${pad(Math.floor(f / 108000))}:${pad(Math.floor(f / 1800) % 60)}:${pad(Math.floor(f / 30) % 60)}:${pad(f % 30)}`;
      } else {
        f = Math.floor(((performance.now() - t0) / 1000) * 24);
        if (photoStart && !held && visible) p = Math.min(1, (performance.now() - photoStart) / PHOTO_MS);
        tc.textContent = `${pad(Math.floor(f / 86400))}:${pad(Math.floor(f / 1440) % 60)}:${pad(Math.floor(f / 24) % 60)}:${pad(f % 24)}`;
      }
      if (p != null) { bar.style.width = `${p * 100}%`; segs[j].style.width = `${p * 100}%`; }
      requestAnimationFrame(tick);
    })();

    // Pausa quando sai da tela ou quando o player do portfólio abre
    function pause() { held = true; stopCurrent(); }
    function resume() {
      held = false;
      if (!visible) return;
      const v = videoOf(cur());
      if (v) v.play().catch(() => { playBtn.hidden = false; });
      else { photoStart = performance.now(); clearTimeout(timer); timer = setTimeout(() => go(1), PHOTO_MS); }
    }
    new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (!visible) stopCurrent();
      else if (!held) resume();
    }, { threshold: 0.35 }).observe(root);

    measure();
    addEventListener("resize", measure);
    flatMQ.addEventListener("change", () => { flat = flatMQ.matches; root.classList.toggle("is-flat", flat); measure(); });
    activate();
    return { pause, resume };
  }
})();
