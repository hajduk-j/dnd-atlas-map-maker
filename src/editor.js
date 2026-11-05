"use strict";

/* ============================ icons ============================ */
var ICONS = {
  city:      '<path d="M3 21V11l4-3 4 3v10M11 21V7l5-4 5 4v14M6 21v-4h2v4M15 12h2M15 16h2"/>',
  village:   '<path d="M4 21v-8l8-6 8 6v8M9 21v-6h6v6"/>',
  fortress:  '<path d="M4 21V8h2V5h3v3h6V5h3v3h2v13M9 21v-6h6v6"/>',
  port:      '<path d="M12 7v13M8 10h8M12 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4M4 15a8 8 0 0 0 16 0"/>',
  mountains: '<path d="M2 20l6-11 4 6 3-5 7 10z"/>',
  forest:    '<path d="M12 3l6 8h-4l4 6H6l4-6H6z M12 17v4"/>',
  ruin:      '<path d="M5 21V9l2-2v8M11 21V6l2-2v13M17 21v-6l2-2v8M3 21h18"/>',
  place:     '<path d="M12 2l2.6 6.3 6.8.5-5.2 4.4 1.6 6.6L12 16.3 6.2 19.8l1.6-6.6L2.6 8.8l6.8-.5z"/>',
  // a point of interest can be someone rather than somewhere
  person:    '<path d="M12 11.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4.8 20.5a7.2 7.2 0 0 1 14.4 0"/>'
};
var TYPE_LABELS = {city:"City",village:"Village",fortress:"Fortress",port:"Port",mountains:"Mountains",forest:"Forest",ruin:"Ruin",place:"Place",person:"Person"};
/* Projects saved before the interface switched to English carry Slovak type keys.
   Translate them on load so their points keep the icon they were given. */
var TYPE_ALIASES = {mesto:"city",dedina:"village",pevnost:"fortress",pristav:"port",hory:"mountains",les:"forest",ruina:"ruin",miesto:"place"};
function normType(t){
  t = TYPE_ALIASES[t] || t;
  return TYPE_LABELS[t] ? t : "place";
}
function iconSvg(t){
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(ICONS[t]||ICONS.place)+'</svg>';
}

/* ============================ state ============================ */
var S = null;
var sel = null;          // id of the selected point
var selReg = null;       // id of the selected region (a point or a region is selected, never both)
var mode = null;         // null | "poi" | "anchor" | "area" | "line" — what a click is placing right now
var modeReg = null;      // id of the region whose area or big pin is being drawn
var draft = null;        // polygon being drawn [[x,y],…]
var tab = "area";        // inspector tab
var view = {z:1, x:0, y:0};

function uid(){ return Math.random().toString(36).slice(2,9); }

function blank(){
  return {
    v:1,
    title:"Untitled atlas",
    subtitle:"",
    tabTitle:"",                    // browser tab and link-preview title; empty means the atlas name
    intro:"",
    map:null,                       // {src,w,h}
    frame:true,                     // engrave a border onto the sheet (off for maps that have one)
    boundaries:[],                  // lines drawn over the map: [{id,label,color,style,paths:[[[x,y],…],…]}]
    background:"magic",             // behind the map in the finished site: "magic", "snow" or "mist"
    titleImage:null,                // artwork shown above the map when the view is pulled back
    // Sessions are the atlas read at different moments of the campaign. The map is the same in
    // all of them; they decide what the side panel shows: a recap per session, and from which
    // session on a place's text, pictures and characters appear. An empty list means no timeline,
    // which is how every atlas starts.
    sessions:[],                    // [{id,label,recap}] in chronological order
    factions:[
      newRegion("Neutral", "#4e8f7e")
    ],
    pois:[]
  };
}
function newSession(label){ return {id:uid(), label:label, recap:""}; }
/* A session in the finished map is a point in the campaign. A place's description, its pictures
   and each of its characters can be held back until a given session (`descFrom`, `imagesFrom`,
   `from`, all session ids; empty means always). */
function sessionLabelOf(id){
  for(var i=0;i<S.sessions.length;i++) if(S.sessions[i].id===id) return S.sessions[i].label;
  return "";
}
function fromSelect(current, onset){
  var sel = document.createElement("select"); sel.className="inp";
  var all = document.createElement("option"); all.value=""; all.textContent="Always"; sel.appendChild(all);
  S.sessions.forEach(function(s){
    var o = document.createElement("option"); o.value=s.id; o.textContent="From "+s.label; sel.appendChild(o);
  });
  sel.value = sessionLabelOf(current) ? current : "";
  sel.onchange = function(){ onset(sel.value); };
  return sel;
}
/* how many things are held back until a given session, for the list in map settings */
function heldFrom(id){
  var n = 0;
  S.pois.forEach(function(p){
    if(p.descFrom===id) n++;
    if(p.imagesFrom===id) n++;
    p.characters.forEach(function(c){ if(c.from===id) n++; });
  });
  return n;
}
/* A region is a faction that can additionally carry borders and a big pin.
   Both are optional — a faction without official borders leaves `area` and `anchor` empty. */
function newRegion(label, color){
  return {
    id:uid(), label:label, color:color,
    area:null,                      // [[x,y],…] relative polygon coordinates
    areaVisible:false,              // draw the polygon on the finished map; off keeps it for hover only
    anchor:null,                    // {x,y} where the big pin sits
    summary:"", description:"", image:null, characters:[]
  };
}
/* A boundary is one thing on the map, a border, a road or a river, and it may be drawn as several
   separate lines that share a color, a style and one entry in the legend. */
