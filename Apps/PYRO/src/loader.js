// FLS Universal Loader (local dev variant with programmatic control)
(function () {
  const mount = document.getElementById('fls-loader-mount') || document.body;

  const loader = document.createElement('div');
  loader.id = 'fls-loader';
  loader.innerHTML = `
    <style>
      #fls-loader{position:fixed;inset:0;display:grid;place-items:center;background:#0b0f1a;z-index:99999;transition:opacity .4s}
      #fls-loader.fade-out{opacity:0;pointer-events:none}
      #fls-loader .badge{display:flex;gap:14px;align-items:center;color:#cfd8e3;font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
      #fls-loader .bolt{width:46px;height:46px;border-radius:12px;background:linear-gradient(145deg,#1a2332,#0e1522);
        display:grid;place-items:center;box-shadow:0 6px 24px rgba(0,0,0,.35), inset 0 0 16px rgba(255,220,100,.08);
        animation:fls-spin 1.2s linear infinite}
      #fls-loader svg{width:26px;height:26px;fill:#ffd24d;filter:drop-shadow(0 0 6px rgba(255,210,77,.45))}
      #fls-loader .title{margin:0;font-size:14px;letter-spacing:.16em}
      #fls-loader .bar{height:3px;width:220px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden;margin-top:8px}
      #fls-loader .bar i{display:block;height:100%;width:44%;background:linear-gradient(90deg,#ffd24d,#ff9a3c);
        animation:fls-sweep 1.4s ease-in-out infinite;border-radius:99px;filter:drop-shadow(0 0 6px rgba(255,154,60,.45))}
      #fls-loader .sub{font-size:12px;opacity:.8;margin-top:6px}
      @keyframes fls-spin { to { transform:rotate(360deg) } }
      @keyframes fls-sweep { 0%{transform:translateX(-60%)} 50%{transform:translateX(120%)} 100%{transform:translateX(-60%)} }
    </style>
    <div class="badge">
      <div class="bolt" aria-hidden="true">
        <svg viewBox="0 0 24 24" role="img" aria-label="Lightning">
          <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"></path>
        </svg>
      </div>
      <div>
        <h1 class="title">FLASH LIGHTNING STUDIOS</h1>
        <div class="bar"><i></i></div>
        <div class="sub">Arcade initializing…</div>
      </div>
    </div>`;
  mount.appendChild(loader);

  function hide() {
    const bolt = loader.querySelector('.bolt');
    if (bolt) bolt.style.animationDuration = '0.25s';
    setTimeout(() => loader.classList.add('fade-out'), 200);
    setTimeout(() => loader.remove(), 1000);
  }

  // auto-hide fallback
  window.addEventListener('load', () => setTimeout(hide, 3500));

  // programmatic control
  window.FLSLoader = { hide, el: loader };
})();
