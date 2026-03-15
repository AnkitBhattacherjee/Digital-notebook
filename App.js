import { useState, useEffect, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════ */
const FONTS = [
  { label: "Dancing Script", value: "'Dancing Script', cursive" },
  { label: "Caveat",         value: "'Caveat', cursive" },
  { label: "Kalam",          value: "'Kalam', cursive" },
  { label: "Sacramento",     value: "'Sacramento', cursive" },
  { label: "Pacifico",       value: "'Pacifico', cursive" },
  { label: "Homemade Apple", value: "'Homemade Apple', cursive" },
  { label: "Reenie Beanie",  value: "'Reenie Beanie', cursive" },
  { label: "Patrick Hand",   value: "'Patrick Hand', cursive" },
];

const PRESET_COLORS = [
  "#1a1208","#c2501f","#6b4c2a","#1e3a6e",
  "#1a4d2e","#4a1a4a","#8b1a1a","#c9993a",
];

const HIGHLIGHT_COLORS = [
  { hex:"#ffe066", label:"Yellow" },
  { hex:"#a8e6a3", label:"Green"  },
  { hex:"#a3c4f5", label:"Blue"   },
  { hex:"#f5a3c4", label:"Pink"   },
  { hex:"#f5c9a3", label:"Peach"  },
];

const TOOL_SIZES = {
  pencil:    [1.5, 2.8, 5],
  highlight: [12, 18, 26],
  eraser:    [14, 22, 36],
};

let _uid = 0;
const uid = () => ++_uid;

const addDays = (d, n) => { const nd = new Date(d); nd.setDate(nd.getDate() + n); return nd; };
const MAX_SPREAD = 49;

/* ═══════════════════════════════════════════════════
   COLOR UTILITIES
═══════════════════════════════════════════════════ */
function hexToHsv(hex = "#1a1208") {
  let r = 0, g = 0, b = 0;
  const h = hex.replace("#","");
  if (h.length === 6) {
    r = parseInt(h.slice(0,2),16)/255;
    g = parseInt(h.slice(2,4),16)/255;
    b = parseInt(h.slice(4,6),16)/255;
  }
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  const hh = max === min ? 0 :
    max === r ? 60 * ((g-b)/d + (g<b?6:0)) :
    max === g ? 60 * ((b-r)/d + 2) :
               60 * ((r-g)/d + 4);
  return { h: ((hh%360)+360)%360, s: max===0?0:d/max, v: max };
}

function hsvToHex({ h, s, v }) {
  const f = (n, k=(n+h/60)%6) => v - v*s*Math.max(Math.min(k,4-k,1),0);
  return "#" + [f(5),f(3),f(1)].map(x => Math.round(x*255).toString(16).padStart(2,"0")).join("");
}

/* ═══════════════════════════════════════════════════
   CANVAS WHEEL RENDERER
═══════════════════════════════════════════════════ */
function drawColorWheel(canvas, hsv) {
  if (!canvas) return;
  const SIZE = canvas.width; const cx = SIZE/2, cy = SIZE/2;
  const OR = SIZE*0.46, IR = SIZE*0.34;
  const SQ = Math.floor(IR/Math.SQRT2)*2 - 4;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0,0,SIZE,SIZE);

  // Hue ring
  for (let i=0; i<360; i++) {
    const a1 = ((i-0.7)/360)*Math.PI*2 - Math.PI/2;
    const a2 = ((i+0.7)/360)*Math.PI*2 - Math.PI/2;
    ctx.beginPath(); ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,OR,a1,a2); ctx.closePath();
    ctx.fillStyle = `hsl(${i},100%,50%)`; ctx.fill();
  }
  // Punch hole
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath(); ctx.arc(cx,cy,IR,0,Math.PI*2); ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // SV square
  const sx = cx - SQ/2, sy = cy - SQ/2;
  const gS = ctx.createLinearGradient(sx,0,sx+SQ,0);
  gS.addColorStop(0,"#fff"); gS.addColorStop(1,`hsl(${hsv.h},100%,50%)`);
  ctx.fillStyle = gS; ctx.fillRect(sx,sy,SQ,SQ);
  const gV = ctx.createLinearGradient(0,sy,0,sy+SQ);
  gV.addColorStop(0,"rgba(0,0,0,0)"); gV.addColorStop(1,"#000");
  ctx.fillStyle = gV; ctx.fillRect(sx,sy,SQ,SQ);

  // Hue indicator
  const ha = (hsv.h/360)*Math.PI*2 - Math.PI/2;
  const hr = (OR+IR)/2;
  const hx = cx+Math.cos(ha)*hr, hy = cy+Math.sin(ha)*hr;
  ctx.beginPath(); ctx.arc(hx,hy,6,0,Math.PI*2);
  ctx.strokeStyle="#fff"; ctx.lineWidth=2.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(hx,hy,6,0,Math.PI*2);
  ctx.strokeStyle="rgba(0,0,0,.35)"; ctx.lineWidth=1; ctx.stroke();

  // SV indicator
  const svx = sx + hsv.s*SQ, svy = sy + (1-hsv.v)*SQ;
  ctx.beginPath(); ctx.arc(svx,svy,5,0,Math.PI*2);
  ctx.strokeStyle="#fff"; ctx.lineWidth=2.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(svx,svy,5,0,Math.PI*2);
  ctx.strokeStyle="rgba(0,0,0,.45)"; ctx.lineWidth=1; ctx.stroke();
}

