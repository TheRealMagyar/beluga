export const walrusStyles = `
  .walrus-app {
    --abyss: #161616;
    --depth: #0c0e1a;
    --surface: #11142200;
    --surface-1: #131628;
    --surface-2: #1a1e36;
    --line: #262b48;
    --line-soft: #1d2140;
    --text: #eef0ff;
    --text-dim: #9a9fc4;
    --text-faint: #5e6390;
    --kelp: #00e0a8;
    --tide: #5b6dff;
    --pearl: #ffd66b;
    --coral: #ff5d7a;
    --font-display: 'Fraunces', 'Iowan Old Style', Georgia, serif;
    --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    --font-mono: 'JetBrains Mono', 'IBM Plex Mono', 'SF Mono', monospace;
  }
  .walrus-app * { box-sizing: border-box; }
  .walrus-app {
    min-height: 100vh;
    background:
      radial-gradient(ellipse 1200px 600px at 50% -10%, #1a1f4a33, transparent 60%),
      radial-gradient(ellipse 900px 500px at 90% 10%, #00e0a812, transparent 55%),
      var(--abyss);
    color: var(--text);
    font-family: var(--font-body);
  }
  .wm-fade-in { animation: wmFadeIn .4s ease both; }
  @keyframes wmFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @media (prefers-reduced-motion: reduce) {
    .walrus-app * { animation: none !important; transition: none !important; }
  }
  .wm-scroll::-webkit-scrollbar { width: 6px; }
  .wm-scroll::-webkit-scrollbar-thumb { background: var(--line); border-radius: 4px; }

  .wm-fragment {
    position: relative;
    background: linear-gradient(165deg, var(--surface-1), var(--depth));
    border: 1px solid var(--line);
    border-radius: 18px;
    padding: 22px 22px 18px;
    cursor: pointer;
    transition: border-color .18s ease, transform .18s ease, box-shadow .18s ease;
    overflow: hidden;
  }
  .wm-fragment::before {
    content: "";
    position: absolute; inset: 0;
    background: radial-gradient(160px 160px at 85% -10%, var(--frag-glow, #5b6dff22), transparent 70%);
    pointer-events: none;
  }
  .wm-fragment:hover {
    border-color: var(--frag-color, var(--tide));
    transform: translateY(-3px);
    box-shadow: 0 14px 32px -16px var(--frag-glow, #5b6dff44);
  }
  .wm-fragment:focus-visible {
    outline: 2px solid var(--kelp);
    outline-offset: 2px;
  }
  .wm-knob {
    position: absolute;
    left: -9px; top: 50%;
    transform: translateY(-50%);
    width: 18px; height: 26px;
    background: var(--depth);
    border: 1px solid var(--line);
    border-radius: 9px;
  }
  .wm-fragment:hover .wm-knob { border-color: var(--frag-color, var(--tide)); }

  .wm-btn {
    font-family: var(--font-body);
    border: 1px solid var(--line);
    background: var(--surface-2);
    color: var(--text);
    border-radius: 10px;
    padding: 9px 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color .15s, background .15s, transform .1s;
  }
  .wm-btn:hover { border-color: var(--tide); }
  .wm-btn:active { transform: scale(.98); }
  .wm-btn-primary {
    background: linear-gradient(135deg, var(--tide), #4453d6);
    border-color: transparent;
    color: #fff;
  }
  .wm-btn-primary:hover { filter: brightness(1.08); }
  .wm-btn-ghost { background: transparent; }
  .wm-btn-icon {
    width: 30px; height: 30px;
    display: inline-flex; align-items: center; justify-content: center;
    padding: 0; border-radius: 8px;
  }
  .wm-input {
    width: 100%;
    background: var(--surface-2);
    border: 1px solid var(--line);
    color: var(--text);
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 14px;
    font-family: var(--font-body);
    outline: none;
  }
  .wm-input:focus { border-color: var(--tide); }
  .wm-input-mono { font-family: var(--font-mono); font-size: 12.5px; }

  .wm-modal-backdrop {
    position: fixed; inset: 0;
    background: #03040ad9;
    backdrop-filter: blur(3px);
    display: flex; align-items: center; justify-content: center;
    z-index: 200; padding: 20px;
  }
  .wm-modal {
    background: linear-gradient(165deg, var(--surface-1), var(--depth));
    border: 1px solid var(--line);
    border-radius: 20px;
    padding: 28px;
    width: 100%; max-width: 440px;
    max-height: 90vh; overflow-y: auto;
  }

  .wm-tab-strip {
    display: flex; gap: 4px;
    background: var(--surface-1);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 5px;
  }
  .wm-tab {
    flex: 1; padding: 10px 0;
    border-radius: 8px; border: none;
    background: transparent; color: var(--text-dim);
    font-weight: 600; font-size: 14px; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 6px;
    transition: background .15s, color .15s;
  }
  .wm-tab[data-active="true"] {
    background: linear-gradient(135deg, var(--tide), #4453d6);
    color: #fff;
  }

  .wm-pill {
    font-size: 11px; font-weight: 700;
    padding: 3px 9px; border-radius: 20px;
    letter-spacing: .2px;
  }
`;
