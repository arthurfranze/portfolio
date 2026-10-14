(() => {
  const MEDIA = "media/";
  // Os vídeos ficam no GitHub Pages (a Vercel grátis não aceita 650 MB). No preview local, usa a pasta media/videos.
  const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
  const VIDEOS = LOCAL ? `${MEDIA}videos/` : "https://arthurfranze.github.io/portfolio/media/videos/";
  const WHATSAPP = "5544999030219";
  const WA_TEXT = "Olá, Arthur! Vi seu portfólio e quero conversar sobre um projeto.";

  const CATS = [
    { id: "social", label: "Social Media", desc: "Reels, institucionais e conteúdo para redes" },
    { id: "imob", label: "Imobiliário", desc: "Empreendimentos, loteamentos e imóveis" },
    { id: "ecom", label: "E-commerce & Produto", desc: "Anúncios, lançamentos e produto" },
  ];

  const items = window.PORTFOLIO || [];
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const fmtDur = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const ratioLabel = (w, h) => {
    const r = w / h;
    if (r > 1.7) return "16:9";
    if (r > 1.4) return "3:2";
    if (r < 0.6) return "9:16";
    return "4:5";
  };

  // Links e detalhes gerais --------------------------------------------
  const waHref = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(WA_TEXT)}`;
  $$("[data-wa]").forEach((a) => { a.href = waHref; a.target = "_blank"; a.rel = "noopener"; });
  $("[data-year]").textContent = new Date().getFullYear();

  const nav = $(".nav");
  const fab = $(".fab");
  const onScroll = () => {
    const y = scrollY;
    nav.classList.toggle("is-solid", y > 40);
    fab.classList.toggle("is-visible", y > innerHeight * 0.9);
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

  // Timecode do "REC" no retrato
  const tc = $("[data-timecode]");
  const t0 = performance.now();
  const pad = (n) => String(n).padStart(2, "0");
  setInterval(() => {
    const f = Math.floor(((performance.now() - t0) / 1000) * 24);
    tc.textContent = `${pad(Math.floor(f / 86400))}:${pad(Math.floor(f / 1440) % 60)}:${pad(Math.floor(f / 24) % 60)}:${pad(f % 24)}`;
  }, 1000 / 24);

  // Portfólio ----------------------------------------------------------
  const chipsEl = $("[data-chips]");
  const rowsEl = $("[data-rows]");
  const catLabel = Object.fromEntries(CATS.map((c) => [c.id, c.label]));
  const byCat = Object.fromEntries(CATS.map((c) => [c.id, items.filter((i) => i.cat === c.id)]));

  const chipDefs = [{ id: "all", label: "Todos", n: items.length }, ...CATS.map((c) => ({ id: c.id, label: c.label, n: byCat[c.id].length }))];
  chipsEl.innerHTML = chipDefs.map((c, i) =>
    `<button class="chip" role="tab" aria-selected="${i === 0}" data-filter="${c.id}">${c.label}<sup>${c.n}</sup></button>`).join("");

  const arrowSvg = (d) => `<svg viewBox="0 0 24 24"><path d="${d}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const playSvg = `<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>`;

  const cardHTML = (it) => `
    <article class="card${it.w > it.h ? " card--h" : ""}" tabindex="0" role="button" aria-label="Assistir vídeo ${byCat[it.cat].indexOf(it) + 1} de ${catLabel[it.cat]}" data-idx="${items.indexOf(it)}" style="--ar:${it.w} / ${it.h}">
      <img src="${MEDIA}posters/${it.id}.webp" alt="" loading="lazy" decoding="async" draggable="false">
      <div class="card__top">
        <span class="badge">${ratioLabel(it.w, it.h)}</span>
        <span class="card__badges">${it.ia ? '<span class="badge badge--ia">IA</span>' : ""}<span class="badge">${fmtDur(it.dur)}</span></span>
      </div>
      <span class="card__play">${playSvg}</span>
      <span class="card__bar"></span>
    </article>`;

  rowsEl.innerHTML = CATS.map((c, ci) => `
    <section class="row" data-row="${c.id}" aria-label="${c.label}">
      <div class="row__head">
        <span class="row__n">${String(ci + 1).padStart(2, "0")}</span>
        <h3 class="row__title">${c.label}</h3>
        <span class="row__count">${byCat[c.id].length} projetos</span>
        <span class="row__line"><i></i></span>
        <div class="row__arrows">
          <button class="arrow" data-dir="-1" aria-label="Voltar">${arrowSvg("M15 5l-7 7 7 7")}</button>
          <button class="arrow" data-dir="1" aria-label="Avançar">${arrowSvg("M9 5l7 7-7 7")}</button>
        </div>
      </div>
      <div class="track">
        ${byCat[c.id].map(cardHTML).join("")}
        <div class="card card--end" data-end>
          <b>Gostou?<br>Vamos fazer o seu.</b>
          <span>Me conta a sua ideia no WhatsApp.</span>
          <a class="btn btn--accent btn--sm" href="${waHref}" target="_blank" rel="noopener">Pedir orçamento</a>
        </div>
      </div>
    </section>`).join("");

  // Filtros
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

  // Carrosséis: arrastar, setas e progresso
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
        // devolve o snap suavemente depois de soltar
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
    let v = $("video", card);
    if (!v) {
      v = document.createElement("video");
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto";
      v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
      v.src = `${VIDEOS}${it.id}.mp4`;
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

  // Player em tela cheia ------------------------------------------------
  const lb = $("[data-lightbox]");
  const lbVideo = $("[data-lb-video]");
  let list = [], pos = 0, lastFocus = null;

  function show(i) {
    pos = (i + list.length) % list.length;
    const it = list[pos];
    lbVideo.poster = `${MEDIA}posters/${it.id}.webp`;
    lbVideo.src = `${VIDEOS}${it.id}.mp4`;
    lbVideo.style.aspectRatio = `${it.w} / ${it.h}`;
    $("[data-lb-cat]").textContent = `${catLabel[it.cat]}${it.ia ? " · Criado com IA" : ""}`;
    lbVideo.play().catch(() => {});
  }
  function openLb(card) {
    const it = items[card.dataset.idx];
    stopPreview();
    list = byCat[it.cat];
    lastFocus = card;
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
    setTimeout(() => { lb.hidden = true; lbVideo.removeAttribute("src"); lbVideo.load(); }, 300);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
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
  // Swipe lateral no celular troca de vídeo
  let sx = 0, sy = 0;
  lb.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  lb.addEventListener("touchend", (e) => {
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
  // O topo já está na tela: entra no carregamento, sem depender do observer
  setTimeout(() => $$(".hero .reveal").forEach((el) => el.classList.add("is-in")), 60);
})();