function newBoundary(label){ return {id:uid(), label:label, color:"#ffffff", style:"dashed", paths:[]}; }
function cleanPath(path){
  var pts = (path||[]).filter(function(q){ return q && isFinite(q[0]) && isFinite(q[1]); })
    .map(function(q){ return [Math.max(0,Math.min(1,+q[0])), Math.max(0,Math.min(1,+q[1]))]; });
  return pts.length>1 ? pts : null;
}
function boundaryById(id){
  for(var i=0;i<S.boundaries.length;i++) if(S.boundaries[i].id===id) return S.boundaries[i];
  return null;
}
function lineDash(style){ return style==="dotted" ? "0.1 6" : (style==="dashed" ? "10 7" : ""); }
function lineColor(c){ return /^#[0-9a-f]{6}$/i.test(c||"") ? c : "#ffffff"; }
function newPoi(x,y){
  return {
    id:uid(), name:"New point", type:"city", factionId:S.factions[0] ? S.factions[0].id : null,
    x:x, y:y, hidden:false,
    summary:"", description:"",
    images:[],                      // pictures of the place; the first one leads
    characters:[]
  };
}
function newChar(){ return {id:uid(), name:"New character", role:"", description:"", image:null, from:""}; }
function facOf(p){
  for(var i=0;i<S.factions.length;i++) if(S.factions[i].id===p.factionId) return S.factions[i];
  return null;
}
function colorOf(p){ var f=facOf(p); return f ? f.color : "#8a8f8c"; }
function poiById(id){ for(var i=0;i<S.pois.length;i++) if(S.pois[i].id===id) return S.pois[i]; return null; }
function regById(id){ for(var i=0;i<S.factions.length;i++) if(S.factions[i].id===id) return S.factions[i]; return null; }
function hasArea(f){ return !!(f.area && f.area.length>2); }

function selectPoi(id){ sel=id; selReg=null; tab="area"; }
function selectRegion(id){ selReg=id; sel=null; tab="area"; }
function selectNone(){ sel=null; selReg=null; }

/* ============================ images ============================ */
function readImage(file, maxDim, quality){
  return new Promise(function(res, rej){
    if(!file || !/^image\//.test(file.type)) return rej(new Error("That is not an image."));
    var url = URL.createObjectURL(file);
    var im = new Image();
    im.onload = function(){
      var w = im.naturalWidth, h = im.naturalHeight;
      var sc = Math.min(1, maxDim / Math.max(w,h));
      var cw = Math.round(w*sc), ch = Math.round(h*sc);
      var c = document.createElement("canvas"); c.width=cw; c.height=ch;
      var ctx = c.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(im, 0, 0, cw, ch);
      var hasAlpha = /png|webp/i.test(file.type);
      var out = c.toDataURL(hasAlpha ? "image/webp" : "image/jpeg", quality);
      if(out.length > 200 && out.indexOf("data:image/webp") !== 0 && hasAlpha){
        out = c.toDataURL("image/jpeg", quality);
      }
      URL.revokeObjectURL(url);
      res({src:out, w:cw, h:ch});
    };
    im.onerror = function(){ URL.revokeObjectURL(url); rej(new Error("The image could not be loaded.")); };
    im.src = url;
  });
}
function pickFile(accept){
  return new Promise(function(res){
    var inp = document.createElement("input");
    inp.type="file"; inp.accept=accept||"image/*";
    inp.onchange=function(){ res(inp.files && inp.files[0] ? inp.files[0] : null); };
    inp.click();
  });
}
function pickFiles(accept){
  return new Promise(function(res){
    var inp = document.createElement("input");
    inp.type="file"; inp.accept=accept||"image/*"; inp.multiple=true;
    inp.onchange=function(){ res(inp.files ? Array.prototype.slice.call(inp.files) : []); };
    inp.click();
  });
}
function bytesOf(str){ return Math.round((str ? str.length : 0) * 0.75); }
function fmtSize(b){
  if(b < 1024) return b+" B";
  if(b < 1048576) return (b/1024).toFixed(0)+" kB";
  return (b/1048576).toFixed(1)+" MB";
}

/* ============================ persistence ============================ */
var DB=null;
function openDb(){
  return new Promise(function(res){
    try{
      var rq = indexedDB.open("atlas-editor", 1);
      rq.onupgradeneeded=function(){ rq.result.createObjectStore("kv"); };
      rq.onsuccess=function(){ DB=rq.result; res(DB); };
      rq.onerror=function(){ res(null); };
    }catch(e){ res(null); }
  });
}
function dbSet(k,v){
  if(!DB) return Promise.resolve();
  return new Promise(function(res){
    try{
      var tx = DB.transaction("kv","readwrite");
      tx.objectStore("kv").put(v,k);
      tx.oncomplete=function(){res()}; tx.onerror=function(){res()};
    }catch(e){ res(); }
  });
}
function dbGet(k){
  if(!DB) return Promise.resolve(null);
  return new Promise(function(res){
    try{
      var tx = DB.transaction("kv","readonly");
      var rq = tx.objectStore("kv").get(k);
      rq.onsuccess=function(){ res(rq.result || null); };
      rq.onerror=function(){ res(null); };
    }catch(e){ res(null); }
  });
}
var saveTimer=null;
function persist(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function(){ dbSet("project", S); }, 500);
}

/* ============================ map: pan & zoom ============================ */
var vp = document.getElementById("viewport");
var cv = document.getElementById("canvas");

// keep the map inside the viewport: panning stops at the image edges, and an axis
// that is smaller than the viewport stays centred
function clampView(){
  if(!S.map) return;
  var r = vp.getBoundingClientRect();
  var w = S.map.w*view.z, h = S.map.h*view.z;
  view.x = w <= r.width  ? (r.width-w)/2  : Math.min(0, Math.max(r.width-w,  view.x));
  view.y = h <= r.height ? (r.height-h)/2 : Math.min(0, Math.max(r.height-h, view.y));
}
function applyView(){
  clampView();
  cv.style.transform = "translate("+view.x+"px,"+view.y+"px) scale("+view.z+")";
  cv.style.setProperty("--inv", 1/view.z);
  // vertices of the polygon being drawn stay the same size at every zoom level
  var vt = cv.querySelectorAll(".vtx");
  for(var i=0;i<vt.length;i++) vt[i].setAttribute("r", 5/view.z);
}
// How much further than "the whole map" the view may be pulled back. A map cut to the shape
// of the screen would otherwise sit edge to edge, with no room around it to see.
var PULL_BACK = 0.7;
// the zoom level at which the whole map fits the viewport
function fitZoom(){
  if(!S.map) return 0.05;
  var r = vp.getBoundingClientRect();
  var pad = 40;
  return Math.min((r.width-pad)/S.map.w, (r.height-pad)/S.map.h);
}
function fitView(){
  if(!S.map) return;
  var r = vp.getBoundingClientRect();
  var z = fitZoom();
  view.z = z;
  view.x = (r.width - S.map.w*z)/2;
  view.y = (r.height - S.map.h*z)/2;
  applyView();
}
function zoomAt(cx, cy, factor){
  var r = vp.getBoundingClientRect();
  var px = cx - r.left, py = cy - r.top;
  var nz = Math.max(fitZoom()*PULL_BACK, Math.min(12, view.z*factor));
  var k = nz/view.z;
  view.x = px - (px - view.x)*k;
  view.y = py - (py - view.y)*k;
  view.z = nz;
  applyView();
}
vp.addEventListener("wheel", function(e){
  if(!S.map) return;
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1/1.15);
}, {passive:false});

var panning=null, panMoved=false;
vp.addEventListener("pointerdown", function(e){
  if(!S.map) return;
  panMoved=false;
  if(e.target.closest(".pin")) return;
  if(mode) return;
  panning={id:e.pointerId, sx:e.clientX, sy:e.clientY, x0:e.clientX, y0:e.clientY, ox:view.x, oy:view.y, moved:false};
  vp.setPointerCapture(e.pointerId);
  vp.classList.add("panning");
});
vp.addEventListener("pointermove", function(e){
  if(!panning || e.pointerId!==panning.id) return;
  view.x = panning.ox + (e.clientX-panning.sx);
  view.y = panning.oy + (e.clientY-panning.sy);
  if(Math.abs(e.clientX-panning.x0)+Math.abs(e.clientY-panning.y0) > 3){ panning.moved=true; panMoved=true; }
  applyView();
  // re-base on the clamped position, so dragging back from an edge responds at once
  panning.sx=e.clientX; panning.sy=e.clientY; panning.ox=view.x; panning.oy=view.y;
});
function endPan(e){
  if(panning && e.pointerId===panning.id){ panning=null; vp.classList.remove("panning"); }
}
vp.addEventListener("pointerup", endPan);
vp.addEventListener("pointercancel", endPan);

function normFromEvent(e){
  var r = cv.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (e.clientX - r.left)/r.width)),
    y: Math.max(0, Math.min(1, (e.clientY - r.top)/r.height))
  };
}
function nearLastVertex(e){
  if(!draft || draft.length<2) return false;
  var r = cv.getBoundingClientRect(), l = draft[draft.length-1];
  return Math.abs(e.clientX-(r.left+l[0]*r.width)) + Math.abs(e.clientY-(r.top+l[1]*r.height)) < 14;
}
function nearFirstVertex(e){
  if(!draft || draft.length<3) return false;
  var r = cv.getBoundingClientRect();
  var fx = r.left + draft[0][0]*r.width, fy = r.top + draft[0][1]*r.height;
  return Math.abs(e.clientX-fx) + Math.abs(e.clientY-fy) < 14;
}
vp.addEventListener("click", function(e){
  if(!S.map) return;
  if(panMoved){ panMoved=false; return; }

  if(mode==="poi"){
    var n = normFromEvent(e);
    var p = newPoi(n.x, n.y);
    S.pois.push(p);
    setMode(null);
    selectPoi(p.id);
    renderAll(); persist();
    var fld = document.getElementById("poiName"); if(fld){ fld.focus(); fld.select(); }
    return;
  }
  if(mode==="anchor"){
    var r = regById(modeReg);
    if(r){ var na = normFromEvent(e); r.anchor = {x:na.x, y:na.y}; selectRegion(r.id); }
    setMode(null);
    renderAll(); persist();
    return;
  }
  if(mode==="line"){
    if(nearLastVertex(e)){ finishLine(); return; }
    var nl = normFromEvent(e);
    draft.push([nl.x, nl.y]);
    refreshAreas();
    return;
  }
  if(mode==="area"){
    if(nearFirstVertex(e)){ closeDraft(); return; }
    var nv = normFromEvent(e);
    draft.push([nv.x, nv.y]);
    refreshAreas();
    return;
  }
  // a click inside a region's area selects it — otherwise a region without a big pin could not be picked
  var pg = e.target.closest && e.target.closest("polygon[data-reg]");
  if(pg){ selectRegion(pg.getAttribute("data-reg")); renderAll(); }
});
document.addEventListener("keydown", function(e){
  var t = e.target;
  var typing = t && (t.tagName==="INPUT" || t.tagName==="TEXTAREA" || t.tagName==="SELECT");
  if(e.key==="Escape"){
    if(mode){ setMode(null); refreshAreas(); }
    return;
  }
  if(!mode || typing) return;
  if(mode==="line" && e.key==="Enter"){ e.preventDefault(); finishLine(); }
  if((mode==="area" || mode==="line") && e.key==="Backspace"){
    e.preventDefault();
    if(draft && draft.length){ draft.pop(); refreshAreas(); }
  }
});