/* ═══════════════════════════════════════════════════
   COLOR WHEEL PICKER COMPONENT
═══════════════════════════════════════════════════ */
function ColorWheelPicker({ color, onChange, onClose }) {
  const canvasRef = useRef(null);
  const [hsv, setHsv]   = useState(() => hexToHsv(color));
  const [drag, setDrag] = useState(null);
  const SIZE = 180;
  const OR = SIZE*0.46, IR = SIZE*0.34, SQ = Math.floor(IR/Math.SQRT2)*2 - 4;
  const cx = SIZE/2, cy = SIZE/2;

  useEffect(() => { drawColorWheel(canvasRef.current, hsv); }, [hsv]);
  useEffect(() => { setHsv(hexToHsv(color)); }, [color]);

  const getHitArea = (x, y) => {
    const dx = x-cx, dy = y-cy;
    const dist = Math.sqrt(dx*dx+dy*dy);
    if (dist >= IR && dist <= OR) return "ring";
    if (Math.abs(dx) <= SQ/2 && Math.abs(dy) <= SQ/2) return "square";
    return null;
  };

  const applyRing = useCallback((x,y) => {
    const dx=x-cx, dy=y-cy;
    const angle = Math.atan2(dy,dx)*180/Math.PI + 90;
    const h = ((angle%360)+360)%360;
    setHsv(prev => { const n={...prev,h}; onChange(hsvToHex(n)); return n; });
  },[cx,cy,onChange]);

  const applySquare = useCallback((x,y) => {
    const sx=cx-SQ/2, sy=cy-SQ/2;
    const s = Math.max(0,Math.min(1,(x-sx)/SQ));
    const v = Math.max(0,Math.min(1,1-(y-sy)/SQ));
    setHsv(prev => { const n={...prev,s,v}; onChange(hsvToHex(n)); return n; });
  },[cx,cy,SQ,onChange]);

  const onPD = (e) => {
    e.preventDefault();
    const r = canvasRef.current.getBoundingClientRect();
    const x = e.clientX-r.left, y = e.clientY-r.top;
    const area = getHitArea(x,y);
    if (!area) return;
    setDrag(area);
    if (area==="ring") applyRing(x,y);
    else applySquare(x,y);
  };
  const onPM = (e) => {
    if (!drag) return;
    e.preventDefault();
    const r = canvasRef.current.getBoundingClientRect();
    const x = e.clientX-r.left, y = e.clientY-r.top;
    if (drag==="ring") applyRing(x,y);
    else applySquare(x,y);
  };
  const onPU = () => setDrag(null);

  const currentHex = hsvToHex(hsv);

  return (
    <div className="cpicker-pop" onMouseDown={e=>e.stopPropagation()}>
      <canvas ref={canvasRef} width={SIZE} height={SIZE} className="cpicker-wheel"
        onMouseDown={onPD} onMouseMove={onPM} onMouseUp={onPU} onMouseLeave={onPU} />
      <div className="cpicker-bottom">
        <div className="cpicker-swatch" style={{background:currentHex}}/>
        <input className="cpicker-hex" value={currentHex}
          onChange={e => { if(/^#[0-9a-fA-F]{6}$/.test(e.target.value)){ onChange(e.target.value); setHsv(hexToHsv(e.target.value)); } }} />
      </div>
      <div className="cpicker-presets">
        {PRESET_COLORS.map(c => (
          <div key={c} className="cpicker-pre" style={{background:c}}
            onClick={() => { onChange(c); setHsv(hexToHsv(c)); }}/>
        ))}
      </div>
      <button className="cpicker-close" onClick={onClose}>✕ Done</button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   STROKE RENDERER
═══════════════════════════════════════════════════ */
function renderStrokes(canvas, strokes, activeStroke, selRect, selIds) {
  if (!canvas || canvas.width === 0) return;
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = canvas.width/dpr, H = canvas.height/dpr;
  ctx.clearRect(0, 0, W, H);

  const draw = (stroke, selected) => {
    const { tool, color, size, opacity, points } = stroke;
    if (!points || points.length === 0) return;
    ctx.globalAlpha = opacity;
    ctx.lineWidth  = size;
    ctx.lineCap    = "round";
    ctx.lineJoin   = "round";

    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.fillStyle   = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.fillStyle   = color;
    }

    if (selected) { ctx.shadowColor = "#4a90e2"; ctx.shadowBlur = 6; }

    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, size/2, 0, Math.PI*2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length-1; i++) {
        const mx = (points[i].x + points[i+1].x)/2;
        const my = (points[i].y + points[i+1].y)/2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
      }
      const L = points[points.length-1];
      ctx.lineTo(L.x, L.y);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  };

  strokes.forEach(s => draw(s, selIds?.has(s.id)));
  if (activeStroke) draw(activeStroke, false);

  // Selection rubber-band
  if (selRect) {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "#4a90e2";
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([5,4]);
    ctx.strokeRect(selRect.x, selRect.y, selRect.w, selRect.h);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(74,144,226,.07)";
    ctx.fillRect(selRect.x, selRect.y, selRect.w, selRect.h);
  }
}

function strokeInRect(stroke, r) {
  if (!r || Math.abs(r.w) < 2 || Math.abs(r.h) < 2) return false;
  const rx = Math.min(r.x, r.x+r.w), ry = Math.min(r.y, r.y+r.h);
  const rw = Math.abs(r.w),          rh = Math.abs(r.h);
  return stroke.points.some(p => p.x>=rx && p.x<=rx+rw && p.y>=ry && p.y<=ry+rh);
}

/* ═══════════════════════════════════════════════════
   NOTEBOOK PAGE
═══════════════════════════════════════════════════ */
function NotebookPage({ pageNum, isLeft, tool, pencilSize, pencilColor, pencilOpacity,
                        hlColor, eraserSize, pagesRef, font }) {
  const containerRef  = useRef(null);
  const canvasRef     = useRef(null);
  const textareaRef   = useRef(null);
  const strokesRef    = useRef([]);
  const activeRef     = useRef(null);
  const isDrawRef     = useRef(false);
  const selStartRef   = useRef(null);
  const selRectRef    = useRef(null);
  const [selIds, setSelIds] = useState(new Set());

  /* ── Initialize canvas dimensions via ResizeObserver ── */
  useEffect(() => {
    const container = containerRef.current;
    const canvas    = canvasRef.current;
    if (!container || !canvas) return;

    const init = () => {
      const dpr  = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      canvas.width        = Math.round(rect.width  * dpr);
      canvas.height       = Math.round(rect.height * dpr);
      canvas.style.width  = rect.width  + "px";
      canvas.style.height = rect.height + "px";
      renderStrokes(canvas, strokesRef.current, activeRef.current, selRectRef.current, selIds);
    };

    const ro = new ResizeObserver(init);
    ro.observe(container);
    init();
    return () => ro.disconnect();
  }, []); // eslint-disable-line

  /* ── Load page data when pageNum changes ── */
  useEffect(() => {
    const data = pagesRef.current.get(pageNum);
    strokesRef.current = data?.strokes ? [...data.strokes] : [];
    selRectRef.current = null;
    activeRef.current  = null;
    setSelIds(new Set());
    renderStrokes(canvasRef.current, strokesRef.current, null, null, new Set());
    if (textareaRef.current) textareaRef.current.value = data?.text || "";
  }, [pageNum, pagesRef]);

  /* ── Re-render when selIds changes ── */
  useEffect(() => {
    renderStrokes(canvasRef.current, strokesRef.current, activeRef.current, selRectRef.current, selIds);
  }, [selIds]);

  const saveStrokes = useCallback(() => {
    const ex = pagesRef.current.get(pageNum) || {};
    pagesRef.current.set(pageNum, { ...ex, strokes: [...strokesRef.current] });
  }, [pageNum, pagesRef]);

  const saveText = useCallback((text) => {
    const ex = pagesRef.current.get(pageNum) || {};
    pagesRef.current.set(pageNum, { ...ex, text });
  }, [pageNum, pagesRef]);

  /* ── Pointer position (CSS pixels) ── */
  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const src    = e.touches?.[0] || e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  /* ── Pointer down ── */
  const onPD = useCallback((e) => {
    if (tool === "text") return;
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    isDrawRef.current = true;
    const pos = getPos(e);

    if (tool === "select") {
      selStartRef.current = pos;
      selRectRef.current  = { x: pos.x, y: pos.y, w: 0, h: 0 };
      setSelIds(new Set());
      return;
    }

    const stroke = {
      id: uid(), tool,
      color:   tool === "highlight" ? hlColor   : pencilColor,
      size:    tool === "highlight" ? 18         : tool === "eraser" ? eraserSize : pencilSize,
      opacity: tool === "highlight" ? 0.32       : tool === "eraser" ? 1 : pencilOpacity,
      points:  [pos],
    };
    activeRef.current = stroke;
    renderStrokes(canvasRef.current, strokesRef.current, stroke, null, new Set());
  }, [tool, pencilColor, pencilSize, pencilOpacity, hlColor, eraserSize]); // eslint-disable-line

  /* ── Pointer move ── */
  const onPM = useCallback((e) => {
    if (!isDrawRef.current) return;
    e.preventDefault();
    const pos = getPos(e);

    if (tool === "select") {
      const s = selStartRef.current;
      selRectRef.current = { x: s.x, y: s.y, w: pos.x - s.x, h: pos.y - s.y };
      renderStrokes(canvasRef.current, strokesRef.current, null, selRectRef.current, new Set());
      return;
    }

    if (!activeRef.current) return;
    activeRef.current.points.push(pos);
    renderStrokes(canvasRef.current, strokesRef.current, activeRef.current, null, new Set());
  }, [tool]); // eslint-disable-line

  /* ── Pointer up ── */
  const onPU = useCallback(() => {
    if (!isDrawRef.current) return;
    isDrawRef.current = false;

    if (tool === "select") {
      const rect = selRectRef.current;
      if (rect) {
        const ids = new Set(strokesRef.current.filter(s => strokeInRect(s, rect)).map(s => s.id));
        setSelIds(ids);
        renderStrokes(canvasRef.current, strokesRef.current, null, null, ids);
        selRectRef.current = null;
      }
      return;
    }

    if (activeRef.current) {
      strokesRef.current = [...strokesRef.current, activeRef.current];
      activeRef.current  = null;
      saveStrokes();
      renderStrokes(canvasRef.current, strokesRef.current, null, null, new Set());
    }
  }, [tool, saveStrokes]);

  /* ── Delete selected ── */
  const deleteSelected = useCallback(() => {
    if (selIds.size === 0) return;
    strokesRef.current = strokesRef.current.filter(s => !selIds.has(s.id));
    saveStrokes();
    setSelIds(new Set());
    renderStrokes(canvasRef.current, strokesRef.current, null, null, new Set());
  }, [selIds, saveStrokes]);

  /* ── Keyboard delete ── */
  useEffect(() => {
    const h = (e) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selIds.size > 0) {
        e.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [selIds, deleteSelected]);

  /* ── Canvas cursor ── */
  const cursorStyle = () => {
    if (tool === "text")   return "text";
    if (tool === "select") return "crosshair";
    if (tool === "eraser") return "cell";
    return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24'%3E%3Cpath d='M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z' fill='%231a1208'/%3E%3C/svg%3E") 2 18, crosshair`;
  };

  const spread = Math.floor((pageNum-1)/2);
  const spreadLabel = `${spread*2+1} — ${spread*2+2}`;
  const isActive = tool !== "text";

  return (
    <div ref={containerRef} className={`pg ${isLeft ? "pg-l" : "pg-r"}`}>
      <div className="ppr-tex"/>
      <div className="pg-lines">{[...Array(20)].map((_,i) => <div className="ln" key={i}/>)}</div>

      {/* First-line header */}
      <div className={`pg-hdr ${isLeft ? "pg-hdr-l" : "pg-hdr-r"}`}>
        {isLeft
          ? <><span style={{fontStyle:"italic",fontFamily:"'IM Fell English',serif",opacity:.38}}>pg. {pageNum}</span><span style={{opacity:.25}}>{spreadLabel}</span></>
          : <><span style={{opacity:.25}}>{spreadLabel}</span><span style={{fontStyle:"italic",fontFamily:"'IM Fell English',serif",opacity:.38}}>pg. {pageNum}</span></>
        }
      </div>

      {/* Textarea — starts on second line */}
      <div className={`wz ${isLeft ? "wz-l" : "wz-r"}`}>
        <textarea ref={textareaRef} className={`ink ${isActive ? "ink-nodraw" : ""}`}
          placeholder={isLeft ? "Write your thoughts here…" : "Continue on this page…"}
          style={{ fontFamily: font }}
          onChange={e => saveText(e.target.value)} />
      </div>

      {/* Drawing canvas */}
      <canvas ref={canvasRef} className="draw-canvas"
        style={{ pointerEvents: isActive ? "all" : "none", cursor: cursorStyle() }}
        onPointerDown={onPD} onPointerMove={onPM} onPointerUp={onPU} onPointerLeave={onPU}/>

      {/* Delete selected button */}
      {selIds.size > 0 && (
        <button className="sel-delete-btn" onClick={deleteSelected}>
          🗑 Delete {selIds.size} stroke{selIds.size>1?"s":""}
        </button>
      )}

      {isLeft && <div className="brand-wm">Write in the Rain</div>}
      {!isLeft && <div className="pg-curl"/>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PAGE NAV BUTTON
═══════════════════════════════════════════════════ */
function PageNavBtn({ dir, spread, onClick }) {
  const isPrev  = dir === "prev";
  const disabled = isPrev ? spread === 0 : spread >= MAX_SPREAD;
  const adjPages = isPrev
    ? `${(spread-1)*2+1}–${(spread-1)*2+2}`
    : `${(spread+1)*2+1}–${(spread+1)*2+2}`;

  return (
    <button className={`pt-nav ${disabled ? "pt-nav-off" : ""}`}
      onClick={disabled ? undefined : onClick}>
      <span className="pt-arrow">{isPrev ? "‹" : "›"}</span>
      <span className="pt-label">{isPrev ? "prev" : "next"}</span>
      {!disabled && <span className="pt-pages">{adjPages}</span>}
    </button>
  );
}

/* ═══════════════════════════════════════════════════
   GLOBAL CSS
═══════════════════════════════════════════════════ */
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=IM+Fell+English:ital@0;1&family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Dancing+Script:wght@400;600;700&family=Caveat:wght@400;600;700&family=Sacramento&family=Pacifico&family=Homemade+Apple&family=Kalam:wght@300;400;700&family=Patrick+Hand&family=Reenie+Beanie&display=swap');
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{
  --cream:#f5f0e8;--parchment:#ede4d0;--ink:#1a1208;
  --brown:#6b4c2a;--rust:#c2501f;--gold:#c9993a;
  --gold-lo:rgba(201,153,58,.18);--rule:rgba(107,76,42,.15);
  --paper:#faf8f0;--line-c:#b8dde8;--margin-c:#f0a9a9;
}
html,body,#root{height:100%;overflow:hidden}
body{font-family:'IM Fell English',Georgia,serif;background:var(--ink);color:var(--cream)}

/* VIEWS */
.view{position:fixed;inset:0;will-change:opacity,transform;transition:opacity .6s ease,transform .6s ease}
.v-landing{overflow-y:auto;z-index:10;background:var(--cream);color:var(--ink)}
.v-app{overflow:hidden;z-index:5;
  background:radial-gradient(ellipse at 20% 0%,#2a1800,#1a1208 50%,#0d0905);
  display:flex;flex-direction:column;align-items:center;justify-content:flex-start;
  font-family:'Patrick Hand',cursive}
.v-app::before{content:'';position:fixed;inset:0;pointer-events:none;
  background:repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(201,153,58,.035) 39px,rgba(201,153,58,.035) 40px)}
.view-hidden{opacity:0;transform:translateY(52px) scale(.97);pointer-events:none}
.view-exit  {opacity:0;transform:translateY(-52px) scale(.97);pointer-events:none}
.view-active{opacity:1;transform:none;pointer-events:all}
.pg-flash{position:fixed;inset:0;background:var(--gold);opacity:0;pointer-events:none;z-index:9999;transition:opacity .18s}
.pg-flash.on{opacity:.3}
.noise{position:fixed;inset:0;pointer-events:none;z-index:999;opacity:.32;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='.05'/%3E%3C/svg%3E")}

/* ─── LANDING ─── */
.v-landing{font-family:'IM Fell English',Georgia,serif}
.hero{min-height:100vh;display:grid;grid-template-columns:1fr 1fr;overflow:hidden}
.hero-l{background:var(--ink);padding:80px 60px;display:flex;flex-direction:column;justify-content:center;position:relative;overflow:hidden}
.hero-l::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(201,153,58,.09) 27px,rgba(201,153,58,.09) 28px)}
.hero-l::after{content:'';position:absolute;left:60px;top:0;bottom:0;width:1px;background:rgba(201,153,58,.28)}
.vol-tag{font-family:'Courier Prime',monospace;font-size:11px;letter-spacing:.3em;color:var(--gold);text-transform:uppercase;margin-bottom:46px;padding-left:72px;animation:fadeUp .8s ease both}
.hero-title{font-family:'Playfair Display',serif;font-size:clamp(58px,8vw,106px);font-weight:900;line-height:.9;color:var(--cream);padding-left:72px;animation:fadeUp .8s .14s ease both}
.hero-title em{font-style:italic;color:var(--gold);display:block}
.hero-sub{font-family:'IM Fell English',serif;font-style:italic;font-size:17px;color:rgba(245,240,232,.58);margin-top:26px;padding-left:72px;line-height:1.72;max-width:350px;animation:fadeUp .8s .28s ease both}
.hero-ghost{position:absolute;bottom:48px;left:55px;font-family:'Playfair Display',serif;font-size:128px;font-weight:900;color:rgba(201,153,58,.045);user-select:none}
.hero-r{background:var(--parchment);display:flex;align-items:center;justify-content:center;padding:60px;position:relative;animation:fadeIn 1s .4s ease both;opacity:0}
.hero-r::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 35px,rgba(107,76,42,.07) 35px,rgba(107,76,42,.07) 36px)}
.nb-vis{width:256px;height:336px;position:relative;filter:drop-shadow(20px 20px 40px rgba(26,18,8,.3));transform:rotate(-3deg);transition:transform .6s;cursor:default}
.nb-vis:hover{transform:rotate(0) scale(1.05)}
.nb-cov{width:100%;height:100%;background:var(--rust);border-radius:4px 8px 8px 4px;position:relative;overflow:hidden}
.nb-cov::before{content:'';position:absolute;left:0;top:0;bottom:0;width:18px;background:rgba(0,0,0,.24)}
.nb-cov::after{content:'';position:absolute;left:22px;top:28px;right:22px;bottom:28px;border:1.5px solid rgba(255,255,255,.14);border-radius:2px}
.nb-cov-txt{position:absolute;left:50px;right:22px;top:50%;transform:translateY(-50%);text-align:center;color:rgba(255,255,255,.9);font-family:'Playfair Display',serif;font-style:italic;font-size:21px;line-height:1.42}
.nb-rngs{position:absolute;left:-9px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:space-evenly;padding:20px 0}
.nb-rng{width:17px;height:17px;border:3px solid var(--gold);border-radius:50%;background:var(--parchment)}
.cta{margin-top:42px;margin-left:72px;display:inline-flex;align-items:center;gap:14px;background:var(--gold);color:var(--ink);font-family:'Playfair Display',serif;font-size:16.5px;font-weight:700;padding:15px 28px;border:none;cursor:pointer;border-radius:2px;position:relative;z-index:2;overflow:hidden;transition:transform .28s,box-shadow .28s;animation:fadeUp .8s .44s ease both}
.cta::after{content:'';position:absolute;inset:0;background:transparent;transition:background .24s}
.cta:hover{transform:translateY(-3px);box-shadow:0 14px 36px rgba(201,153,58,.48)}
.cta:hover::after{background:rgba(255,255,255,.11)}
.cta:active{transform:translateY(0)}
.cta-icon{font-size:21px;transition:transform .28s}
.cta:hover .cta-icon{transform:rotate(-9deg) scale(1.2)}
.cta-lbl{display:flex;flex-direction:column;align-items:flex-start;line-height:1.1}
.cta-sub{font-family:'Courier Prime',monospace;font-size:10px;font-weight:400;letter-spacing:.22em;text-transform:uppercase;opacity:.52;margin-top:3px}
.quote-band{background:var(--gold);padding:28px 76px;text-align:center}
.quote-band blockquote{font-family:'Playfair Display',serif;font-style:italic;font-size:clamp(17px,2.4vw,24px);color:var(--ink);max-width:780px;margin:0 auto;line-height:1.55}
.quote-band cite{display:block;font-family:'Courier Prime',monospace;font-style:normal;font-size:11px;letter-spacing:.22em;text-transform:uppercase;margin-top:9px;color:rgba(26,18,8,.52)}
.sec-lbl{font-family:'Courier Prime',monospace;font-size:11px;letter-spacing:.35em;text-transform:uppercase;color:var(--rust);margin-bottom:13px}
.sec-ttl{font-family:'Playfair Display',serif;font-size:clamp(32px,5vw,54px);font-weight:700;line-height:1.1;margin-bottom:26px}
.sec-ttl em{font-style:italic;color:var(--brown)}
.types-sec{background:var(--parchment);padding:90px 76px}
.types-inn{max-width:1180px;margin:0 auto}
.types-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin-top:52px}
.t-card{background:var(--cream);padding:42px 30px;transition:transform .34s,background .26s;cursor:default}
.t-card:hover{transform:translateY(-5px);background:var(--ink);color:var(--cream)}
.t-card:hover .t-desc{color:rgba(245,240,232,.7)}
.t-card:hover .t-bar{background:var(--gold)}
.t-num{font-family:'Playfair Display',serif;font-size:50px;font-weight:900;color:var(--rule);line-height:1;margin-bottom:18px}
.t-bar{width:36px;height:3px;background:var(--rust);margin-bottom:16px;transition:background .26s}
.t-name{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;margin-bottom:9px}
.t-desc{font-family:'IM Fell English',serif;font-style:italic;font-size:14px;line-height:1.82;color:rgba(26,18,8,.66);transition:color .26s}
.hist-sec{padding:90px 76px;background:var(--cream);color:var(--ink)}
.hist-inn{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:76px;align-items:start}
.hist-txt p{font-size:16px;line-height:1.94;margin-bottom:20px;color:rgba(26,18,8,.83)}
.hist-txt p:first-of-type::first-letter{font-family:'Playfair Display',serif;font-size:68px;font-weight:900;float:left;line-height:.75;margin-right:10px;margin-top:6px;color:var(--rust)}
.tl-item{display:grid;grid-template-columns:68px 1fr;gap:20px;margin-bottom:34px;position:relative}
.tl-item:not(:last-child)::after{content:'';position:absolute;left:33px;top:32px;bottom:-10px;width:1px;background:var(--rule)}
.tl-yr{font-family:'Courier Prime',monospace;font-size:12px;font-weight:700;color:var(--rust);padding-top:2px;text-align:right}
.tl-dot{position:absolute;left:27px;top:5px;width:12px;height:12px;border-radius:50%;background:var(--gold);border:3px solid var(--cream);box-shadow:0 0 0 1px var(--gold)}
.tl-ttl{font-family:'Playfair Display',serif;font-size:15px;font-weight:700;margin-bottom:4px}
.tl-dsc{font-size:13px;line-height:1.68;color:rgba(26,18,8,.6)}
.ruled-sec{padding:72px;position:relative;overflow:hidden;background:var(--cream);color:var(--ink)}
.ruled-sec::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 39px,var(--rule) 39px,var(--rule) 40px)}
.ruled-sec::after{content:'';position:absolute;left:115px;top:0;bottom:0;width:1px;background:rgba(194,80,31,.18)}
.ruled-inn{max-width:800px;margin:0 auto;position:relative;padding-left:56px}
.ruled-inn h2{font-family:'Playfair Display',serif;font-size:clamp(25px,4vw,40px);font-weight:700;margin-bottom:20px;line-height:1.22}
.ruled-inn p{font-size:15px;line-height:2.5;color:rgba(26,18,8,.79)}
.care-sec{background:var(--ink);padding:90px 76px;color:var(--cream)}
.care-inn{max-width:1180px;margin:0 auto}
.care-inn .sec-lbl{color:var(--gold)}
.care-inn .sec-ttl{color:var(--cream)}
.care-inn .sec-ttl em{color:rgba(201,153,58,.82)}
.care-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:40px;margin-top:48px}
.care-it{border-top:1px solid rgba(245,240,232,.12);padding-top:22px}
.care-ico{font-size:25px;margin-bottom:12px;display:block}
.care-it h3{font-family:'Playfair Display',serif;font-size:18px;font-weight:700;margin-bottom:9px;color:var(--gold)}
.care-it p{font-family:'IM Fell English',serif;font-style:italic;font-size:14px;line-height:1.85;color:rgba(245,240,232,.65)}
.foot-cta{background:var(--ink);padding:66px 76px;text-align:center;border-top:1px solid rgba(201,153,58,.1)}
.foot-cta p{font-family:'Playfair Display',serif;font-style:italic;font-size:clamp(19px,3vw,32px);color:var(--cream);margin-bottom:32px;line-height:1.45}
.foot-cta p em{color:var(--gold)}
.foot-cta .cta{margin:0 auto}
footer{background:#46301c;color:var(--cream);padding:48px 76px;display:flex;justify-content:space-between;align-items:center}
.ft-brand{font-family:'Playfair Display',serif;font-size:24px;font-style:italic;font-weight:700;color:var(--gold)}
.ft-copy{font-family:'Courier Prime',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:rgba(245,240,232,.42)}
.ft-tag{font-family:'IM Fell English',serif;font-style:italic;font-size:14px;color:rgba(245,240,232,.62)}
.reveal{opacity:0;transform:translateY(34px);transition:opacity .72s ease,transform .72s ease}
.reveal.visible{opacity:1;transform:none}

/* ─── APP BAR ─── */
.app-bar{
  position:relative;width:100%;height:54px;flex-shrink:0;z-index:200;
  background:rgba(10,7,0,.96);backdrop-filter:blur(18px);
  border-bottom:1px solid rgba(201,153,58,.2);
  display:flex;align-items:center;gap:8px;padding:0 16px;
  overflow:visible;
}
.app-logo{font-family:'Playfair Display',serif;font-style:italic;font-size:20px;color:var(--gold);margin-right:6px;letter-spacing:.02em;white-space:nowrap}
.back-btn{background:none;border:1px solid rgba(201,153,58,.25);border-radius:2px;color:rgba(201,153,58,.65);font-family:'Courier Prime',monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;padding:6px 13px;cursor:pointer;transition:all .2s;white-space:nowrap}
.back-btn:hover{border-color:var(--gold);color:var(--gold);background:rgba(201,153,58,.07)}
.bar-div{width:1px;height:28px;background:rgba(201,153,58,.18);flex-shrink:0}

/* TOOL BUTTONS */
.tool-grp{display:flex;gap:1px;border:1px solid rgba(201,153,58,.2);border-radius:2px;overflow:hidden;flex-shrink:0}
.tb{width:34px;height:32px;background:transparent;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;color:rgba(201,153,58,.5);transition:all .18s;flex-shrink:0;position:relative}
.tb:hover{background:rgba(201,153,58,.1);color:var(--gold)}
.tb.on{background:rgba(201,153,58,.2);color:var(--gold)}
.tb svg{width:14px;height:14px;fill:currentColor}
.tb-label{font-size:9px;letter-spacing:.1em;font-family:'Courier Prime',monospace;text-transform:uppercase}

/* SIZE DOTS */
.sz-row{display:flex;align-items:center;gap:5px;padding:0 4px}
.sz-d{border-radius:50%;background:rgba(201,153,58,.4);cursor:pointer;transition:all .18s;flex-shrink:0}
.sz-d:hover{background:var(--gold)}
.sz-d.on{background:var(--gold);box-shadow:0 0 0 2px rgba(201,153,58,.3)}

/* COLOR SWATCH BUTTON */
.color-btn{width:22px;height:22px;border-radius:50%;cursor:pointer;border:2px solid rgba(255,255,255,.18);transition:all .2s;flex-shrink:0;position:relative}
.color-btn:hover{transform:scale(1.12);border-color:rgba(255,255,255,.4)}
.color-btn.ring{box-shadow:0 0 0 2px var(--gold)}

/* HIGHLIGHT COLOR ROW */
.hl-colors{display:flex;gap:4px;align-items:center;padding:0 2px}
.hl-c{width:18px;height:18px;border-radius:3px;cursor:pointer;transition:all .18s;flex-shrink:0;border:2px solid transparent}
.hl-c:hover{transform:scale(1.15)}
.hl-c.on{border-color:rgba(255,255,255,.6);transform:scale(1.12)}

/* FONT SELECT */
.fnt-sel{background:rgba(255,255,255,.04);border:1px solid rgba(201,153,58,.2);border-radius:2px;color:rgba(245,240,232,.7);padding:5px 24px 5px 9px;font-family:'Courier Prime',monospace;font-size:10px;letter-spacing:.06em;cursor:pointer;outline:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M5 6L0 0h10z' fill='%23c9993a'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 7px center;flex-shrink:0}
.fnt-sel option{background:#1a1208;color:var(--cream)}

/* SPREAD INDICATOR */
.spread-ind{font-family:'Courier Prime',monospace;font-size:10px;letter-spacing:.18em;color:rgba(201,153,58,.5);text-transform:uppercase;white-space:nowrap}

/* COLOR PICKER POPUP */
.cpicker-wrap{position:relative}
.cpicker-pop{
  position:absolute;top:calc(100% + 8px);left:50%;transform:translateX(-50%);
  background:#1a1208;border:1px solid rgba(201,153,58,.3);border-radius:4px;
  padding:12px;z-index:500;box-shadow:0 16px 40px rgba(0,0,0,.7);
  display:flex;flex-direction:column;align-items:center;gap:10px;
  min-width:200px;
}
.cpicker-pop::before{content:'';position:absolute;top:-6px;left:50%;transform:translateX(-50%);width:10px;height:10px;background:#1a1208;border-left:1px solid rgba(201,153,58,.3);border-top:1px solid rgba(201,153,58,.3);rotate:45deg}
.cpicker-wheel{border-radius:50%;cursor:crosshair;display:block}
.cpicker-bottom{display:flex;align-items:center;gap:8px;width:100%}
.cpicker-swatch{width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,.2);flex-shrink:0}
.cpicker-hex{background:rgba(255,255,255,.06);border:1px solid rgba(201,153,58,.2);border-radius:2px;color:rgba(245,240,232,.85);font-family:'Courier Prime',monospace;font-size:12px;padding:5px 8px;width:100%;outline:none;letter-spacing:.06em}
.cpicker-presets{display:flex;gap:5px;flex-wrap:wrap;justify-content:center}
.cpicker-pre{width:18px;height:18px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:all .18s}
.cpicker-pre:hover{transform:scale(1.2);border-color:rgba(255,255,255,.35)}
.cpicker-close{background:none;border:1px solid rgba(201,153,58,.25);border-radius:2px;color:rgba(201,153,58,.7);font-family:'Courier Prime',monospace;font-size:10px;letter-spacing:.15em;text-transform:uppercase;padding:5px 14px;cursor:pointer;transition:all .18s;width:100%}
.cpicker-close:hover{border-color:var(--gold);color:var(--gold);background:rgba(201,153,58,.07)}

/* ─── NOTEBOOK LAYOUT ─── */
.nb-layout{display:flex;align-items:center;gap:16px;padding:16px 12px;flex-shrink:0;position:relative;z-index:1}
.pt-nav{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
  width:54px;height:190px;flex-shrink:0;background:rgba(26,18,8,.65);
  border:1px solid rgba(201,153,58,.16);border-radius:2px;cursor:pointer;
  transition:all .26s;color:rgba(201,153,58,.45);position:relative;overflow:hidden}
.pt-nav::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 25px,rgba(201,153,58,.04) 25px,rgba(201,153,58,.04) 26px);pointer-events:none}
.pt-nav:hover:not(.pt-nav-off){background:rgba(201,153,58,.1);border-color:rgba(201,153,58,.38);color:var(--gold);box-shadow:0 0 22px rgba(201,153,58,.12)}
.pt-nav:active:not(.pt-nav-off){transform:scale(.97)}
.pt-nav-off{opacity:.2;cursor:default}
.pt-arrow{font-family:'Playfair Display',serif;font-size:32px;line-height:1;transition:transform .2s}
.pt-nav:hover:not(.pt-nav-off) .pt-arrow{transform:scale(1.2)}
.pt-label{font-family:'Courier Prime',monospace;font-size:9px;letter-spacing:.15em;text-transform:uppercase;opacity:.65}
.pt-pages{font-family:'Playfair Display',serif;font-size:12px;font-style:italic;opacity:.55}

/* ─── NOTEBOOK BOOK ─── */
.nb-scene{position:relative}
.nb-book{width:800px;height:522px;display:flex;border-radius:3px 10px 10px 3px;
  box-shadow:0 40px 100px rgba(0,0,0,.78),0 10px 30px rgba(0,0,0,.5),0 0 0 1px rgba(201,153,58,.08);
  background:#140e06;overflow:hidden;position:relative}

/* PAGES */
.pg{flex:1;background:var(--paper);position:relative;overflow:hidden}
.pg-l{border-radius:3px 0 0 3px}
.pg-r{border-radius:0 10px 10px 0}
.pg-l::after{content:'';position:absolute;right:0;top:0;bottom:0;width:18px;background:linear-gradient(to right,transparent,rgba(26,18,8,.05));pointer-events:none;z-index:3}
.pg-r::before{content:'';position:absolute;left:0;top:0;bottom:0;width:18px;background:linear-gradient(to left,transparent,rgba(26,18,8,.04));pointer-events:none;z-index:3}
.ppr-tex{position:absolute;inset:0;pointer-events:none;opacity:.28;z-index:1;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.03'/%3E%3C/svg%3E")}
.pg-lines{position:absolute;inset:0;padding:12px 12px 12px 44px;overflow:hidden;pointer-events:none;z-index:2}
.pg-lines::before{content:'';position:absolute;left:36px;top:0;bottom:0;width:1.5px;background:var(--margin-c);opacity:.48}
.ln{height:26px;border-bottom:1px solid var(--line-c);width:100%}
.pg-hdr{position:absolute;top:7px;height:24px;display:flex;align-items:center;font-size:11px;color:rgba(26,18,8,.3);font-family:'Courier Prime',monospace;letter-spacing:.12em;pointer-events:none;z-index:9}
.pg-hdr-l{left:46px;right:12px;justify-content:space-between}
.pg-hdr-r{left:12px;right:12px;justify-content:space-between}
.wz{position:absolute;top:38px;bottom:8px;z-index:8}
.wz-l{left:46px;right:8px}
.wz-r{left:8px;right:8px}
textarea.ink{width:100%;height:100%;background:transparent;border:none;outline:none;resize:none;font-size:18px;color:rgba(26,18,8,.9);line-height:26px;padding:0 3px;caret-color:var(--rust);letter-spacing:.18px;word-spacing:2px}
textarea.ink::placeholder{color:rgba(26,18,8,.2);font-style:italic}
textarea.ink.ink-nodraw{pointer-events:none;user-select:none}
.draw-canvas{position:absolute;inset:0;z-index:14;background:transparent}
.brand-wm{position:absolute;bottom:6px;left:46px;font-family:'Sacramento',cursive;font-size:12px;color:rgba(26,18,8,.28);pointer-events:none;z-index:9}
.pg-curl{position:absolute;bottom:0;right:0;width:24px;height:24px;background:linear-gradient(135deg,transparent 50%,rgba(26,18,8,.08) 50%);z-index:6;pointer-events:none;border-radius:0 0 10px 0}
.sel-delete-btn{position:absolute;top:8px;right:16px;z-index:20;background:rgba(194,80,31,.9);border:none;border-radius:2px;color:#fff;font-family:'Courier Prime',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding:6px 12px;cursor:pointer;backdrop-filter:blur(4px);transition:all .2s;box-shadow:0 2px 10px rgba(0,0,0,.3)}
.sel-delete-btn:hover{background:#c2501f;transform:translateY(-1px)}

/* SPINE */
.spine{width:30px;background:#0e0905;flex-shrink:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;padding:12px 0;box-shadow:inset -2px 0 8px rgba(0,0,0,.35),inset 2px 0 8px rgba(0,0,0,.35)}
.sr{width:17px;height:10px;border:2.5px solid #1e1408;border-radius:50%;background:#140e06;position:relative;box-shadow:inset 0 1px 2px rgba(255,255,255,.05)}
.sr::after{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:5px;height:5px;border-radius:50%;background:linear-gradient(135deg,#2a1a08,#0a0603)}

/* PAGE TURN */
.pt-overlay{position:absolute;inset:0;pointer-events:none;z-index:50;perspective:1400px}
.tp{position:absolute;right:0;top:0;width:50%;height:100%;transform-origin:left center;transform-style:preserve-3d;border-radius:0 10px 10px 0;z-index:50;display:none}
.tp.fwd{display:block;animation:tFwd .75s cubic-bezier(.645,.045,.355,1) forwards}
.tp.bwd{display:block;animation:tBwd .75s cubic-bezier(.645,.045,.355,1) forwards}
.tp-face{position:absolute;inset:0;backface-visibility:hidden;overflow:hidden}
.tp-fr{background:linear-gradient(to right,#e5dcc8,var(--paper));border-radius:0 10px 10px 0;box-shadow:-6px 0 22px rgba(0,0,0,.22)}
.tp-bk{background:linear-gradient(to left,#e5dcc8,var(--paper));transform:rotateY(180deg);border-radius:10px 0 0 10px}
.tp-ln-wrap{position:absolute;inset:0;padding:11px;overflow:hidden}
.tp-ln{height:26px;border-bottom:1px solid var(--line-c)}
@keyframes tFwd{0%{transform:rotateY(0)}35%{box-shadow:-30px 0 60px rgba(0,0,0,.42)}100%{transform:rotateY(-180deg)}}
@keyframes tBwd{0%{transform:rotateY(-180deg)}100%{transform:rotateY(0)}}

@keyframes fadeUp{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}

@media(max-width:1020px){.nb-book{width:720px;height:470px}.pt-nav{height:160px}}
@media(max-width:860px){.nb-book{width:96vw;height:calc(96vw*.65)}.pt-nav{display:none}
  .hero{grid-template-columns:1fr}.hero-r,.types-grid,.hist-inn,.care-grid{grid-columns:1fr;display:block}
  .types-sec,.hist-sec,.care-sec,.ruled-sec,.foot-cta{padding:50px 24px}
  .quote-band{padding:24px 24px}
  footer{flex-direction:column;gap:12px;text-align:center;padding:32px 24px}
  .cta{margin-left:24px}}
`;

/* ═══════════════════════════════════════════════════
   STYLE INJECTOR + SCROLL REVEAL
═══════════════════════════════════════════════════ */
function GlobalStyle() {
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = GLOBAL_CSS;
    document.head.prepend(el);
    return () => el.remove();
  }, []);
  return null;
}

function useReveal(ref) {
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.1 }
    );
    ref.current.querySelectorAll(".reveal").forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [ref]);
}

/* ═══════════════════════════════════════════════════
   LANDING PAGE
═══════════════════════════════════════════════════ */
function Cta({ onClick, sub = "Start writing today" }) {
  return (
    <button className="cta" onClick={onClick}>
      <span className="cta-icon">📓</span>
      <span className="cta-lbl">Create a New Notebook<span className="cta-sub">{sub}</span></span>
    </button>
  );
}

const typeCards = [
  ["01","The Hardcover Journal","Durable, dignified, built to last decades. The hardcover is an heirloom in waiting — a place for your most deliberate thoughts."],
  ["02","The Field Notes Pad","Pocket-sized, always within reach. Born on worksites and in wild places, it captures the world mid-motion — brief observations, sketches, lists."],
  ["03","The Moleskine","Beloved by artists and travelers for generations. Its elastic closure and ribbon bookmark speak to a ritual of daily use and devoted filling."],
  ["04","The Composition Book","The democratic notebook. Found in schoolrooms and artists' studios alike — unpretentious yet endlessly capable of holding a mind at work."],
  ["05","The Bullet Journal","A system as much as a book. Dotted pages invite structure and improvisation — a living document of task, reflection, and intention."],
  ["06","The Sketchbook","Unlined, unhurried. The sketchbook asks only that you look closely and dare to mark the page. Its blank leaves invite you to see differently."],
];
const tlItems = [
  ["~105 AD","Paper Invented in China","Cai Lun refines papermaking using bark, hemp, and rags — laying the foundation for the written page."],
  ["1500s","The Commonplace Book","Scholars compile personal volumes of wisdom and recipes — the ancestor of the modern journal."],
  ["1858","The Composition Book","The marbled hardcover notebook enters American schools, becoming the iconic classroom companion."],
  ["1997","Moleskine Revived","The legendary oilcloth notebook is relaunched and finds a new generation of devoted writers."],
  ["2013","The Bullet Journal","Ryder Carroll's analog productivity method sparks a global movement of intentional notebooking."],
];
const careItems = [
  ["🖊","Choose the right pen","Match your ink to your paper weight. Fountain pens sing on thick, uncoated sheets; fine-tip rollerballs suit smooth dotted journals."],
  ["📐","Protect the spine","Never force a notebook flat. A broken spine leads to pages that drift loose — a small tragedy, entirely avoidable."],
  ["🌡","Store away from light","Sunlight yellows paper and fades ink. Keep filled notebooks in a cool, dry drawer or on a shaded shelf."],
  ["🗓","Date your entries","A notebook without dates is a novel without chapters. Even a simple month and year transforms notes into a navigable archive."],
];

function Landing({ onEnter, cls }) {
  const ref = useRef(null);
  useReveal(ref);
  return (
    <div className={`view v-landing ${cls}`} ref={ref}>
      <div className="noise"/>
      <section className="hero">
        <div className="hero-l">
          <div className="vol-tag">Volume I &nbsp;·&nbsp; The Written Word</div>
          <h1 className="hero-title">The<br/><em>Notebook</em></h1>
          <p className="hero-sub">A celebration of paper, ink, and the irreplaceable act of writing by hand — in a world that insists on typing.</p>
          <Cta onClick={onEnter}/>
          <div className="hero-ghost">N</div>
        </div>
        <div className="hero-r">
          <div className="nb-vis">
            <div className="nb-cov">
              <div className="nb-rngs">{[...Array(7)].map((_,i)=><div className="nb-rng" key={i}/>)}</div>
              <div className="nb-cov-txt">My<br/>Notebook</div>
            </div>
          </div>
        </div>
      </section>
      <div className="quote-band">
        <blockquote>"A notebook does not judge. It holds your half-formed thoughts, your wildest fears, your unpolished genius — and asks for nothing in return."<cite>— On the nature of writing</cite></blockquote>
      </div>
      <section className="types-sec"><div className="types-inn">
        <div className="reveal"><div className="sec-lbl">§ 01 &nbsp;·&nbsp; Varieties</div><h2 className="sec-ttl">Every kind of<br/><em>notebook</em> has a soul</h2></div>
        <div className="types-grid reveal">{typeCards.map(([n,name,desc])=>(
          <div className="t-card" key={n}><div className="t-num">{n}</div><div className="t-bar"/><div className="t-name">{name}</div><div className="t-desc">{desc}</div></div>
        ))}</div>
      </div></section>
      <section className="hist-sec"><div className="hist-inn">
        <div className="hist-txt reveal">
          <div className="sec-lbl">§ 02 &nbsp;·&nbsp; Origins</div><h2 className="sec-ttl">A brief<br/><em>history</em></h2><br/>
          <p>Long before the notebook existed in the form we know today, writers and scholars carried loose leaves, wax tablets, and folded quires of vellum. The bound notebook emerged gradually across centuries of papermaking, binding craft, and the slow recognition that private thought deserves a dedicated home.</p>
          <p>In the sixteenth century, the commonplace book became fashionable among educated Europeans — a personal anthology of quotations, recipes, and ideas gathered from life's reading. It was not a diary; it was a mind made visible.</p>
          <p>By the nineteenth century, with paper cheap and literacy spreading, the notebook became a universal companion. Naturalists, inventors, poets, and generals alike filled their pages with the working material of thought — rough, honest, and alive.</p>
        </div>
        <div className="reveal">{tlItems.map(([yr,title,desc])=>(
          <div className="tl-item" key={yr}><div className="tl-yr">{yr}</div><div className="tl-dot"/><div><div className="tl-ttl">{title}</div><div className="tl-dsc">{desc}</div></div></div>
        ))}</div>
      </div></section>
      <section className="ruled-sec"><div className="ruled-inn reveal">
        <h2>Why write by hand at all?</h2>
        <p>Research consistently shows that handwriting engages the brain differently from typing. The slower pace of the pen demands synthesis — you cannot transcribe everything, so you must understand, select, and recast. Ideas written by hand are better retained, more deeply processed, and more genuinely owned. There is also something irreplaceable about the artifact itself: a notebook that bears your pressure, your corrections, your coffee rings. It is evidence that you were here, thinking, alive on this particular morning.</p>
      </div></section>
      <section className="care-sec"><div className="care-inn">
        <div className="reveal"><div className="sec-lbl">§ 03 &nbsp;·&nbsp; Stewardship</div><h2 className="sec-ttl">Caring for<br/><em>your notebook</em></h2></div>
        <div className="care-grid reveal">{careItems.map(([ico,h,p])=>(
          <div className="care-it" key={h}><span className="care-ico">{ico}</span><h3>{h}</h3><p>{p}</p></div>
        ))}</div>
      </div></section>
      <div className="foot-cta"><p>Your first blank page is waiting.<br/><em>What will you write?</em></p><Cta onClick={onEnter} sub="Begin your daily practice"/></div>
      <footer><div className="ft-brand">The Notebook</div><div className="ft-tag">Write something worth keeping.</div><div className="ft-copy">Est. since the first blank page</div></footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TOOLBAR ICON SVGS
═══════════════════════════════════════════════════ */
const IcoText     = () => <svg viewBox="0 0 24 24"><path d="M5 4v3h5.5v12h3V7H19V4z"/></svg>;
const IcoPencil   = () => <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>;
const IcoHighlight = () => <svg viewBox="0 0 24 24"><path d="M7 21h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2zm2.71-14.29l-3.42-3.42a1 1 0 00-1.41 0l-8.66 8.66A1 1 0 004 13v4h4a1 1 0 00.71-.29l8.66-8.66a1 1 0 000-1.34zM7.59 15H6v-1.59l6.66-6.65 1.59 1.58L7.59 15z"/></svg>;
const IcoEraser   = () => <svg viewBox="0 0 24 24"><path d="M15.14 3a1 1 0 00-.71.3L2.3 15.43a1 1 0 000 1.41l3.54 3.54a1 1 0 001.41 0L20.7 7.24a1 1 0 000-1.41l-4.83-2.54-.73-.29zm-8.6 15.56L3 15.02l9.29-9.29 3.56 1.86-9.31 11z"/></svg>;
const IcoSelect   = () => <svg viewBox="0 0 24 24"><path d="M4 4h6v2H6v4H4V4zm14 0v6h-2V6h-4V4h6zM4 14h2v4h4v2H4v-6zm14 4h-4v2h6v-6h-2v4z"/></svg>;

/* ═══════════════════════════════════════════════════
   NOTE APP
═══════════════════════════════════════════════════ */
function NoteApp({ onBack, cls }) {
  const [spread,     setSpread]     = useState(0);
  const [tool,       setTool]       = useState("text");
  const [pencilSize, setPencilSize] = useState(TOOL_SIZES.pencil[1]);
  const [hlColor,    setHlColor]    = useState(HIGHLIGHT_COLORS[0].hex);
  const [hlSize,     setHlSize]     = useState(TOOL_SIZES.highlight[1]);
  const [eraserSize, setEraserSize] = useState(TOOL_SIZES.eraser[1]);
  const [pencilColor,setPColor]     = useState("#1a1208");
  const [showPicker, setShowPicker] = useState(false);
  const [font,       setFont]       = useState(FONTS[0].value);
  const [turning,    setTurning]    = useState(null);
  const pagesRef = useRef(new Map());
  const pickerRef = useRef(null);

  const leftPage  = spread * 2 + 1;
  const rightPage = spread * 2 + 2;

  /* Close picker on outside click */
  useEffect(() => {
    if (!showPicker) return;
    const h = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowPicker(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showPicker]);

  const navigate = useCallback((dir) => {
    const next = spread + dir;
    if (next < 0 || next > MAX_SPREAD || turning) return;
    setTurning(dir > 0 ? "fwd" : "bwd");
    setTimeout(() => { setSpread(next); setTurning(null); }, 760);
  }, [spread, turning]);

  useEffect(() => {
    const h = (e) => {
      if (e.altKey && e.key === "ArrowRight") navigate(1);
      if (e.altKey && e.key === "ArrowLeft")  navigate(-1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [navigate]);

  /* Derived: size + opacity for current tool */
  const activeSize    = tool === "pencil" ? pencilSize : tool === "highlight" ? hlSize : eraserSize;
  const activeSizes   = TOOL_SIZES[tool] || TOOL_SIZES.pencil;
  const pencilOpacity = 0.9;

  const setActiveSize = (s) => {
    if (tool === "pencil")    setPencilSize(s);
    else if (tool==="highlight") setHlSize(s);
    else if (tool==="eraser") setEraserSize(s);
  };

  return (
    <div className={`view v-app ${cls}`}>
      {/* APP BAR */}
      <div className="app-bar">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="bar-div"/>
        <div className="app-logo">The Notebook</div>
        <div className="bar-div"/>

        {/* TOOL GROUP */}
        <div className="tool-grp">
          {[
            ["text",      <IcoText/>,      "Text — type anywhere"],
            ["pencil",    <IcoPencil/>,    "Pencil — draw freely"],
            ["highlight", <IcoHighlight/>, "Highlighter"],
            ["eraser",    <IcoEraser/>,    "Eraser"],
            ["select",    <IcoSelect/>,    "Select & delete strokes"],
          ].map(([t, icon, tip]) => (
            <button key={t} className={`tb ${tool===t?"on":""}`} title={tip} onClick={() => setTool(t)}>
              {icon}
            </button>
          ))}
        </div>

        <div className="bar-div"/>

        {/* SIZE DOTS (hide for text/select) */}
        {["pencil","highlight","eraser"].includes(tool) && (
          <div className="sz-row">
            {activeSizes.map((s, i) => (
              <div key={s} className={`sz-d ${activeSize===s?"on":""}`}
                style={{ width: 7+i*4, height: 7+i*4 }}
                title={["Fine","Medium","Bold"][i]}
                onClick={() => setActiveSize(s)}/>
            ))}
          </div>
        )}

        {/* PENCIL COLOR WHEEL BUTTON */}
        {tool === "pencil" && (
          <>
            <div className="bar-div"/>
            <div className="cpicker-wrap" ref={pickerRef}>
              <div className="color-btn ring" style={{ background: pencilColor }}
                onClick={() => setShowPicker(p => !p)} title="Pick color"/>
              {showPicker && (
                <ColorWheelPicker
                  color={pencilColor}
                  onChange={setPColor}
                  onClose={() => setShowPicker(false)}/>
              )}
            </div>
          </>
        )}

        {/* HIGHLIGHTER COLORS */}
        {tool === "highlight" && (
          <>
            <div className="bar-div"/>
            <div className="hl-colors">
              {HIGHLIGHT_COLORS.map(({ hex, label }) => (
                <div key={label} className={`hl-c ${hlColor===hex?"on":""}`}
                  style={{ background: hex }} title={label}
                  onClick={() => setHlColor(hex)}/>
              ))}
            </div>
          </>
        )}

        <div style={{ flex: 1 }}/>

        {/* FONT + SPREAD */}
        <select className="fnt-sel" value={font} onChange={e => setFont(e.target.value)}>
          {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <div className="spread-ind">pg. {leftPage}–{rightPage}</div>
      </div>

      {/* NOTEBOOK SPREAD + NAV */}
      <div className="nb-layout">
        <PageNavBtn dir="prev" spread={spread} onClick={() => navigate(-1)}/>

        <div className="nb-scene">
          <div className="nb-book">
            <NotebookPage key={`L${leftPage}`}  pageNum={leftPage}  isLeft={true}
              tool={tool} pencilSize={pencilSize} pencilColor={pencilColor}
              pencilOpacity={pencilOpacity} hlColor={hlColor} eraserSize={eraserSize}
              pagesRef={pagesRef} font={font}/>
            <div className="spine">{[...Array(18)].map((_,i)=><div className="sr" key={i}/>)}</div>
            <NotebookPage key={`R${rightPage}`} pageNum={rightPage} isLeft={false}
              tool={tool} pencilSize={pencilSize} pencilColor={pencilColor}
              pencilOpacity={pencilOpacity} hlColor={hlColor} eraserSize={eraserSize}
              pagesRef={pagesRef} font={font}/>
          </div>

          {/* PAGE TURN OVERLAY */}
          <div className="pt-overlay">
            <div className={`tp ${turning==="fwd"?"fwd":turning==="bwd"?"bwd":""}`}>
              <div className="tp-face tp-fr"><div className="tp-ln-wrap">{[...Array(20)].map((_,i)=><div className="tp-ln" key={i}/>)}</div></div>
              <div className="tp-face tp-bk"><div className="tp-ln-wrap">{[...Array(20)].map((_,i)=><div className="tp-ln" key={i}/>)}</div></div>
            </div>
          </div>
        </div>

        <PageNavBtn dir="next" spread={spread} onClick={() => navigate(1)}/>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ROOT
═══════════════════════════════════════════════════ */
export default function App() {
  const [flashing, setFlashing] = useState(false);
  const [lCls, setLCls] = useState("view-active");
  const [aCls, setACls] = useState("view-hidden");

  const goTo = useCallback((dest) => {
    setFlashing(true);
    setTimeout(() => {
      setFlashing(false);
      if (dest === "app") {
        setLCls("view-exit");
        setACls("view-hidden");
        requestAnimationFrame(() => requestAnimationFrame(() => setACls("view-active")));
      } else {
        setACls("view-exit");
        setLCls("view-hidden");
        requestAnimationFrame(() => requestAnimationFrame(() => {
          setLCls("view-active");
          document.querySelector(".v-landing")?.scrollTo({ top: 0, behavior: "smooth" });
        }));
      }
    }, 190);
  }, []);

  return (
    <>
      <GlobalStyle/>
      <div className={`pg-flash ${flashing?"on":""}`}/>
      <Landing cls={lCls} onEnter={() => goTo("app")}/>
      <NoteApp cls={aCls} onBack={() => goTo("landing")}/>
    </>
  );
}
