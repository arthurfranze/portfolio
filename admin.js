(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const pad = (n) => String(n).padStart(2, "0");
  const fmtDur = (s) => `${Math.floor((s || 0) / 60)}:${pad((s || 0) % 60)}`;
  const slug = (t) => String(t).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
  const ICON = {
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  };

  let C = null; // conteúdo do site sendo editado
  let sha = null; // versão do content.json no GitHub
  let dirty = false;
  let saving = false;
  const localCovers = new Map(); // capas recém-enviadas (mostradas aqui antes de o GitHub publicar)
  const uploadsActive = new Set();

  const cdn = (guid, file) => `https://${C.bunnyCdn}/${guid}/${file}`;
  const posterOf = (it) => {
    if (localCovers.has(it.id)) return localCovers.get(it.id);
    if (it.poster && it.poster.startsWith("bunny:")) return cdn(it.guid, it.poster.slice(6));
    if (it.poster) return it.poster;
    if (it.yt) return ytThumb(it.yt);
    return it.guid ? cdn(it.guid, "thumbnail.jpg") : "";
  };
  const ytThumb = (id, q = "maxresdefault") => `https://i.ytimg.com/vi/${id}/${q}.jpg`;
  const parseDur = (t) => String(t).trim().split(":").reduce((a, n) => a * 60 + (Number(n) || 0), 0);

  // API -------------------------------------------------------------------
  async function api(url, opts = {}) {
    const r = await fetch(url, {
      ...opts,
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      body: opts.body && typeof opts.body !== "string" ? JSON.stringify(opts.body) : opts.body,
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && !url.includes("/api/login")) { showLogin(); throw new Error("Sessão expirada, entre de novo."); }
    if (!r.ok) throw Object.assign(new Error(data.error || `Erro ${r.status}`), { status: r.status });
    return data;
  }

  function toast(msg, error = false) {
    const t = $("[data-toast]");
    t.textContent = msg;
    t.classList.toggle("is-error", error);
    t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (t.hidden = true), error ? 6000 : 3200);
  }

  function setStatus(text, cls = "") {
    const s = $("[data-status]");
    s.textContent = text;
    s.className = `bar__status ${cls}`;
  }
  function markDirty() {
    dirty = true;
    $("[data-save]").disabled = false;
    setStatus("● Alterações não salvas", "is-dirty");
  }

  let queued = null;
  async function save(message) {
    // um save de cada vez; se pedirem outro no meio, ele roda logo depois
    if (saving) { queued = message || queued || "Painel: atualiza o conteúdo do site"; return; }
    saving = true;
    $("[data-save]").disabled = true;
    setStatus("Salvando…");
    try {
      const r = await api("/api/content", { method: "PUT", body: { content: C, sha, message } });
      sha = r.sha;
      dirty = false;
      setStatus("✓ Salvo · o site atualiza em até 1 minuto", "is-ok");
    } catch (e) {
      $("[data-save]").disabled = false;
      setStatus("● Alterações não salvas", "is-dirty");
      dirty = true;
      if (e.status === 409) toast("O conteúdo foi alterado em outra aba ou aparelho. Recarregue a página para pegar a versão mais nova.", true);
      else toast(`Não deu para salvar: ${e.message}`, true);
    } finally {
      saving = false;
      if (queued) { const m = queued; queued = null; save(m); }
    }
  }

  addEventListener("beforeunload", (e) => {
    if (dirty || uploadsActive.size) { e.preventDefault(); e.returnValue = ""; }
  });

  // Login -------------------------------------------------------------------
  function showLogin() {
    $("[data-view=app]").hidden = true;
    $("[data-view=login]").hidden = false;
    $("[data-login] input").focus();
  }
  $("[data-login]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const err = $("[data-login-error]");
    err.hidden = true;
    form.querySelector("button").disabled = true;
    try {
      await api("/api/login", { method: "POST", body: { password: form.password.value } });
      form.reset();
      await boot();
    } catch (ex) {
      err.textContent = ex.status === 401 ? "Senha incorreta." : ex.message;
      err.hidden = false;
    } finally {
      form.querySelector("button").disabled = false;
    }
  });
  $("[data-logout]").addEventListener("click", async () => {
    if (dirty && !confirm("Você tem alterações não salvas. Sair mesmo assim?")) return;
    await api("/api/login", { method: "DELETE" }).catch(() => {});
    dirty = false;
    location.reload();
  });

  async function boot() {
    const r = await api("/api/content?admin=1");
    C = r.content;
    sha = r.sha;
    $("[data-view=login]").hidden = true;
    $("[data-view=app]").hidden = false;
    setStatus("Tudo salvo");
    renderAll();
    pollPending();
  }

  // Abas ------------------------------------------------------------------
  $(".tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    $$(".tabs [data-tab]").forEach((t) => t.setAttribute("aria-selected", t === b));
    $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
  });
  $("[data-save]").addEventListener("click", () => save());
  addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); if (dirty) save(); }
  });

  function renderAll() {
    renderPortfolio();
    renderReel();
    renderTexts();
  }

  // Portfólio -------------------------------------------------------------
  const tileHTML = (it) => `
    <div class="tile${it.hidden ? " is-hidden" : ""}" data-id="${esc(it.id)}" style="--ar:${it.w || 9} / ${it.h || 16}" tabindex="0">
      <img src="${esc(posterOf(it))}" alt="" loading="lazy" onerror="${it.yt && !it.poster ? `this.onerror=null;this.src='${ytThumb(it.yt, "hqdefault")}'` : "this.style.visibility='hidden'"}">
      <div class="tile__badges">
        ${it.yt ? '<span class="badge badge--yt">YOUTUBE</span>' : ""}
        ${it.ia ? '<span class="badge badge--ia">IA</span>' : ""}
        ${it.hidden ? '<span class="badge">OCULTO</span>' : ""}
        ${it.pending ? `<span class="badge badge--proc" data-proc="${esc(it.id)}">PROCESSANDO</span>` : ""}
        ${it.error ? '<span class="badge badge--warn">ERRO</span>' : ""}
        ${it.dur ? `<span class="badge">${fmtDur(it.dur)}</span>` : ""}
      </div>
      <div class="tile__actions">
        <button data-act="ia" class="${it.ia ? "is-on" : ""}" title="Selo de IA">IA</button>
        <button data-act="hide" title="${it.hidden ? "Mostrar no site" : "Ocultar do site"}">${it.hidden ? ICON.eyeOff : ICON.eye}</button>
        <button data-act="edit" title="Editar capa, categoria…">${ICON.edit}</button>
      </div>
    </div>`;

  function renderPortfolio() {
    const wrap = $("[data-cats]");
    wrap.innerHTML = C.categories.map((c) => {
      const vids = C.videos.filter((v) => v.cat === c.id);
      return `
      <section class="cat${c.hidden ? " is-hidden" : ""}" data-cat="${esc(c.id)}">
        <div class="cat__head">
          <span class="cat__handle" title="Arraste para reordenar">⋮⋮</span>
          <input class="cat__name" value="${esc(c.label)}" aria-label="Nome da categoria">
          <span class="cat__count">${vids.length} vídeos</span>
          <div class="cat__tools">
            <button class="icon-btn" data-cat-act="hide" title="${c.hidden ? "Mostrar categoria no site" : "Ocultar categoria do site"}">${c.hidden ? ICON.eyeOff : ICON.eye}</button>
            <button class="icon-btn" data-cat-act="del" title="Apagar categoria">${ICON.trash}</button>
          </div>
        </div>
        <div class="grid" data-grid="${esc(c.id)}">
          ${vids.map(tileHTML).join("")}
          <label class="tile tile--add" data-add-to="${esc(c.id)}"><span><b>+</b>Adicionar vídeos</span><input type="file" accept="video/*" multiple hidden></label>
          <button class="tile tile--add tile--yt" data-yt-to="${esc(c.id)}"><span><b>+</b>Link do YouTube</span></button>
        </div>
      </section>`;
    }).join("");

    // Categorias: arrastar pela alça
    new Sortable(wrap, {
      handle: ".cat__handle", animation: 180,
      onEnd: () => {
        const order = $$(".cat", wrap).map((s) => s.dataset.cat);
        C.categories.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
        markDirty();
      },
    });
    // Vídeos: arrastar dentro e entre categorias
    $$("[data-grid]", wrap).forEach((g) => new Sortable(g, {
      group: "videos", animation: 180, draggable: ".tile:not(.tile--add)", filter: ".tile__actions", preventOnFilter: false,
      onEnd: () => { rebuildVideoOrder(); renderPortfolio(); markDirty(); },
    }));
  }

  function rebuildVideoOrder() {
    const byId = new Map(C.videos.map((v) => [v.id, v]));
    const ordered = [];
    $$("[data-grid]").forEach((g) => $$(".tile[data-id]", g).forEach((t) => {
      const v = byId.get(t.dataset.id);
      if (!v) return;
      v.cat = g.dataset.grid;
      ordered.push(v);
      byId.delete(v.id);
    }));
    C.videos = [...ordered, ...byId.values()];
  }

  $("[data-cats]").addEventListener("click", (e) => {
    const tile = e.target.closest(".tile[data-id]");
    const act = e.target.closest("[data-act]");
    if (tile && act) {
      const v = C.videos.find((x) => x.id === tile.dataset.id);
      if (act.dataset.act === "ia") { v.ia = !v.ia; renderPortfolio(); markDirty(); }
      if (act.dataset.act === "hide") { v.hidden = !v.hidden; renderPortfolio(); markDirty(); }
      if (act.dataset.act === "edit") openEditor(v, "video");
      return;
    }
    const ytBtn = e.target.closest("[data-yt-to]");
    if (ytBtn) return addYoutube(ytBtn.dataset.ytTo);
    const catBtn = e.target.closest("[data-cat-act]");
    if (catBtn) {
      const id = catBtn.closest("[data-cat]").dataset.cat;
      const cat = C.categories.find((c) => c.id === id);
      if (catBtn.dataset.catAct === "hide") { cat.hidden = !cat.hidden; renderPortfolio(); markDirty(); }
      if (catBtn.dataset.catAct === "del") {
        if (C.videos.some((v) => v.cat === id)) return toast("Mova ou apague os vídeos dessa categoria antes de apagá-la.", true);
        if (!confirm(`Apagar a categoria "${cat.label}"?`)) return;
        C.categories = C.categories.filter((c) => c.id !== id);
        renderPortfolio(); markDirty();
      }
    }
  });
  $("[data-cats]").addEventListener("dblclick", (e) => {
    const tile = e.target.closest(".tile[data-id]");
    if (tile) openEditor(C.videos.find((x) => x.id === tile.dataset.id), "video");
  });
  $("[data-cats]").addEventListener("input", (e) => {
    if (!e.target.matches(".cat__name")) return;
    C.categories.find((c) => c.id === e.target.closest("[data-cat]").dataset.cat).label = e.target.value;
    markDirty();
  });
  $("[data-cats]").addEventListener("change", (e) => {
    if (e.target.matches("[data-add-to] input")) {
      uploadFiles([...e.target.files], { cat: e.target.closest("[data-add-to]").dataset.addTo });
      e.target.value = "";
    }
  });
  $("[data-add-cat]").addEventListener("click", () => {
    const label = prompt("Nome da nova categoria:");
    if (!label || !label.trim()) return;
    let id = slug(label), n = 2;
    while (C.categories.some((c) => c.id === id)) id = `${slug(label)}-${n++}`;
    C.categories.push({ id, label: label.trim() });
    renderPortfolio(); markDirty();
    toast("Categoria criada. Ela aparece no site quando tiver vídeos.");
  });

  // Roleta do topo ----------------------------------------------------------
  function renderReel() {
    const list = $("[data-reel-list]");
    list.innerHTML = C.reel.map((s, i) => {
      if (s.type === "photo") return `
        <div class="tile${s.hidden ? " is-hidden" : ""}" data-i="${i}" style="--ar: 9 / 16">
          <img src="${esc(localCovers.get("reel-photo") || s.src)}" alt="">
          <div class="tile__badges"><span class="badge">FOTO</span>${s.hidden ? '<span class="badge">OCULTO</span>' : ""}</div>
          <span class="tile__n">${pad(i + 1)}</span>
          <div class="tile__actions">
            <button type="button" data-r="photo" title="Trocar foto">${ICON.edit}</button><input type="file" accept="image/*" hidden data-photo-input>
            <button data-r="hide" title="${s.hidden ? "Mostrar" : "Ocultar"}">${s.hidden ? ICON.eyeOff : ICON.eye}</button>
          </div>
        </div>`;
      return `
        <div class="tile${s.hidden ? " is-hidden" : ""}" data-i="${i}" style="--ar:${s.w || 9} / ${s.h || 16}">
          <img src="${esc(posterOf(s))}" alt="" onerror="this.style.visibility='hidden'">
          <div class="tile__badges">
            ${s.hidden ? '<span class="badge">OCULTO</span>' : ""}
            ${s.pending ? `<span class="badge badge--proc" data-proc="${esc(s.id)}">PROCESSANDO</span>` : ""}
            <span class="badge">${fmtDur(s.dur)}</span>
          </div>
          <span class="tile__n">${pad(i + 1)}</span>
          <div class="tile__actions">
            <button data-r="edit" title="Editar capa">${ICON.edit}</button>
            <button data-r="hide" title="${s.hidden ? "Mostrar" : "Ocultar"}">${s.hidden ? ICON.eyeOff : ICON.eye}</button>
          </div>
        </div>`;
    }).join("") + `<label class="tile tile--add" style="--tile-h:300px"><span><b>+</b>Adicionar vídeos de apresentação</span><input type="file" accept="video/*" multiple hidden data-reel-add></label>`;

    new Sortable(list, {
      animation: 180, draggable: ".tile:not(.tile--add)", filter: ".tile__actions", preventOnFilter: false,
      onEnd: () => {
        const order = $$(".tile[data-i]", list).map((t) => C.reel[Number(t.dataset.i)]);
        C.reel = order;
        renderReel(); markDirty();
      },
    });
  }
  $("[data-reel-list]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-r]");
    if (!b) return;
    const s = C.reel[Number(b.closest("[data-i]").dataset.i)];
    if (b.dataset.r === "hide") {
      if (!s.hidden && C.reel.filter((x) => !x.hidden).length <= 1) return toast("A roleta precisa ter pelo menos um item visível.", true);
      s.hidden = !s.hidden; renderReel(); markDirty();
    }
    if (b.dataset.r === "edit") openEditor(s, "reel");
    if (b.dataset.r === "photo") b.parentElement.querySelector("[data-photo-input]").click();
  });
  $("[data-reel-list]").addEventListener("change", async (e) => {
    if (e.target.matches("[data-reel-add]")) { uploadFiles([...e.target.files], { reel: true }); e.target.value = ""; }
    if (e.target.matches("[data-photo-input]")) {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file) return;
      const s = C.reel.find((x) => x.type === "photo");
      try {
        toast("Enviando a foto…");
        const blob = await shrinkImage(file, 1600);
        const { url } = await api("/api/cover", { method: "POST", body: { name: "foto-perfil", ext: "jpg", data: await toBase64(blob) } });
        localCovers.set("reel-photo", URL.createObjectURL(blob));
        s.src = url;
        renderReel();
        await save("Painel: troca a foto do topo");
      } catch (ex) { toast(`Não deu para enviar a foto: ${ex.message}`, true); }
    }
  });

  // Editor de vídeo (capa, categoria, selo, apagar) -------------------------
  const modal = $("[data-modal]");
  const mVideo = $("[data-m-video]");
  const mYt = $("[data-m-yt]");
  let editing = null;

  async function openEditor(it, kind) {
    editing = { it, kind };
    mVideo.hidden = !!it.yt;
    mYt.hidden = !it.yt;
    mYt.innerHTML = it.yt ? `<iframe src="https://www.youtube-nocookie.com/embed/${it.yt}?rel=0" title="Vídeo do YouTube" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>` : "";
    mVideo.poster = posterOf(it);
    mVideo.src = it.guid ? cdn(it.guid, "play_720p.mp4") : "";
    mVideo.style.aspectRatio = `${it.w || 9} / ${it.h || 16}`;
    renderEditor(18);
    modal.hidden = false;
    document.body.classList.add("is-locked");
    if (it.guid) api(`/api/video?guid=${it.guid}`).then((v) => { if (editing && editing.it === it && v.thumbs) renderEditor(v.thumbs); }).catch(() => {});
  }
  function closeEditor() {
    modal.hidden = true;
    document.body.classList.remove("is-locked");
    mVideo.pause(); mVideo.removeAttribute("src"); mVideo.load();
    mYt.innerHTML = "";
    editing = null;
    renderPortfolio(); renderReel();
  }
  $("[data-modal-close]").addEventListener("click", closeEditor);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeEditor(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeEditor(); });

  function renderEditor(thumbCount) {
    const { it, kind } = editing;
    const ar = `--ar:${it.w || 9} / ${it.h || 16}`;
    const current = it.poster || "bunny:thumbnail.jpg";
    const thumbs = it.guid ? ["thumbnail.jpg", ...Array.from({ length: thumbCount }, (_, i) => `thumbnail_${i + 1}.jpg`)] : [];
    $("[data-m-side]").innerHTML = `
      <h3>${kind === "reel" ? "Vídeo de apresentação" : "Editar vídeo"}</h3>
      ${kind === "video" ? `
        <label class="field"><span>Categoria</span>
          <select data-e="cat">${C.categories.map((c) => `<option value="${esc(c.id)}"${c.id === it.cat ? " selected" : ""}>${esc(c.label)}</option>`).join("")}</select>
        </label>
        <label class="check"><input type="checkbox" data-e="ia"${it.ia ? " checked" : ""}><span>Mostrar o selo <b>IA</b> (feito com inteligência artificial)</span></label>` : ""}
      <label class="check"><input type="checkbox" data-e="hidden"${it.hidden ? " checked" : ""}><span>Ocultar do site</span></label>
      ${it.yt ? `
        <label class="field"><span>Nome do canal</span><input data-e="channel" value="${esc(it.channel || "")}"><small>Aparece no card. Deixe em branco para esconder.</small></label>
        <label class="field"><span>Duração</span><input data-e="dur" value="${it.dur ? fmtDur(it.dur) : ""}" placeholder="ex.: 25:40"><small>Minutos:segundos. Deixe em branco para esconder.</small></label>
        <div class="btns"><a class="btn btn--ghost btn--sm" href="https://www.youtube.com/watch?v=${it.yt}" target="_blank" rel="noopener">Abrir no YouTube ↗</a></div>` : ""}
      <div class="field"><span>Capa</span>
        <div class="cover-now" style="${ar}"><img src="${esc(posterOf(it))}" alt=""><small>${it.yt ? "Capa atual. Escolha outra abaixo ou envie uma imagem." : "Capa atual. Escolha outra abaixo, use o frame que está pausado no vídeo ou envie uma imagem."}</small></div>
      </div>
      <div class="btns">
        ${it.yt ? "" : '<button class="btn btn--ghost btn--sm" data-e="frame">Usar o frame atual do vídeo</button>'}
        <label class="btn btn--ghost btn--sm">Enviar imagem…<input type="file" accept="image/*" hidden data-e="file"></label>
      </div>
      ${it.yt ? `<div class="field"><span>Capas do YouTube</span><div class="thumbs" style="--ar: 16 / 9">
        ${["maxresdefault", "sddefault", "hqdefault"].map((q, i) => `<button data-ytthumb="${i ? ytThumb(it.yt, q) : ""}" aria-pressed="${(it.poster || "") === (i ? ytThumb(it.yt, q) : "")}" title="Usar esta capa"><img src="${esc(ytThumb(it.yt, q))}" alt="" loading="lazy" onerror="this.parentElement.remove()"></button>`).join("")}
      </div></div>` : ""}
      ${thumbs.length ? `<div class="field"><span>Capas automáticas</span><div class="thumbs" style="${ar}">
        ${thumbs.map((t) => `<button data-thumb="${t}" aria-pressed="${current === "bunny:" + t}" title="Usar esta capa"><img src="${esc(cdn(it.guid, t))}" alt="" loading="lazy" onerror="this.parentElement.remove()"></button>`).join("")}
      </div></div>` : ""}
      <div class="btns" style="margin-top:8px">
        <button class="btn btn--danger btn--sm" data-e="delete">${it.yt ? "Remover do portfólio" : "Apagar vídeo"}</button>
      </div>`;
  }

  $("[data-m-side]").addEventListener("change", async (e) => {
    const { it } = editing;
    const k = e.target.dataset.e;
    if (k === "cat") { it.cat = e.target.value; markDirty(); }
    if (k === "ia") { it.ia = e.target.checked; markDirty(); }
    if (k === "hidden") { it.hidden = e.target.checked; markDirty(); }
    if (k === "channel") { it.channel = e.target.value.trim(); markDirty(); }
    if (k === "dur") { it.dur = parseDur(e.target.value); markDirty(); }
    if (k === "file" && e.target.files[0]) {
      const blob = await shrinkImage(e.target.files[0], 1080);
      await setCustomCover(it, blob);
    }
  });
  $("[data-m-side]").addEventListener("click", async (e) => {
    const { it, kind } = editing;
    const ytb = e.target.closest("[data-ytthumb]");
    if (ytb) {
      it.poster = ytb.dataset.ytthumb || null;
      localCovers.delete(it.id);
      markDirty();
      renderEditor(0);
      return;
    }
    const thumb = e.target.closest("[data-thumb]");
    if (thumb) {
      it.poster = `bunny:${thumb.dataset.thumb}`;
      localCovers.delete(it.id);
      markDirty();
      renderEditor($$("[data-thumb]").length - 1);
      return;
    }
    const k = e.target.closest("[data-e]")?.dataset.e;
    if (k === "frame") {
      if (!mVideo.videoWidth) return toast("Dê play no vídeo e pause no frame que você quer.", true);
      const cv = document.createElement("canvas");
      cv.width = mVideo.videoWidth; cv.height = mVideo.videoHeight;
      try {
        cv.getContext("2d").drawImage(mVideo, 0, 0);
        const blob = await new Promise((ok) => cv.toBlob(ok, "image/jpeg", 0.88));
        await setCustomCover(it, blob);
      } catch (ex) { toast("Não deu para capturar esse frame. Tente enviar uma imagem.", true); }
    }
    if (k === "delete") {
      const where = kind === "reel" ? "da roleta do topo" : "do portfólio";
      const msg = it.yt ? "Remover este vídeo do portfólio? Ele continua normalmente no YouTube."
        : `Apagar este vídeo ${where}? O arquivo também será apagado do Bunny e não dá para desfazer.`;
      if (!confirm(msg)) return;
      if (kind === "reel") {
        if (C.reel.filter((x) => !x.hidden && x !== it).length < 1) return toast("A roleta precisa ter pelo menos um item visível.", true);
        C.reel = C.reel.filter((x) => x !== it);
      } else C.videos = C.videos.filter((x) => x !== it);
      if (it.guid) api(`/api/video?guid=${it.guid}`, { method: "DELETE" }).catch(() => {});
      closeEditor();
      await save("Painel: apaga um vídeo");
    }
  });

  async function setCustomCover(it, blob) {
    try {
      toast("Enviando a capa…");
      const { url } = await api("/api/cover", { method: "POST", body: { name: it.id, ext: "jpg", data: await toBase64(blob) } });
      it.poster = url;
      localCovers.set(it.id, URL.createObjectURL(blob));
      markDirty();
      renderEditor($$("[data-thumb]").length - 1 || 18);
      toast("Capa trocada. Clique em Salvar alterações.");
    } catch (ex) { toast(`Não deu para enviar a capa: ${ex.message}`, true); }
  }

  const toBase64 = (blob) => new Promise((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1]);
    r.onerror = fail;
    r.readAsDataURL(blob);
  });
  async function shrinkImage(file, max) {
    const img = await createImageBitmap(file);
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const cv = document.createElement("canvas");
    cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    return new Promise((ok) => cv.toBlob(ok, "image/jpeg", 0.88));
  }

  // Textos ------------------------------------------------------------------
  const get = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), C);
  const set = (path, val) => {
    const keys = path.split(".");
    const last = keys.pop();
    keys.reduce((o, k) => o[k], C)[last] = val;
  };
  const field = (path, label, opts = {}) => {
    const v = esc(get(path));
    const input = opts.area
      ? `<textarea data-path="${path}" rows="${opts.rows || 3}">${v}</textarea>`
      : `<input data-path="${path}" value="${v}"${opts.type ? ` type="${opts.type}"` : ""}>`;
    return `<label class="field"><span>${label}</span>${input}${opts.help ? `<small>${opts.help}</small>` : ""}</label>`;
  };

  function renderTexts() {
    $("[data-texts]").innerHTML = `
      <div class="fieldset"><h3>Topo</h3>
        ${field("texts.heroName", "Nome", { area: true, rows: 2, help: "Enter quebra a linha; *assim* fica em itálico dourado." })}
        ${field("texts.heroLead", "Frase principal")}
        ${field("texts.heroDesc", "Descrição", { area: true, rows: 4 })}
      </div>
      <div class="fieldset"><h3>Números</h3>
        ${C.stats.map((s, i) => `
          <div class="item"><div class="item__head"><b>${pad(i + 1)}</b><span class="grow"></span>
            <button class="icon-btn" data-list="stats" data-move="-1" data-i="${i}" title="Subir">${ICON.up}</button>
            <button class="icon-btn" data-list="stats" data-move="1" data-i="${i}" title="Descer">${ICON.down}</button>
            <button class="icon-btn" data-list="stats" data-del data-i="${i}" title="Remover">${ICON.trash}</button></div>
            <div class="row2">${field(`stats.${i}.value`, "Número")}${field(`stats.${i}.label`, "Legenda")}</div>
          </div>`).join("")}
        <button class="btn btn--ghost btn--sm" data-list-add="stats">+ Adicionar número</button>
      </div>
      <div class="fieldset"><h3>Serviços</h3>
        ${C.services.map((s, i) => `
          <div class="item"><div class="item__head"><b>${pad(i + 1)}</b><span class="grow"></span>
            <button class="icon-btn" data-list="services" data-move="-1" data-i="${i}" title="Subir">${ICON.up}</button>
            <button class="icon-btn" data-list="services" data-move="1" data-i="${i}" title="Descer">${ICON.down}</button>
            <button class="icon-btn" data-list="services" data-del data-i="${i}" title="Remover">${ICON.trash}</button></div>
            ${field(`services.${i}.title`, "Título")}
            ${field(`services.${i}.text`, "Texto", { area: true })}
            <label class="field"><span>Etiquetas</span><input data-tags="${i}" value="${esc(s.tags.join(", "))}"><small>Separe por vírgula.</small></label>
          </div>`).join("")}
        <button class="btn btn--ghost btn--sm" data-list-add="services">+ Adicionar serviço</button>
      </div>
      <div class="fieldset"><h3>Portfólio</h3>
        <div class="row2">${field("texts.portfolioKicker", "Etiqueta")}${field("texts.portfolioTitle", "Título")}</div>
      </div>
      <div class="fieldset"><h3>Contato</h3>
        ${field("texts.contactTitle", "Título", { area: true, rows: 2 })}
        ${field("texts.contactDesc", "Texto")}
        <div class="row2">
          ${field("contact.whatsapp", "WhatsApp (só números)", { help: "Com 55 + DDD, ex.: 5544999030219" })}
          ${field("contact.whatsappLabel", "WhatsApp como aparece no site")}
        </div>
        ${field("contact.whatsappText", "Mensagem que já vem escrita no WhatsApp", { area: true, rows: 2 })}
        <div class="row2">
          ${field("contact.instagram", "Instagram (sem @)")}
          ${field("contact.email", "E-mail", { type: "email" })}
        </div>
        ${field("texts.footer", "Rodapé")}
      </div>`;
  }
  const blank = { stats: () => ({ value: "", label: "" }), services: () => ({ title: "Novo serviço", text: "", tags: [] }) };
  $("[data-texts]").addEventListener("input", (e) => {
    if (e.target.dataset.path) { set(e.target.dataset.path, e.target.value); markDirty(); }
    if (e.target.dataset.tags != null) {
      C.services[Number(e.target.dataset.tags)].tags = e.target.value.split(",").map((t) => t.trim()).filter(Boolean);
      markDirty();
    }
  });
  $("[data-texts]").addEventListener("click", (e) => {
    const add = e.target.closest("[data-list-add]");
    if (add) { C[add.dataset.listAdd].push(blank[add.dataset.listAdd]()); renderTexts(); markDirty(); return; }
    const b = e.target.closest("[data-list]");
    if (!b) return;
    const arr = C[b.dataset.list];
    const i = Number(b.dataset.i);
    if (b.hasAttribute("data-del")) {
      if (!confirm("Remover este item?")) return;
      arr.splice(i, 1);
    } else {
      const j = i + Number(b.dataset.move);
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    renderTexts(); markDirty();
  });

  // Envio de vídeos (direto do navegador pro Bunny) ------------------------
  const dock = $("[data-uploads]");
  function readMeta(file) {
    return new Promise((ok) => {
      const v = document.createElement("video");
      v.preload = "metadata"; v.muted = true;
      const url = URL.createObjectURL(file);
      const done = (m) => { URL.revokeObjectURL(url); ok(m); };
      v.onloadedmetadata = () => done({ w: v.videoWidth || 1080, h: v.videoHeight || 1920, dur: Math.round(v.duration || 0) });
      v.onerror = () => done({ w: 1080, h: 1920, dur: 0 });
      v.src = url;
    });
  }
  function dockRow(name) {
    dock.hidden = false;
    if (!$("h4", dock)) dock.insertAdjacentHTML("afterbegin", "<h4>Enviando vídeos</h4>");
    const row = document.createElement("div");
    row.className = "up";
    row.innerHTML = `<div class="up__top"><span>${esc(name)}</span><span data-pct>0%</span></div><div class="up__bar"><i></i></div>`;
    dock.appendChild(row);
    return {
      set(p, text) { $("i", row).style.width = `${p}%`; $("[data-pct]", row).textContent = text || `${Math.round(p)}%`; },
      done(text) { row.classList.add("is-done"); this.set(100, text); setTimeout(() => { row.remove(); if (!$(".up", dock)) dock.hidden = true; }, 8000); },
      fail(text) { row.classList.add("is-error"); $("[data-pct]", row).textContent = text; },
    };
  }

  async function uploadFiles(files, target) {
    for (const file of files) {
      const ui = dockRow(file.name);
      const key = Symbol(file.name);
      uploadsActive.add(key);
      try {
        const meta = await readMeta(file);
        const init = await api("/api/upload", { method: "POST", body: { title: file.name } });
        await new Promise((ok, fail) => {
          const up = new tus.Upload(file, {
            endpoint: "https://video.bunnycdn.com/tusupload",
            retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
            headers: {
              AuthorizationSignature: init.signature,
              AuthorizationExpire: String(init.expires),
              VideoId: init.guid,
              LibraryId: String(init.libraryId),
            },
            metadata: { filetype: file.type || "video/mp4", title: file.name },
            chunkSize: 50 * 1024 * 1024,
            onProgress: (sent, total) => ui.set((sent / total) * 100),
            onSuccess: ok,
            onError: fail,
          });
          up.start();
        });
        let id = slug(file.name.replace(/\.[^.]+$/, "")), n = 2;
        const taken = (x) => C.videos.some((v) => v.id === x) || C.reel.some((v) => v.id === x);
        while (taken(id)) id = `${slug(file.name.replace(/\.[^.]+$/, ""))}-${n++}`;
        // Entra como "processando": só aparece no site quando o Bunny terminar a conversão
        const item = { id, guid: init.guid, w: meta.w, h: meta.h, dur: meta.dur, poster: null, hidden: false, pending: true };
        if (target.reel) C.reel.push({ type: "video", ...item });
        else C.videos.push({ ...item, cat: target.cat, ia: false });
        renderPortfolio(); renderReel();
        ui.done("enviado ✓");
        await save(`Painel: novo vídeo ${file.name}`);
        pollPending();
      } catch (ex) {
        ui.fail("falhou");
        toast(`Não deu para enviar ${file.name}: ${ex.message || ex}`, true);
      } finally {
        uploadsActive.delete(key);
      }
    }
  }

  // Vídeos longos entram como link do YouTube (tocam no site pelo player do YouTube)
  async function addYoutube(cat) {
    const url = prompt("Cole o link do vídeo no YouTube:");
    if (!url || !url.trim()) return;
    try {
      toast("Buscando o vídeo no YouTube…");
      const y = await api(`/api/youtube?url=${encodeURIComponent(url.trim())}`);
      if (C.videos.some((v) => v.yt === y.id)) return toast("Esse vídeo já está no portfólio.", true);
      C.videos.push({ id: `yt-${y.id}`, yt: y.id, cat, ia: false, w: 16, h: 9, dur: y.dur, title: y.title, channel: y.channel, channelUrl: y.channelUrl, poster: null, hidden: false });
      renderPortfolio();
      await save(`Painel: novo vídeo do YouTube ${y.title}`);
      toast(y.dur ? "Vídeo do YouTube adicionado." : "Adicionado. Não achei a duração, dá para digitar no lápis do vídeo.");
    } catch (ex) { toast(ex.message, true); }
  }

  // Acompanha os vídeos que o Bunny ainda está convertendo
  let polling = false;
  async function pollPending() {
    if (polling) return;
    polling = true;
    try {
      while (true) {
        const pending = [...C.videos, ...C.reel].filter((v) => v.pending && v.guid);
        if (!pending.length) break;
        let changed = false;
        for (const it of pending) {
          try {
            const s = await api(`/api/video?guid=${it.guid}`);
            const badge = $(`[data-proc="${CSS.escape(it.id)}"]`);
            if (badge && s.status < 4) badge.textContent = `PROCESSANDO ${s.progress || 0}%`;
            if (s.status === 4) {
              it.pending = false;
              if (s.w && s.h) { it.w = s.w; it.h = s.h; }
              if (s.dur) it.dur = s.dur;
              changed = true;
            } else if (s.status >= 5) { it.pending = false; it.error = true; it.hidden = true; changed = true; }
          } catch (e) { /* tenta de novo na próxima volta */ }
        }
        if (changed) {
          renderPortfolio(); renderReel();
          await save("Painel: vídeo novo pronto no site");
        }
        await new Promise((r) => setTimeout(r, 8000));
      }
    } finally { polling = false; }
  }

  // Início ------------------------------------------------------------------
  api("/api/login").then((r) => (r.authed ? boot() : showLogin())).catch(() => showLogin());
})();