function setMode(m, regId){
  mode = m || null;
  modeReg = mode ? (regId||null) : null;
  draft = (mode==="area" || mode==="line") ? (draft||[]) : null;
  vp.classList.toggle("adding", !!mode);
  vp.classList.toggle("drawing-line", mode==="line");
  var hint = document.getElementById("stageHint");
  hint.classList.toggle("hidden", !mode);
  hint.textContent =
    mode==="poi"    ? "Click the map to place the point. Esc cancels." :
    mode==="anchor" ? "Click the map to place the region's big pin. Esc cancels." :
    mode==="line"   ? "Click along the line. Enter, or a click on the last point, finishes it. Backspace takes the last point back, Esc cancels." :
    mode==="area"   ? "Click the vertices of the area. Enter or a click on the first vertex closes it, Backspace takes the last one back, Esc cancels." : "";
  document.getElementById("btnAddPoi").textContent = mode==="poi" ? "Cancel placing" : "Add point";
}
function startArea(regId){ draft=[]; setMode("area", regId); renderAll(); }
function startLine(id){ draft=[]; setMode("line", id); renderAll(); }
function finishLine(){
  var b = boundaryById(modeReg);
  if(b && draft && draft.length>1) b.paths.push(draft.slice());
  else if(draft && draft.length) toast("A line needs at least two points.");
  setMode(null);
  renderAll(); persist();
}
function closeDraft(){
  var f = regById(modeReg);
  if(f && draft && draft.length>2) f.area = draft.slice();
  else if(draft && draft.length) toast("An area needs at least three vertices.");
  setMode(null);
  renderAll(); persist();
}

/* ============================ render: map ============================ */
function renderMap(){
  var dz = document.getElementById("dropzone");
  dz.classList.toggle("hidden", !!S.map);
  document.getElementById("zoombar").classList.toggle("hidden", !S.map);
  cv.innerHTML = "";
  if(!S.map) return;
  cv.style.width = S.map.w+"px";
  var img = new Image();
  img.src = S.map.src; img.alt="";
  cv.appendChild(img);

  renderAreas();
  renderBoundaries();
  if(S.frame) cv.insertAdjacentHTML("beforeend", frameHtml(S.map.w, S.map.h));

  S.factions.forEach(function(f){
    if(!f.anchor) return;
    var el = document.createElement("div");
    el.className="pin big"; el.dataset.reg=f.id;
    el.style.left = (f.anchor.x*100)+"%"; el.style.top = (f.anchor.y*100)+"%";
    el.style.setProperty("--pc", f.color);
    if(selReg===f.id) el.dataset.sel="1";
    el.innerHTML = '<div class="lbl"></div>';   // a region is only its lettering
    el.querySelector(".lbl").textContent = f.label;
    attachDrag(el,
      function(n){ f.anchor.x=n.x; f.anchor.y=n.y; },
      function(){ selectRegion(f.id); renderAll(); });
    cv.appendChild(el);
  });

  S.pois.forEach(function(p){
    var el = document.createElement("div");
    var at = {x:p.x, y:p.y};
    el.className="pin"; el.dataset.id=p.id; el.dataset.type=p.type;
    el.style.left = (at.x*100)+"%"; el.style.top = (at.y*100)+"%";
    el.style.setProperty("--pc", colorOf(p));
    if(sel===p.id) el.dataset.sel="1";
    if(p.hidden) el.dataset.hidden="1";
    el.innerHTML = '<div class="knob">'+iconSvg(p.type)+'</div><div class="lbl"></div>';
    el.querySelector(".lbl").textContent = p.name;
    attachDrag(el,
      function(n){ p.x=n.x; p.y=n.y; },
      function(){ selectPoi(p.id); renderAll(); });
    cv.appendChild(el);
  });
}
/* A border engraved onto the sheet, for map images that bring none of their own: two rules
   with a tinted margin between them and a lozenge at the corners and the middle of each side.
   Everything is in map units, so it zooms with the map and moves no point. Kept identical to
   frameHtml() in viewer.html, or the preview would stop matching the export. */
function frameHtml(w,h){
  var u=Math.min(w,h), pad=u*.013, band=u*.021, sw=Math.max(.8,u*.0016);
  var x0=pad+band, y0=pad+band, x1=w-pad-band, y1=h-pad-band;
  function f(n){ return Math.round(n*10)/10; }
  function rect(x,y,rw,rh){ return "M"+f(x)+" "+f(y)+"h"+f(rw)+"v"+f(rh)+"h"+f(-rw)+"Z"; }
  function loz(cx,cy,r){
    return "M"+f(cx)+" "+f(cy-r)+"L"+f(cx+r)+" "+f(cy)+"L"+f(cx)+" "+f(cy+r)+"L"+f(cx-r)+" "+f(cy)+"Z";
  }
  var outer=rect(pad,pad,w-2*pad,h-2*pad), inner=rect(x0,y0,x1-x0,y1-y0);
  var mx=(x0+x1)/2, my=(y0+y1)/2, big=band*.62, small=band*.3;
  var orn=loz(x0,y0,big)+loz(x1,y0,big)+loz(x1,y1,big)+loz(x0,y1,big)
         +loz(mx,y0,small)+loz(mx,y1,small)+loz(x0,my,small)+loz(x1,my,small);
  return '<svg class="frame" viewBox="0 0 '+w+' '+h+'" aria-hidden="true"'
    +' style="box-shadow:inset 0 0 '+Math.round(u*.045)+'px rgba(6,10,11,.5)">'
    +'<path class="band" fill-rule="evenodd" d="'+outer+inner+'"/>'
    +'<path class="rule" stroke-width="'+f(sw*1.8)+'" d="'+outer+'"/>'
    +'<path class="rule" stroke-width="'+f(sw)+'" d="'+inner+'"/>'
    +'<path class="orn" d="'+orn+'"/></svg>';
}

/* Areas are drawn from relative coordinates converted to map pixels, so they
   pan and zoom together with the base image. In the export they are invisible unless the region asks to be shown. */
function ptsOf(list){
  return list.map(function(pt){
    return (pt[0]*S.map.w).toFixed(1)+","+(pt[1]*S.map.h).toFixed(1);
  }).join(" ");
}
function renderAreas(){
  var NS = "http://www.w3.org/2000/svg";
  var drawn = S.factions.filter(hasArea);
  var dft = mode==="area" ? draft : null;      // a line being drawn is painted with the lines
  if(!drawn.length && !dft) return;
  var svg = document.createElementNS(NS,"svg");
  svg.setAttribute("class","areas");
  svg.setAttribute("width", S.map.w);
  svg.setAttribute("height", S.map.h);
  svg.setAttribute("viewBox", "0 0 "+S.map.w+" "+S.map.h);

  drawn.forEach(function(f){
    if(mode==="area" && modeReg===f.id) return;   // this is the one being redrawn
    var pg = document.createElementNS(NS,"polygon");
    pg.setAttribute("points", ptsOf(f.area));
    pg.setAttribute("data-reg", f.id);
    if(selReg===f.id) pg.setAttribute("data-sel","1");
    pg.style.setProperty("--ac", f.color);
    svg.appendChild(pg);
  });

  if(dft && dft.length){
    var dr = regById(modeReg);
    var color = dr ? dr.color : "#dcae6a";
    var pl = document.createElementNS(NS,"polyline");
    pl.setAttribute("class","draft");
    pl.setAttribute("points", ptsOf(dft));
    pl.style.setProperty("--ac", color);
    svg.appendChild(pl);
    dft.forEach(function(pt){
      var c = document.createElementNS(NS,"circle");
      c.setAttribute("class","vtx");
      c.setAttribute("cx", (pt[0]*S.map.w).toFixed(1));
      c.setAttribute("cy", (pt[1]*S.map.h).toFixed(1));
      c.setAttribute("r", 5/view.z);
      c.style.setProperty("--ac", color);
      svg.appendChild(c);
    });
  }
  // areas belong under the points, otherwise the polygon would steal clicks from the pins above it
  var firstPin = cv.querySelector(".pin");
  if(firstPin) cv.insertBefore(svg, firstPin); else cv.appendChild(svg);
}
/* Boundary lines sit over the areas and under the points, and never take a click. A halo of
   dark under the colored line keeps a white line readable on pale parts of the map. */
function renderBoundaries(){
  var NS = "http://www.w3.org/2000/svg";
  var drawn = S.boundaries.filter(function(b){ return b.paths.length>0; });
  var dft = mode==="line" ? draft : null;
  if(!drawn.length && !(dft && dft.length)) return;
  var svg = document.createElementNS(NS,"svg");
  svg.setAttribute("class","boundaries");
  svg.setAttribute("width", S.map.w);
  svg.setAttribute("height", S.map.h);
  svg.setAttribute("viewBox", "0 0 "+S.map.w+" "+S.map.h);
  function line(pts, color, style){
    var dash = lineDash(style), s = ptsOf(pts);
    ["halo","line"].forEach(function(k){
      var pl = document.createElementNS(NS,"polyline");
      pl.setAttribute("class", k);
      pl.setAttribute("points", s);
      if(dash) pl.setAttribute("stroke-dasharray", dash);
      if(k==="line") pl.setAttribute("stroke", lineColor(color));
      svg.appendChild(pl);
    });
  }
  drawn.forEach(function(b){ b.paths.forEach(function(pts){ line(pts, b.color, b.style); }); });
  if(dft && dft.length){
    var db = boundaryById(modeReg);
    if(dft.length>1) line(dft, db ? db.color : "#ffffff", db ? db.style : "dashed");
    dft.forEach(function(pt){
      var c = document.createElementNS(NS,"circle");
      c.setAttribute("class","vtx");
      c.setAttribute("cx", (pt[0]*S.map.w).toFixed(1));
      c.setAttribute("cy", (pt[1]*S.map.h).toFixed(1));
      c.setAttribute("r", 5/view.z);
      c.style.setProperty("--ac", db ? lineColor(db.color) : "#ffffff");
      svg.appendChild(c);
    });
  }
  var firstPin = cv.querySelector(".pin");
  if(firstPin) cv.insertBefore(svg, firstPin); else cv.appendChild(svg);
}
/* While drawing it is enough to repaint the areas layer — renderMap() would rebuild
   the <img> holding the whole map as a data URI every time and the image would flicker. */
function refreshAreas(){
  var old = cv.querySelector(".areas");
  if(old) old.remove();
  var oldB = cv.querySelector(".boundaries");
  if(oldB) oldB.remove();
  if(S.map){ renderAreas(); renderBoundaries(); }
}
function attachDrag(el, move, pick){
  var drag=null;
  el.addEventListener("pointerdown", function(e){
    e.stopPropagation();
    drag={id:e.pointerId, moved:false};
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener("pointermove", function(e){
    if(!drag || e.pointerId!==drag.id) return;
    drag.moved=true;
    var n = normFromEvent(e);
    move(n);
    el.style.left=(n.x*100)+"%"; el.style.top=(n.y*100)+"%";
  });
  el.addEventListener("pointerup", function(e){
    if(!drag || e.pointerId!==drag.id) return;
    if(drag.moved){ persist(); }
    else { pick(); }
    drag=null;
  });
}

/* ============================ render: list ============================ */
function renderList(){
  var ul = document.getElementById("poiList");
  ul.innerHTML="";
  document.getElementById("poiCount").textContent = S.pois.length ? S.pois.length : "";
  document.getElementById("poiEmpty").classList.toggle("hidden", S.pois.length>0);
  S.pois.forEach(function(p){
    var li = document.createElement("li");
    li.className="poi-item"; li.setAttribute("aria-selected", sel===p.id ? "true":"false");
    var dot = document.createElement("span"); dot.className="dot"; dot.style.background=colorOf(p);
    var nm = document.createElement("span"); nm.className="nm"; nm.textContent = p.name || "(unnamed)";
    var meta = document.createElement("span"); meta.className="meta";
    meta.textContent = (p.characters.length ? p.characters.length+"◦" : "") + (p.hidden ? " hidden" : "");
    li.appendChild(dot); li.appendChild(nm); li.appendChild(meta);
    li.onclick=function(){ selectPoi(p.id); renderAll(); centerOn(p); };
    ul.appendChild(li);
  });
}
function centerOn(p){
  if(!S.map) return;
  var r = vp.getBoundingClientRect();
  view.x = r.width/2 - p.x*S.map.w*view.z;
  view.y = r.height/2 - p.y*S.map.h*view.z;
  applyView();
}

/* ============================ render: inspector ============================ */
function el(tag, cls, txt){
  var e=document.createElement(tag);
  if(cls) e.className=cls;
  if(txt!=null) e.textContent=txt;
  return e;
}
function field(label, node){
  var f = el("div","field");
  var l = el("label", null, label);
  f.appendChild(l); f.appendChild(node);
  return f;
}
function input(value, oninput, placeholder){
  var i = el("input","inp"); i.value = value||""; if(placeholder) i.placeholder=placeholder;
  i.addEventListener("input", function(){ oninput(i.value); });
  return i;
}
function textarea(value, oninput, placeholder, rows){
  var t = el("textarea","inp"); t.value=value||""; if(placeholder) t.placeholder=placeholder;
  if(rows) t.rows=rows;
  t.addEventListener("input", function(){ oninput(t.value); });
  return t;
}
function imagePicker(current, onset, hint, maxDim){
  var box = el("div","thumb");
  function paint(){
    box.innerHTML="";
    if(current){
      var im=new Image(); im.src=current; im.alt=""; box.appendChild(im);
      var x = el("button","x","×"); x.title="Remove image";
      x.onclick=function(ev){ ev.stopPropagation(); current=null; onset(null); paint(); };
      box.appendChild(x);
    } else {
      box.appendChild(el("span",null,hint||"Click to add an image"));
    }
  }
  box.onclick=function(){
    pickFile("image/*").then(function(f){
      if(!f) return;
      return readImage(f, maxDim||1400, .82).then(function(r){
        current=r.src; onset(r.src); paint();
      });
    }).catch(function(e){ toast(e.message); });
  };
  paint();
  return box;
}

/* Several pictures of one place. The first one leads: it is drawn large here, it is what the
   panel shows when there is only one, and on the finished map it sets the shape of the
   gallery frame. The ‹ on a picture moves it one place earlier. */
function galleryPicker(owner){
  var box = el("div","gallery");
  function paint(){
    box.innerHTML="";
    owner.images.forEach(function(src, i){
      var t = el("div","thumb");
      var im = new Image(); im.src=src; im.alt=""; t.appendChild(im);
      var x = el("button","x","×"); x.title="Remove image";
      x.onclick=function(){ owner.images.splice(i,1); paint(); persist(); };
      t.appendChild(x);
      if(i>0){
        var l = el("button","x left","‹"); l.title="Move earlier";
        l.onclick=function(){
          var moved = owner.images.splice(i,1)[0];
          owner.images.splice(i-1, 0, moved); paint(); persist();
        };
        t.appendChild(l);
      }
      box.appendChild(t);
    });
    var add = el("div","thumb add", owner.images.length ? "Add images" : "Click to add pictures of the place");
    add.onclick=function(){
      pickFiles("image/*").then(function(files){
        // one after another, so they land in the order they were picked
        return files.reduce(function(chain, f){
          return chain.then(function(){
            return readImage(f, 1400, .82).then(function(r){ owner.images.push(r.src); });
          });
        }, Promise.resolve());
      }).then(function(){ paint(); persist(); })
        .catch(function(e){ toast(e.message); paint(); persist(); });
    };
    box.appendChild(add);
  }
  paint();
  return box;
}

function renderInspector(){
  var host = document.getElementById("inspector");
  host.innerHTML="";
  if(selReg){
    var f = regById(selReg);
    if(f){ renderRegionInspector(host, f); return; }
    selReg = null;
  }
  var p = sel ? poiById(sel) : null;
  document.getElementById("inspTitle").textContent = p ? p.name : "Point detail";
  if(!p){
    var e = el("div","empty");
    e.appendChild(el("strong",null,"Nothing selected."));
    e.appendChild(document.createTextNode("Pick a point in the list or on the map and edit its description and characters."));
    host.appendChild(e);
    return;
  }

  var tabs = el("div","tabs");
  [["area","Area"],["chars","Characters ("+p.characters.length+")"]].forEach(function(t){
    var b = el("button",null,t[1]);
    b.setAttribute("aria-selected", tab===t[0] ? "true":"false");
    b.onclick=function(){ tab=t[0]; renderInspector(); };
    tabs.appendChild(b);
  });
  host.appendChild(tabs);

  if(tab==="area"){
    var nameI = input(p.name, function(v){ p.name=v; renderList(); renderMap();
      document.getElementById("inspTitle").textContent=v; persist(); });
    nameI.id="poiName";
    host.appendChild(field("Name", nameI));

    var grid = el("div","row2");
    var typeSel = el("select","inp");
    Object.keys(TYPE_LABELS).forEach(function(k){
      var o=el("option",null,TYPE_LABELS[k]); o.value=k; if(p.type===k) o.selected=true;
      typeSel.appendChild(o);
    });
    typeSel.onchange=function(){ p.type=typeSel.value; renderMap(); persist(); };
    var facSel = el("select","inp");
    S.factions.forEach(function(f){
      var o=el("option",null,f.label); o.value=f.id; if(p.factionId===f.id) o.selected=true;
      facSel.appendChild(o);
    });
    facSel.onchange=function(){ p.factionId=facSel.value; renderMap(); renderList(); persist(); };
    var g1=el("div","field"); g1.appendChild(el("label",null,"Type")); g1.appendChild(typeSel);
    var g2=el("div","field"); g2.appendChild(el("label",null,"Faction")); g2.appendChild(facSel);
    grid.appendChild(g1); grid.appendChild(g2);
    host.appendChild(grid);

    host.appendChild(field("Area images", galleryPicker(p)));

    host.appendChild(field("Short description",
      input(p.summary, function(v){ p.summary=v; persist(); }, "One sentence, shown right under the name")));

    host.appendChild(field("Area description",
      textarea(p.description, function(v){ p.description=v; persist(); },
        "Text for the players. A blank line starts a new paragraph.", 9)));

    if(S.sessions.length>1){
      var held = el("div","field");
      held.appendChild(el("label",null,"Shown to readers"));
      held.appendChild(el("p","sub","Hold this place back until a session. Before it, the panel says nothing has been written."));
      var r1 = el("div","reg-row"); r1.appendChild(el("span","tag","Short and long description")); r1.appendChild(fromSelect(p.descFrom, function(v){ p.descFrom=v; persist(); }));
      var r2 = el("div","reg-row"); r2.appendChild(el("span","tag","Pictures")); r2.appendChild(fromSelect(p.imagesFrom, function(v){ p.imagesFrom=v; persist(); }));
      held.appendChild(r1); held.appendChild(r2);
      host.appendChild(held);
    }

    var hid = el("label","field");
    hid.style.display="flex"; hid.style.alignItems="center"; hid.style.gap="8px";
    var cb=document.createElement("input"); cb.type="checkbox"; cb.checked=!!p.hidden;
    cb.onchange=function(){ p.hidden=cb.checked; renderMap(); renderList(); persist(); };
    hid.appendChild(cb); hid.appendChild(document.createTextNode("Hide from players (not exported)"));
    host.appendChild(hid);

    var del = el("button","mini del","Delete point");
    del.onclick=function(){
      if(!confirm("Delete “"+p.name+"” and its characters?")) return;
      S.pois = S.pois.filter(function(q){ return q.id!==p.id; });
      sel=null; renderAll(); persist();
    };
    var wrap=el("div"); wrap.style.textAlign="right"; wrap.appendChild(del);
    host.appendChild(wrap);
  } else {
    renderChars(host, p);
  }
}

/* Characters look the same on a point and on a region, only the owner differs. */
function renderChars(host, owner){
  owner.characters.forEach(function(c, idx){
    var box = el("div","char");
    var top = el("div","char-top");
    top.appendChild(imagePicker(c.image, function(v){ c.image=v; persist(); }, "portrait", 700));
    var fields = el("div","fields");
    fields.appendChild(input(c.name, function(v){ c.name=v; persist(); }, "Name"));
    fields.appendChild(input(c.role, function(v){ c.role=v; persist(); }, "Role, e.g. captain of the guard"));
    top.appendChild(fields);
    box.appendChild(top);
    box.appendChild(textarea(c.description, function(v){ c.description=v; persist(); }, "Who they are, what they want, what they hide.", 4));
    if(S.sessions.length>1){
      var cf = el("div","reg-row"); cf.style.marginTop="8px";
      cf.appendChild(el("span","tag","Appears")); cf.appendChild(fromSelect(c.from, function(v){ c.from=v; persist(); }));
      box.appendChild(cf);
    }
    var acts = el("div","char-actions");
    if(idx>0){
      var up=el("button","mini","↑");
      up.onclick=function(){ var t=owner.characters[idx-1]; owner.characters[idx-1]=c; owner.characters[idx]=t; renderInspector(); persist(); };
      acts.appendChild(up);
    }
    if(idx<owner.characters.length-1){
      var dn=el("button","mini","↓");
      dn.onclick=function(){ var t=owner.characters[idx+1]; owner.characters[idx+1]=c; owner.characters[idx]=t; renderInspector(); persist(); };
      acts.appendChild(dn);
    }
    var rm=el("button","mini del","Remove");
    rm.onclick=function(){ owner.characters.splice(idx,1); renderInspector(); renderList(); persist(); };
    acts.appendChild(rm);
    box.appendChild(acts);
    host.appendChild(box);
  });
  var add = el("button","addbtn","Add character");
  add.onclick=function(){ owner.characters.push(newChar()); renderInspector(); renderList(); persist(); };
  host.appendChild(add);
}

/* ============================ inspector: region ============================ */
function renderRegionInspector(host, f){
  document.getElementById("inspTitle").textContent = f.label;
  // Characters belong to places, not to regions, so a region has only this one view.

  host.appendChild(field("Region name",
    input(f.label, function(v){ f.label=v; document.getElementById("inspTitle").textContent=v; renderMap(); renderList(); persist(); })));

  var colWrap = el("div","field");
  colWrap.appendChild(el("label",null,"Color"));
  var col = document.createElement("input"); col.type="color"; col.value=f.color;
  col.style.cssText="width:56px;height:32px;padding:2px;background:var(--ink-900);border:1px solid var(--line);border-radius:var(--r)";
  col.oninput=function(){ f.color=col.value; renderMap(); renderList(); persist(); };
  colWrap.appendChild(col);
  host.appendChild(colWrap);

  /* --- borders --- */
  var areaBox = el("div","field");
  areaBox.appendChild(el("label",null,"Area borders"));
  areaBox.appendChild(el("p","sub", hasArea(f)
    ? "The polygon has "+f.area.length+" vertices. By default it is invisible on the finished map and only lets hovering show the region's name; tick the box below to draw it."
    : "No borders yet. A faction can exist without them."));
  var areaActs = el("div","char-actions"); areaActs.style.justifyContent="flex-start";
  var drawBtn = el("button","mini", hasArea(f) ? "Redraw area" : "Draw area");
  drawBtn.onclick=function(){
    if(!S.map) return toast("Upload a map image first.");
    startArea(f.id);
  };
  areaActs.appendChild(drawBtn);
  if(hasArea(f)){
    var clr = el("button","mini del","Delete area");
    clr.onclick=function(){ f.area=null; renderAll(); persist(); };
    areaActs.appendChild(clr);
  }
  areaBox.appendChild(areaActs);
  if(hasArea(f)){
    var vis = el("label","check");
    var vcb = document.createElement("input"); vcb.type="checkbox"; vcb.checked=!!f.areaVisible;
    vcb.onchange=function(){ f.areaVisible=vcb.checked; persist(); };
    vis.appendChild(vcb); vis.appendChild(document.createTextNode("Show this area on the finished map"));
    areaBox.appendChild(vis);
  }
  host.appendChild(areaBox);

  /* --- big pin --- */
  var pinBox = el("div","field");
  pinBox.appendChild(el("label",null,"Big pin"));
  pinBox.appendChild(el("p","sub", f.anchor
    ? "It glows on the map and opens a panel with the region's description when clicked. Drag it to move it."
    : "Without a big pin the region is not shown on the map and neither its description nor its characters are exported."));
  var pinActs = el("div","char-actions"); pinActs.style.justifyContent="flex-start";
  var placeBtn = el("button","mini", f.anchor ? "Move" : "Place big pin");
  placeBtn.onclick=function(){
    if(!S.map) return toast("Upload a map image first.");
    setMode("anchor", f.id);
  };
  pinActs.appendChild(placeBtn);
  if(f.anchor){
    var rmPin = el("button","mini del","Remove pin");
    rmPin.onclick=function(){ f.anchor=null; renderAll(); persist(); };
    pinActs.appendChild(rmPin);
  }
  pinBox.appendChild(pinActs);
  host.appendChild(pinBox);

  host.appendChild(field("Region image",
    imagePicker(f.image, function(v){ f.image=v; persist(); }, "Click to add a region image", 1400)));
  host.appendChild(field("Short description",
    input(f.summary, function(v){ f.summary=v; persist(); }, "One sentence under the region's name")));
  host.appendChild(field("Region description",
    textarea(f.description, function(v){ f.description=v; persist(); },
      "What kind of land it is, who holds it, what goes on there.", 8)));

  var back = el("button","mini","Clear selection");
  back.onclick=function(){ selectNone(); renderAll(); };
  var wrap = el("div"); wrap.style.textAlign="right"; wrap.appendChild(back);
  host.appendChild(wrap);
}

function renderAll(){ renderMap(); renderList(); renderInspector(); }

/* ============================ toast + modal ============================ */
function toast(msg){
  var t = el("div","toast",msg);
  document.body.appendChild(t);
  setTimeout(function(){ t.remove(); }, 2600);
}
function modal(build, wide){
  var scrim = el("div","scrim");
  var sheet = el("div","sheet"+(wide?" wide":""));
  scrim.appendChild(sheet);
  scrim.addEventListener("click", function(e){ if(e.target===scrim) close(); });
  function close(){ scrim.remove(); document.removeEventListener("keydown", esc); }
  function esc(e){ if(e.key==="Escape") close(); }
  document.addEventListener("keydown", esc);
  document.body.appendChild(scrim);
  build(sheet, close);
  return close;
}

/* ============================ map settings ============================ */
document.getElementById("btnSettings").onclick = function(){
  modal(function(sheet, close){
    sheet.appendChild(el("h3",null,"Map settings"));
    sheet.appendChild(el("p","sub","This appears in the header of the exported site."));
    sheet.appendChild(field("Atlas name", input(S.title, function(v){ S.title=v; persist(); })));
    sheet.appendChild(field("Subtitle", input(S.subtitle, function(v){ S.subtitle=v; persist(); }, "e.g. The Confluence, winter 1247")));
    sheet.appendChild(field("Tab and link title", input(S.tabTitle, function(v){ S.tabTitle=v; persist(); }, S.title || "Same as the atlas name")));
    sheet.appendChild(el("p","sub","The text on the browser tab, and the headline of the preview when the link is shared in a chat. Leave it empty to use the atlas name. The subtitle becomes the short description under it."));
    sheet.appendChild(field("Intro text", textarea(S.intro, function(v){ S.intro=v; persist(); }, "A short intro for the visitor. Optional.", 4)));

    var art = imagePicker(S.titleImage, function(v){ S.titleImage=v; persist(); },
      "Click to add title artwork", 1600);
    art.classList.add("contain");
    sheet.appendChild(field("Title artwork", art));
    sheet.appendChild(el("p","sub","Shown above the map, in the open space that appears when the view is pulled back, and gone as soon as you move in. The finished map then opens pulled back, so it is the first thing a reader sees. A PNG with a transparent background works best; it keeps its transparency."));

    sheet.appendChild(el("h3",null,"Sessions"));
    sheet.appendChild(el("p","sub","The same map read at different moments of the campaign. The map itself never changes: sessions only decide what the side panel shows. Write a recap for each session, and on a point choose from which session its text, pictures and characters appear. With fewer than two sessions the finished map shows no session switch."));
    var slist = el("div");
    function paintSessions(){
      slist.innerHTML="";
      S.sessions.forEach(function(s, i){
        var row = el("div","reg-row");
        var held = heldFrom(s.id);
        var nm = input(s.label, function(v){ s.label=v; persist(); });
        var tag = el("span","tag", held ? held+(held===1?" thing appears here":" things appear here") : "");
        var rm = el("button","mini del x","×");
        rm.onclick=function(){
          var gone=S.sessions[i].id;
          S.sessions.splice(i,1);
          // what was held back until this session would wait for nothing, so it is shown from the start
          S.pois.forEach(function(p){
            if(p.descFrom===gone) p.descFrom="";
            if(p.imagesFrom===gone) p.imagesFrom="";
            p.characters.forEach(function(c){ if(c.from===gone) c.from=""; });
          });
          paintSessions(); renderAll(); persist();
        };
        row.appendChild(nm); row.appendChild(tag); row.appendChild(rm);
        slist.appendChild(row);
        var rc = textarea(s.recap, function(v){ s.recap=v; persist(); },
          "Recap: what happened in this session. Optional. Shown in the side panel of the finished map.", 3);
        rc.classList.add("recap-inp");
        slist.appendChild(rc);
      });
      var add = el("button","addbtn", S.sessions.length ? "Add session" : "Start a timeline");
      add.onclick=function(){
        S.sessions.push(newSession("Session "+(S.sessions.length+1)));
        paintSessions(); renderAll(); persist();
      };
      slist.appendChild(add);
    }
    paintSessions();
    sheet.appendChild(slist);

    sheet.appendChild(el("h3",null,"Regions and factions"));
    sheet.appendChild(el("p","sub","The color sets the color of the points on the map. Borders and a big pin are optional — a faction without territory leaves them empty. You can edit them after picking a region on the right."));
    var list = el("div");
    function paintFacs(){
      list.innerHTML="";
      S.factions.forEach(function(f, i){
        var row = el("div","reg-row");
        var col = document.createElement("input"); col.type="color"; col.value=f.color;
        col.oninput=function(){ f.color=col.value; renderMap(); renderList(); persist(); };
        var nm = input(f.label, function(v){ f.label=v; renderMap(); renderInspector(); persist(); });
        var bits = [];
        if(hasArea(f)) bits.push("area");
        if(f.anchor) bits.push("big pin");
        var tag = el("span","tag", bits.length ? bits.join(" · ") : "no territory");
        var show = null;
        if(hasArea(f)){
          show = el("label","check mini-check");
          show.title = "Show this area on the finished map";
          var scb = document.createElement("input"); scb.type="checkbox"; scb.checked=!!f.areaVisible;
          scb.onchange=function(){ f.areaVisible=scb.checked; persist(); };
          show.appendChild(scb); show.appendChild(document.createTextNode("Show"));
        }
        var edit = el("button","mini","Edit");
        edit.onclick=function(){ selectRegion(f.id); close(); renderAll(); };
        var rm = el("button","mini del x","×");
        rm.onclick=function(){
          if(S.factions.length<=1) return toast("At least one faction has to stay.");
          var gone=f.id; S.factions.splice(i,1);
          S.pois.forEach(function(p){ if(p.factionId===gone) p.factionId=S.factions[0].id; });
          if(selReg===gone) selectNone();
          paintFacs(); renderAll(); persist();
        };
        row.appendChild(col); row.appendChild(nm); row.appendChild(tag);
        if(show) row.appendChild(show);
        row.appendChild(edit); row.appendChild(rm);
        list.appendChild(row);
      });
      var add = el("button","addbtn","Add region");
      add.onclick=function(){ S.factions.push(newRegion("New region","#b4874a")); paintFacs(); persist(); };
      list.appendChild(add);
    }
    paintFacs();
    sheet.appendChild(list);

    sheet.appendChild(el("h3",null,"Boundary lines"));
    sheet.appendChild(el("p","sub","Lines drawn over the map, for a border, a road or a river. Pick a color and a solid, dashed or dotted line. One boundary can be several separate lines: press Add line again. A named boundary is listed once in the legend of the finished map; leave the name empty to keep it out. Regions do not react while you draw."));
    var blist = el("div");
    function paintBounds(){
      blist.innerHTML="";
      S.boundaries.forEach(function(b, i){
        var row = el("div","reg-row");
        var col = document.createElement("input"); col.type="color"; col.value=lineColor(b.color);
        col.oninput=function(){ b.color=col.value; refreshAreas(); persist(); };
        var nm = input(b.label, function(v){ b.label=v; persist(); }, "Name in the legend");
        var st = document.createElement("select"); st.className="inp"; st.style.flex="0 0 auto"; st.style.width="104px";
        [["solid","Solid"],["dashed","Dashed"],["dotted","Dotted"]].forEach(function(o){
          var op = document.createElement("option"); op.value=o[0]; op.textContent=o[1]; st.appendChild(op);
        });
        st.value = b.style;
        st.onchange=function(){ b.style=st.value; refreshAreas(); persist(); };
        var n = b.paths.length;
        var tag = el("span","tag", n ? n+(n===1?" line":" lines") : "not drawn yet");
        var draw = el("button","mini", n ? "Add line" : "Draw");
        draw.onclick=function(){
          if(!S.map) return toast("Upload a map image first.");
          close(); startLine(b.id);
        };
        var clr = el("button","mini","Clear");
        clr.onclick=function(){ b.paths=[]; paintBounds(); refreshAreas(); persist(); };
        var rm = el("button","mini del x","×");
        rm.onclick=function(){ S.boundaries.splice(i,1); paintBounds(); refreshAreas(); persist(); };
        row.appendChild(col); row.appendChild(nm); row.appendChild(st); row.appendChild(tag);
        row.appendChild(draw); if(n) row.appendChild(clr); row.appendChild(rm);
        blist.appendChild(row);
      });
      var addb = el("button","addbtn","Add boundary line");
      addb.onclick=function(){
        if(!S.map) return toast("Upload a map image first.");
        var b = newBoundary("Boundary");
        S.boundaries.push(b); persist();
        close(); startLine(b.id);
      };
      blist.appendChild(addb);
    }
    paintBounds();
    sheet.appendChild(blist);

    sheet.appendChild(el("h3",null,"Base map"));
    var mapInfo = el("p","sub", S.map ? ("Currently "+S.map.w+"×"+S.map.h+" px, "+fmtSize(bytesOf(S.map.src))+".") : "No map yet.");
    sheet.appendChild(mapInfo);

    var fr = el("label","field");
    fr.style.display="flex"; fr.style.alignItems="center"; fr.style.gap="8px";
    var frcb=document.createElement("input"); frcb.type="checkbox"; frcb.checked=S.frame!==false;
    frcb.onchange=function(){ S.frame=frcb.checked; renderMap(); persist(); };
    fr.appendChild(frcb);
    fr.appendChild(document.createTextNode("Engrave a border onto the map"));
    sheet.appendChild(fr);
    var bgSel = document.createElement("select"); bgSel.className="inp";
    [["magic","Magic motes"],["snow","Snow, with a little wind"],["mist","Mist, drifting slowly"]].forEach(function(o){
      var op = document.createElement("option"); op.value=o[0]; op.textContent=o[1]; bgSel.appendChild(op);
    });
    bgSel.value = S.background || "magic";
    bgSel.onchange = function(){ S.background=bgSel.value; persist(); };
    sheet.appendChild(field("Background of the finished map", bgSel));
    sheet.appendChild(el("p","sub","What drifts in the dark around the map. The preview shows the choice; it is not drawn in the editor."));
    sheet.appendChild(el("p","sub","Two ruled lines and a lozenge at each corner, so a plain image does not end like a photograph. Turn it off if your map already has a border painted on it."));
    var rep = el("button","tbtn","Replace map image");
    rep.onclick=function(){
      pickFile("image/*").then(function(f){
        if(!f) return;
        return readImage(f, 2600, .84).then(function(r){
          S.map=r; fitView(); renderMap(); persist();
          mapInfo.textContent = "Currently "+r.w+"×"+r.h+" px, "+fmtSize(bytesOf(r.src))+".";
          toast("Map replaced. The points kept their relative places.");
        });
      }).catch(function(e){ toast(e.message); });
    };
    sheet.appendChild(rep);

    var acts = el("div","sheet-actions");
    var reset = el("button","mini del","Start over");
    reset.onclick=function(){
      if(!confirm("Delete the whole project and start with an empty map?")) return;
      S = blank(); selectNone(); setMode(null); close(); renderAll(); persist();
    };
    var ok = el("button","tbtn primary","Done"); ok.onclick=close;
    acts.appendChild(reset); acts.appendChild(ok);
    sheet.appendChild(acts);
  });
};

/* ============================ project: save / open ============================ */
function download(filename, text, mime){
  var blob = new Blob([text], {type: mime || "text/plain;charset=utf-8"});
  return saveBlob(filename, blob, text);
}
function saveBlob(filename, blob, text){
  // 1) the claude.ai runtime, when it is available
  var tryRuntime = (window.claude && typeof window.claude.use === "function")
    ? window.claude.use("downloads").catch(function(){ return null; })
    : Promise.resolve(null);
  return tryRuntime.then(function(dl){
    if(dl && typeof dl.save === "function"){
      return dl.save({filename:filename, data:text != null ? text : blob}).then(function(){ return "runtime"; });
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
    return "anchor";
  });
}

document.getElementById("btnSave").onclick = function(){
  var name = (S.title||"atlas").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "atlas";
  download(name+".atlas.json", JSON.stringify(S), "application/json")
    .then(function(){ toast("Project saved."); })
    .catch(function(){ toast("Saving failed."); });
};
// A saved project is plain JSON. An exported map is an HTML file with the project packed
// into it, so a finished map can be brought back here and worked on further.
function projectFromHtml(text){
  // the scripts of a parsed document never run, so reading a file from elsewhere is safe
  var doc = new DOMParser().parseFromString(text, "text/html");
  var tag = doc.getElementById("atlas-project");
  if(tag) return JSON.parse(tag.textContent);
  // maps exported before the project was packed in still carry everything they show
  var old = text.match(/var DATA = (\{[\s\S]*?\});\s*[\r\n]+var ICONS/);
  if(old) return JSON.parse(old[1]);
  throw new Error("no project inside");
}
function readProject(text){
  var t = String(text).replace(/^\uFEFF/,"").replace(/^\s+/,"");
  return t.charAt(0) === "{" ? JSON.parse(t) : projectFromHtml(t);
}
document.getElementById("btnLoad").onclick = function(){
  pickFile("application/json,text/html,.json,.html,.htm").then(function(f){
    if(!f) return;
    var fr = new FileReader();
    fr.onload = function(){
      try{
        var data = readProject(fr.result);
        if(!data || !Array.isArray(data.pois)) throw new Error("bad");
        S = normalize(data); selectNone(); setMode(null);
        renderAll(); fitView(); persist();
        toast("Project loaded.");
      }catch(e){ toast("No Atlas project in that file."); }
    };
    fr.readAsText(f);
  });
};
function normChar(c){
  return {id:c.id||uid(), name:c.name||"", role:c.role||"", description:c.description||"", image:c.image||null, from:c.from||""};
}
function normalize(d){
  var b = blank();
  b.title = d.title || b.title;
  b.subtitle = d.subtitle || "";
  b.tabTitle = d.tabTitle || "";
  b.intro = d.intro || "";
  b.map = d.map || null;
  b.frame = d.frame !== false;      // projects from before the frame existed get one
  b.boundaries = (d.boundaries||[]).map(function(x){
    // an earlier version kept one line in `points`; it is now the first of the `paths`
    var raw = x.paths || (x.points ? [x.points] : []);
    return {id:x.id||uid(), label:x.label==null?"":String(x.label), color:lineColor(x.color),
      style:(x.style==="solid"||x.style==="dotted")?x.style:"dashed",
      paths:raw.map(cleanPath).filter(Boolean)};
  });
  b.background = (d.background==="snow" || d.background==="mist") ? d.background : "magic";
  b.titleImage = d.titleImage || null;
  // older projects have factions without territory — fill in empty fields, not invented ones
  if(d.factions && d.factions.length){
    b.factions = d.factions.map(function(f){
      return {
        id:f.id||uid(), label:f.label||"Region", color:f.color||"#4e8f7e",
        area:(f.area && f.area.length>2) ? f.area.map(function(pt){ return [+pt[0]||0, +pt[1]||0]; }) : null,
        areaVisible:!!f.areaVisible,
        anchor:f.anchor ? {x:+f.anchor.x||0, y:+f.anchor.y||0} : null,
        summary:f.summary||"", description:f.description||"", image:f.image||null,
        characters:(f.characters||[]).map(normChar)
      };
    });
  }
  b.sessions = (d.sessions||[]).map(function(s,i){
    return {id:s.id||uid(), label:s.label||("Session "+(i+1)), recap:s.recap||""};
  });
  var known = {};
  b.sessions.forEach(function(s){ known[s.id]=1; });
  b.pois = (d.pois||[]).map(function(p){
    // anything held back until a session that is gone is simply shown from the start
    var chars = (p.characters||[]).map(normChar);
    chars.forEach(function(c){ if(!known[c.from]) c.from=""; });
    return {
      id:p.id||uid(), name:p.name||"", type:normType(p.type),
      factionId:p.factionId || b.factions[0].id,
      x:+p.x||0, y:+p.y||0, hidden:!!p.hidden,
      descFrom:known[p.descFrom]?p.descFrom:"", imagesFrom:known[p.imagesFrom]?p.imagesFrom:"",
      summary:p.summary||"", description:p.description||"",
      // a point used to hold a single `image`; it becomes the first of its pictures
      images:(p.images && p.images.length) ? p.images.filter(Boolean) : (p.image ? [p.image] : []),
      characters:chars
    };
  });
  return b;
}

/* ============================ map upload ============================ */
function loadMapFile(f){
  readImage(f, 2600, .84).then(function(r){
    S.map = r;
    renderMap(); fitView(); persist();
    toast("Map loaded. Now add the first point.");
  }).catch(function(e){ toast(e.message); });
}
document.getElementById("btnPickMap").onclick = function(){
  pickFile("image/*").then(function(f){ if(f) loadMapFile(f); });
};
var dz = document.getElementById("dropzone");
["dragenter","dragover"].forEach(function(ev){
  dz.addEventListener(ev, function(e){ e.preventDefault(); dz.classList.add("hot"); });
});
["dragleave","drop"].forEach(function(ev){
  dz.addEventListener(ev, function(e){ e.preventDefault(); dz.classList.remove("hot"); });
});
dz.addEventListener("drop", function(e){
  var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if(f) loadMapFile(f);
});

/* ============================ buttons ============================ */
document.getElementById("btnAddPoi").onclick = function(){
  if(!S.map) return toast("Upload a map image first.");
  setMode(mode==="poi" ? null : "poi");
  renderMap();
};
document.getElementById("zIn").onclick = function(){
  var r=vp.getBoundingClientRect(); zoomAt(r.left+r.width/2, r.top+r.height/2, 1.25);
};
document.getElementById("zOut").onclick = function(){
  var r=vp.getBoundingClientRect(); zoomAt(r.left+r.width/2, r.top+r.height/2, 1/1.25);
};
document.getElementById("zFit").onclick = fitView;
window.addEventListener("resize", function(){ if(S && S.map) applyView(); });

/* ============================ finished site template ============================ */
var VIEWER = __VIEWER__;

function esc(s){
  return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function buildSite(){
  // The whole project is packed into the file, which is what lets the finished map be
  // opened here again. Which part of it the map draws is decided in the viewer: hidden
  // points, and the content of a region without a big pin, never reach the page.
  var json = JSON.stringify(S).replace(/</g,"\\u003c").replace(/\u2028/g,"\\u2028").replace(/\u2029/g,"\\u2029");
  var pageTitle = (S.tabTitle||"").trim() || S.title || "Atlas";
  // what a chat app or a search result shows when the link is shared
  var meta = '<meta property="og:type" content="website">\n<meta property="og:title" content="'+esc(pageTitle)+'">';
  if(S.subtitle){
    meta += '\n<meta name="description" content="'+esc(S.subtitle)+'">\n<meta property="og:description" content="'+esc(S.subtitle)+'">';
  }
  return VIEWER
    .split("__PAGETITLE__").join(esc(pageTitle))
    .split("__META__").join(meta)
    .split("__TITLE__").join(esc(S.title||"Atlas"))
    .split("__SUBTITLE__").join(esc(S.subtitle||""))
    .replace("__ICONS__", JSON.stringify(ICONS))
    .replace("__TYPES__", JSON.stringify(TYPE_LABELS))
    .replace("__DATA__", json);
}

document.getElementById("btnPreview").onclick = function(){
  if(!S.map) return toast("Upload a map image first.");
  var html = buildSite();
  modal(function(sheet, close){
    sheet.appendChild(el("h3",null,"Preview of the finished site"));
    sheet.appendChild(el("p","sub","This is what the finished map shows. Hidden points are not on it, though they do travel inside the exported file."));
    var f = document.createElement("iframe");
    f.className="preview-frame"; f.setAttribute("title","Preview");
    f.srcdoc = html;
    sheet.appendChild(f);
    var acts = el("div","sheet-actions");
    var ok=el("button","tbtn","Close"); ok.onclick=close;
    acts.appendChild(ok); sheet.appendChild(acts);
  }, true);
};

document.getElementById("btnExport").onclick = function(){
  if(!S.map) return toast("Upload a map image first.");
  var html = buildSite();
  var visible = S.pois.filter(function(p){ return !p.hidden; }).length;
  var chars = S.pois.reduce(function(a,p){ return a + (p.hidden?0:p.characters.length); },0);
  var regs = S.factions.filter(function(f){ return hasArea(f) || f.anchor; }).length;
  var kept = S.pois.length - visible;
  modal(function(sheet, close){
    sheet.appendChild(el("h3",null,"Export site"));
    sheet.appendChild(el("p","sub","You get a single index.html file. The images are packed inside it, so it needs nothing else — just upload it anywhere. The project rides along in the file, so you can open it here again with “Open project”."));
    var ul = el("div");
    ul.style.cssText="border:1px solid var(--line);border-radius:3px;padding:12px 14px;margin-bottom:16px;color:var(--linen-2);line-height:1.8";
    ul.innerHTML = "Points on the map: <b>"+visible+"</b><br>Regions with territory: <b>"+regs+"</b><br>Characters in total: <b>"+chars+"</b><br>File size: <b>"+fmtSize(html.length)+"</b>";
    sheet.appendChild(ul);
    if(kept){
      // the file is meant to be handed out, so say plainly what leaves with it
      var note = el("p","sub","Hidden points packed in: "+kept+". They stay off the map, but anyone who opens the file can read them.");
      sheet.appendChild(note);
    }
    if(html.length > 12*1048576){
      var warn = el("p","sub","The file is fairly large. Consider smaller images — loading on mobile will be slow.");
      warn.style.color="var(--danger)";
      sheet.appendChild(warn);
    }
    sheet.appendChild(field("File name", input("index.html", function(v){ fname=v; })));
    var fname = "index.html";
    var acts = el("div","sheet-actions");
    var cancel = el("button","tbtn","Back"); cancel.onclick=close;
    var go = el("button","tbtn primary","Download file");
    go.onclick=function(){
      download(fname || "index.html", html, "text/html;charset=utf-8")
        .then(function(){ close(); toast("Done. Upload the file to your hosting."); })
        .catch(function(){ toast("The download failed. Try opening the editor as a local file."); });
    };
    acts.appendChild(cancel); acts.appendChild(go);
    sheet.appendChild(acts);
  });
};

/* ============================ quick tour ============================ */
/* A short walk through the editor, shown once to someone who opens it with nothing saved,
   and again whenever "Quick tour" is pressed. */
var TOUR_STEPS = [
  { title:"Make an interactive map",
    text:"Atlas turns a map image into a page you can share: places to click, the people who live there, regions, and a timeline of your campaign.",
    items:["Everything happens in this browser. Nothing is uploaded.",
           "The result is one file that works offline and on any hosting.",
           "This tour takes a minute. You can reopen it from Quick tour."] },
  { title:"1. Start with a map",
    text:"Drop a map image onto the dark area in the middle, or press Choose map image. JPG, PNG and WEBP all work.",
    items:["Scroll to zoom, drag to pan, and use fit to see the whole map again.",
           "Map settings holds the atlas name, subtitle and intro text for visitors."] },
  { title:"2. Add places",
    text:"Press Add point on the left, then click the map. Drag a point any time to move it.",
    items:["The panel on the right is where you write: Area for the description and pictures, Characters for the people there.",
           "Give a point a type and a faction to change its mark and colour.",
           "Hide a point to keep it off the exported map while you are still writing."] },
  { title:"3. Shape the world",
    text:"Everything else lives in Map settings.",
    items:["Regions: draw territory and place a big name across the land.",
           "Sessions: write a recap for each one, and hold a place's text, pictures or characters back until the session where they come up.",
           "Boundary lines: draw solid, dashed or dotted lines over the map for borders, roads or rivers. Named lines go in the legend.",
           "Border: engrave a frame onto map images that have none."] },
  { title:"4. Preview, save and share",
    text:"Preview shows what visitors will see. Export site downloads the finished map as one index.html.",
    items:["Save project downloads a file with all your content. Keep it as your backup.",
           "Open project takes that file, or an exported index.html, and you carry on where you stopped.",
           "The editor also remembers your work in this browser, but only in this browser on this computer."] }
];
function tourSeen(){ try{ return localStorage.getItem("atlas.tour")==="1"; }catch(e){ return false; } }
function tourMark(){ try{ localStorage.setItem("atlas.tour","1"); }catch(e){} }
function openTour(){
  var at = 0;
  modal(function(sheet, close){
    sheet.classList.add("tour");
    var done = function(){ tourMark(); close(); };
    function draw(){
      var st = TOUR_STEPS[at], last = at===TOUR_STEPS.length-1;
      sheet.innerHTML = "";
      sheet.appendChild(el("div","tour-step","Step "+(at+1)+" of "+TOUR_STEPS.length));
      sheet.appendChild(el("h3",null,st.title));
      sheet.appendChild(el("p","tour-lead",st.text));
      var ul = el("ul","tour-list");
      st.items.forEach(function(t){ ul.appendChild(el("li",null,t)); });
      sheet.appendChild(ul);
      var dots = el("div","tour-dots");
      TOUR_STEPS.forEach(function(x,i){
        var d = el("button", i===at ? "on" : "");
        d.setAttribute("aria-label","Step "+(i+1));
        d.onclick = function(){ at = i; draw(); };
        dots.appendChild(d);
      });
      sheet.appendChild(dots);
      var acts = el("div","sheet-actions");
      if(!last){ var skip = el("button","tbtn","Skip tour"); skip.onclick = done; acts.appendChild(skip); }
      if(at>0){ var back = el("button","tbtn","Back"); back.onclick = function(){ at--; draw(); }; acts.appendChild(back); }
      var next = el("button","tbtn primary", last ? "Start building" : "Next");
      next.onclick = last ? done : function(){ at++; draw(); };
      acts.appendChild(next);
      sheet.appendChild(acts);
      next.focus();
    }
    draw();
  });
}
document.getElementById("btnGuide").onclick = openTour;

/* ============================ start ============================ */
openDb().then(function(){ return dbGet("project"); }).then(function(saved){
  S = saved ? normalize(saved) : blank();
  renderAll();
  if(S.map) setTimeout(fitView, 30);
  // someone opening the editor for the first time gets the tour; a returning project does not
  if(!saved && !tourSeen()) setTimeout(openTour, 250);
});
