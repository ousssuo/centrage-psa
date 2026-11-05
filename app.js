/* Centrage PSA : logique de l'application.
   Sections dans l'ordre : carte d'exemple, images, mesures, dessin, interaction,
   aplatir la perspective, lecture des résultats, synchronisation, démarrage. */
(function(){
'use strict';

var CARD_W=63, CARD_H=88;
var GRADES=[{g:10,f:55,b:75},{g:9,f:60,b:90},{g:8,f:65,b:90},{g:7,f:70,b:90},{g:6,f:80,b:90},{g:5,f:85,b:90}];
var LINES=[
  {k:'oL',axis:'x',set:'outer'},{k:'oR',axis:'x',set:'outer'},
  {k:'oT',axis:'y',set:'outer'},{k:'oB',axis:'y',set:'outer'},
  {k:'iL',axis:'x',set:'inner'},{k:'iR',axis:'x',set:'inner'},
  {k:'iT',axis:'y',set:'inner'},{k:'iB',axis:'y',set:'inner'}
];
var COLORS={outer:'#22D3EE',inner:'#FF3DA5'};
var DEFAULT_LINES={oL:.08,oR:.92,oT:.06,oB:.94,iL:.14,iR:.86,iT:.11,iB:.89};

var nf1=new Intl.NumberFormat('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1});
var nf2=new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
function f1(v){return nf1.format(v)}
function f2(v){return nf2.format(v)}

function newFace(){return {orig:null,edges:null,warped:false,base:null,work:null,rot:0,lines:Object.assign({},DEFAULT_LINES),defaults:Object.assign({},DEFAULT_LINES),sample:false}}
var faces={front:newFace(),back:newFace()};
var current='front';
var drag=null, sel=null, raf=0, mode='lines', SAMPLE_LINES=null, selH=null;
var view={w:0,h:0,s:1};

function $(id){return document.getElementById(id)}
var stage=$('stage'),wrap=$('wrap'),canvas=$('view'),loupe=$('loupe'),drop=$('drop'),dropTitle=$('dropTitle');
var fileIn=$('file'),swap=$('swap'),reset=$('reset'),rot=$('rot'),rotOut=$('rotOut');
var sampleNote=$('sampleNote'),readout=$('readout'),note=$('note'),tabsEl=$('tabs');
var controlsEl=$('controls'),cornerbar=$('cornerbar'),flatten=$('flatten'),unflatten=$('unflatten');
var ctx=canvas.getContext('2d'), lctx=loupe.getContext('2d');

/* ---------- Carte d'exemple (fictive) ---------- */
function rr(x,px,py,w,h,r){x.beginPath();x.moveTo(px+r,py);x.arcTo(px+w,py,px+w,py+h,r);x.arcTo(px+w,py+h,px,py+h,r);x.arcTo(px,py+h,px,py,r);x.arcTo(px,py,px+w,py,r);x.closePath()}
function makeSample(){
  var W=840,H=1100,c=document.createElement('canvas');c.width=W;c.height=H;
  var x=c.getContext('2d');
  var g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'#23302b');g.addColorStop(1,'#16201c');
  x.fillStyle=g;x.fillRect(0,0,W,H);
  var cx=105,cy=110,cw=630,ch=880;
  x.save();x.shadowColor='rgba(0,0,0,.5)';x.shadowBlur=30;x.shadowOffsetY=14;x.fillStyle='#E9B923';rr(x,cx,cy,cw,ch,24);x.fill();x.restore();
  var bg=x.createLinearGradient(cx,cy,cx+cw,cy+ch);bg.addColorStop(0,'#F4C93A');bg.addColorStop(1,'#E2AC1C');
  x.fillStyle=bg;rr(x,cx,cy,cw,ch,24);x.fill();
  var ax=cx+37,ay=cy+40,aw=cw-37-31,ah=ch-40-34;
  x.save();x.beginPath();x.rect(ax,ay,aw,ah);x.clip();
  var sg=x.createLinearGradient(0,ay,0,ay+ah);sg.addColorStop(0,'#1B2B6B');sg.addColorStop(.55,'#6B3FA0');sg.addColorStop(1,'#E8795C');
  x.fillStyle=sg;x.fillRect(ax,ay,aw,ah);
  var seed=7;function rnd(){seed=(seed*16807)%2147483647;return seed/2147483647}
  x.fillStyle='rgba(255,255,255,.8)';
  for(var i=0;i<46;i++){x.beginPath();x.arc(ax+rnd()*aw,ay+rnd()*ah*.45,1+rnd()*1.6,0,Math.PI*2);x.fill()}
  x.fillStyle='#FFD98A';x.beginPath();x.arc(ax+aw*.62,ay+ah*.52,92,0,Math.PI*2);x.fill();
  x.fillStyle='#1B1740';x.beginPath();
  x.moveTo(ax,ay+ah);x.lineTo(ax,ay+ah*.7);x.lineTo(ax+aw*.18,ay+ah*.62);x.lineTo(ax+aw*.36,ay+ah*.78);
  x.lineTo(ax+aw*.55,ay+ah*.58);x.lineTo(ax+aw*.78,ay+ah*.8);x.lineTo(ax+aw,ay+ah*.66);x.lineTo(ax+aw,ay+ah);x.closePath();x.fill();
  x.restore();
  x.strokeStyle='#5B4310';x.lineWidth=3;x.strokeRect(ax+1.5,ay+1.5,aw-3,ah-3);
  x.fillStyle='rgba(255,255,255,.55)';x.font='500 22px system-ui, sans-serif';x.textAlign='center';
  x.fillText('Carte fictive pour l’exemple',W/2,1050);
  var lines={oL:cx/W,oR:(cx+cw)/W,oT:cy/H,oB:(cy+ch)/H,iL:ax/W,iR:(ax+aw)/W,iT:ay/H,iB:(ay+ah)/H};
  return {canvas:c,lines:lines};
}

/* ---------- Images ---------- */
function makeBase(img){
  var iw=img.naturalWidth||img.width, ih=img.naturalHeight||img.height;
  var s=Math.min(1,1800/Math.max(iw,ih));
  var c=document.createElement('canvas');c.width=Math.max(1,Math.round(iw*s));c.height=Math.max(1,Math.round(ih*s));
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  return c;
}
function buildWork(f){
  var b=f.base,w=b.width,h=b.height;
  var c=f.work||document.createElement('canvas');
  c.width=w;c.height=h;
  var x=c.getContext('2d');
  x.fillStyle='#1b232b';x.fillRect(0,0,w,h);
  x.save();x.translate(w/2,h/2);x.rotate(f.rot*Math.PI/180);x.drawImage(b,-w/2,-h/2);x.restore();
  f.work=c;
}
function showNote(msg,info){note.textContent=msg;note.hidden=!msg;note.className=info?'note info':'note'}
function loadFile(file){
  if(!file||!/^image\//.test(file.type)){showNote('Ce fichier n’est pas une image. Choisis une photo en JPEG, PNG ou WebP.');return}
  showNote('');
  var url=URL.createObjectURL(file);
  var img=new Image();
  img.onload=function(){
    var f=faces[current];
    f.orig=makeBase(img);f.base=f.orig;f.warped=false;f.edges=null;f.rot=0;f.sample=false;mode='lines';
    f.lines=Object.assign({},DEFAULT_LINES);f.defaults=Object.assign({},DEFAULT_LINES);
    buildWork(f);sel=null;
    try{URL.revokeObjectURL(url)}catch(e){}
    sync();
  };
  img.onerror=function(){showNote('Impossible de lire cette image. Essaie un autre fichier.')};
  img.src=url;
}

/* ---------- Mesures ---------- */
function limTop(k){return k==='front'?55:75}
function marginOf(k){return k==='front'?1.5:3}
function stat(share,k){var L=limTop(k);return share>L?'fail':(share>L-marginOf(k)?'edge':'ok')}
function capOf(k,m){for(var i=0;i<GRADES.length;i++){var g=GRADES[i];if(m.worst<=(k==='front'?g.f:g.b))return g.g}return 0}
function faceName(k){return k==='front'?'Recto':'Verso'}
function measure(f){
  if(!f.work)return null;
  var W=f.work.width,H=f.work.height,L=f.lines;
  var bl=(L.iL-L.oL)*W,br=(L.oR-L.iR)*W,bt=(L.iT-L.oT)*H,bb=(L.oB-L.iB)*H;
  var cw=(L.oR-L.oL)*W,ch=(L.oB-L.oT)*H;
  var h=bl/(bl+br)*100,v=bt/(bt+bb)*100;
  var hw=Math.max(h,100-h),vw=Math.max(v,100-v);
  return {h:h,v:v,hw:hw,vw:vw,worst:Math.max(hw,vw),
    mmL:bl*CARD_W/cw,mmR:br*CARD_W/cw,mmT:bt*CARD_H/ch,mmB:bb*CARD_H/ch,aspect:cw/ch};
}

/* ---------- Dessin ---------- */
function srcCanvas(f){return (mode==='corners'&&f.orig)?f.orig:f.work}
function layout(){
  var f=faces[current],S=srcCanvas(f);if(!S)return;
  var availW=Math.max(200,stage.clientWidth-24);
  var maxH=Math.max(360,Math.min(window.innerHeight*.74,920));
  var s=Math.min(availW/S.width,maxH/S.height);
  view.s=s;view.w=Math.round(S.width*s);view.h=Math.round(S.height*s);
  var dpr=window.devicePixelRatio||1;
  canvas.width=Math.round(view.w*dpr);canvas.height=Math.round(view.h*dpr);
  canvas.style.width=view.w+'px';canvas.style.height=view.h+'px';
  loupe.width=Math.round(132*dpr);loupe.height=Math.round(132*dpr);
}
function pill(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function drawCorners(f){
  var dpr=window.devicePixelRatio||1,cw=view.w,ch=view.h,E=f.edges,O=f.orig;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,cw,ch);
  ctx.drawImage(O,0,0,cw,ch);
  var names={T:'Haut',R:'Droite',B:'Bas',L:'Gauche'},keys=['T','R','B','L'],big=Math.max(cw,ch)*3;
  keys.forEach(function(k){
    var a=E[k][0],b=E[k][1];
    var ax=a[0]*cw,ay=a[1]*ch,dx=b[0]*cw-ax,dy=b[1]*ch-ay,n=Math.hypot(dx,dy)||1;
    dx/=n;dy/=n;
    ctx.beginPath();ctx.moveTo(ax-dx*big,ay-dy*big);ctx.lineTo(ax+dx*big,ay+dy*big);
    ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.6)';ctx.stroke();
    ctx.lineWidth=1.2;ctx.strokeStyle=COLORS.outer;ctx.stroke();
  });
  var qn=quadFromEdges(E,O.width,O.height);
  if(qn){
    ctx.beginPath();
    qn.forEach(function(p,i){var x=p[0]*cw,y=p[1]*ch;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)});
    ctx.closePath();ctx.fillStyle='rgba(34,211,238,.10)';ctx.fill();
    qn.forEach(function(p){
      var x=p[0]*cw,y=p[1]*ch;
      ctx.beginPath();ctx.moveTo(x-9,y);ctx.lineTo(x+9,y);ctx.moveTo(x,y-9);ctx.lineTo(x,y+9);
      ctx.lineWidth=3.5;ctx.strokeStyle='rgba(0,0,0,.7)';ctx.stroke();
      ctx.lineWidth=1.6;ctx.strokeStyle=COLORS.inner;ctx.stroke();
    });
  }
  var mx=0,my=0;
  keys.forEach(function(k){E[k].forEach(function(p){mx+=p[0]*cw/8;my+=p[1]*ch/8})});
  keys.forEach(function(k){
    var a=E[k][0],b=E[k][1];
    [0,1].forEach(function(i){
      var p=E[k][i],x=p[0]*cw,y=p[1]*ch;
      var act=!!((drag&&drag.e===k&&drag.i===i)||(!drag&&selH&&selH.e===k&&selH.i===i));
      ctx.beginPath();ctx.arc(x,y,act?9:7,0,Math.PI*2);
      ctx.fillStyle=COLORS.outer;ctx.fill();
      ctx.lineWidth=act?3:2;ctx.strokeStyle=act?'#fff':'rgba(0,0,0,.75)';ctx.stroke();
    });
    var cx=(a[0]+b[0])/2*cw,cy=(a[1]+b[1])/2*ch,dx=cx-mx,dy=cy-my,n=Math.hypot(dx,dy)||1;
    var lx=Math.max(24,Math.min(cw-24,cx+dx/n*24)),ly=Math.max(10,Math.min(ch-10,cy+dy/n*24));
    ctx.font='600 13px "IBM Plex Mono",monospace';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.lineWidth=4;ctx.strokeStyle='rgba(0,0,0,.75)';ctx.strokeText(names[k],lx,ly);
    ctx.fillStyle='#fff';ctx.fillText(names[k],lx,ly);
  });
}
function draw(){
  var f=faces[current];if(!f.work)return;
  if(mode==='corners'){drawCorners(f);return}
  var dpr=window.devicePixelRatio||1,cw=view.w,ch=view.h,L=f.lines;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,cw,ch);
  ctx.drawImage(f.work,0,0,cw,ch);
  function X(v){return v*cw}
  function Y(v){return v*ch}
  ctx.fillStyle='rgba(255,61,165,.16)';
  ctx.fillRect(X(L.oL),Y(L.oT),X(L.iL)-X(L.oL),Y(L.oB)-Y(L.oT));
  ctx.fillRect(X(L.iR),Y(L.oT),X(L.oR)-X(L.iR),Y(L.oB)-Y(L.oT));
  ctx.fillRect(X(L.iL),Y(L.oT),X(L.iR)-X(L.iL),Y(L.iT)-Y(L.oT));
  ctx.fillRect(X(L.iL),Y(L.iB),X(L.iR)-X(L.iL),Y(L.oB)-Y(L.iB));
  var activeKey=drag?drag.k:sel;
  LINES.forEach(function(d){
    var v=L[d.k],col=COLORS[d.set],act=(d.k===activeKey);
    var P=d.axis==='x'?v*cw:v*ch;
    ctx.beginPath();
    if(d.axis==='x'){ctx.moveTo(P,0);ctx.lineTo(P,ch)}else{ctx.moveTo(0,P);ctx.lineTo(cw,P)}
    ctx.lineWidth=act?4:3;ctx.strokeStyle='rgba(0,0,0,.6)';ctx.stroke();
    ctx.lineWidth=act?2:1.2;ctx.strokeStyle=col;ctx.stroke();
    var t=d.set==='outer'?.3:.7;
    var gw=d.axis==='x'?12:30,gh=d.axis==='x'?30:12;
    var gx=d.axis==='x'?P-gw/2:cw*t-gw/2,gy=d.axis==='x'?ch*t-gh/2:P-gh/2;
    pill(gx,gy,gw,gh,5);ctx.fillStyle=col;ctx.fill();
    ctx.lineWidth=act?2.5:1.5;ctx.strokeStyle=act?'#fff':'rgba(0,0,0,.7)';ctx.stroke();
  });
}
function showLoupe(p){
  var f=faces[current],S=srcCanvas(f),size=132,z=(mode==='corners'?8:5),dpr=window.devicePixelRatio||1;
  var src=size/(z*view.s);
  var x0=p.x/view.s-src/2,y0=p.y/view.s-src/2;
  loupe.hidden=false;
  loupe.style.left=(p.x>view.w/2)?'8px':'auto';
  loupe.style.right=(p.x>view.w/2)?'auto':'8px';
  lctx.setTransform(dpr,0,0,dpr,0,0);
  lctx.fillStyle='#000';lctx.fillRect(0,0,size,size);
  lctx.drawImage(S,x0,y0,src,src,0,0,size,size);
  if(mode==='corners'){
    ['T','R','B','L'].forEach(function(k){
      var a=f.edges[k][0],b=f.edges[k][1];
      var ax=((a[0]*S.width-x0)/src)*size,ay=((a[1]*S.height-y0)/src)*size;
      var bx=((b[0]*S.width-x0)/src)*size,by=((b[1]*S.height-y0)/src)*size;
      var dx=bx-ax,dy=by-ay,n=Math.hypot(dx,dy)||1;dx/=n;dy/=n;
      lctx.beginPath();lctx.moveTo(ax-dx*600,ay-dy*600);lctx.lineTo(ax+dx*600,ay+dy*600);
      lctx.lineWidth=3;lctx.strokeStyle='rgba(0,0,0,.6)';lctx.stroke();
      lctx.lineWidth=1.2;lctx.strokeStyle=COLORS.outer;lctx.stroke();
    });
    lctx.beginPath();
    lctx.moveTo(size/2-7,size/2);lctx.lineTo(size/2+7,size/2);
    lctx.moveTo(size/2,size/2-7);lctx.lineTo(size/2,size/2+7);
    lctx.lineWidth=1;lctx.strokeStyle='#fff';lctx.stroke();
    return;
  }
  LINES.forEach(function(d){
    var vpx=f.lines[d.k]*(d.axis==='x'?S.width:S.height);
    var o=((vpx-(d.axis==='x'?x0:y0))/src)*size;
    if(o<0||o>size)return;
    lctx.beginPath();
    if(d.axis==='x'){lctx.moveTo(o,0);lctx.lineTo(o,size)}else{lctx.moveTo(0,o);lctx.lineTo(size,o)}
    lctx.lineWidth=3;lctx.strokeStyle='rgba(0,0,0,.6)';lctx.stroke();
    lctx.lineWidth=1.2;lctx.strokeStyle=COLORS[d.set];lctx.stroke();
  });
}
function schedule(){if(!raf){raf=requestAnimationFrame(function(){raf=0;draw();renderReadout()})}}

/* ---------- Interaction ---------- */
function pos(e){var r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}
function hit(p,touch){
  var f=faces[current],best=null,bd=touch?24:11;
  LINES.forEach(function(d){
    var v=f.lines[d.k];
    var dist=d.axis==='x'?Math.abs(p.x-v*view.w):Math.abs(p.y-v*view.h);
    if(dist<bd){bd=dist;best=d}
  });
  return best;
}
function bounds(L){
  var g=.004;
  return {
    oL:[0,L.iL-g],iL:[L.oL+g,L.iR-g],iR:[L.iL+g,L.oR-g],oR:[L.iR+g,1],
    oT:[0,L.iT-g],iT:[L.oT+g,L.iB-g],iB:[L.iT+g,L.oB-g],oB:[L.iB+g,1]
  };
}
function setLine(k,v){
  var f=faces[current],b=bounds(f.lines)[k];
  f.lines[k]=Math.max(b[0],Math.min(b[1],v));
  schedule();
}
function move(e){
  var f=faces[current];if(!f.work||!drag)return;
  var p=pos(e);
  if(mode==='corners'){
    f.edges[drag.e][drag.i]=[c01(p.x/view.w),c01(p.y/view.h)];
    schedule();showLoupe(p);return;
  }
  setLine(drag.k,drag.axis==='x'?p.x/view.w:p.y/view.h);
  showLoupe(p);
}
function endDrag(){drag=null;loupe.hidden=true;schedule()}

canvas.addEventListener('pointerdown',function(e){
  if(e.button!==undefined&&e.button!==0)return;
  var f=faces[current];if(!f.work)return;
  if(mode==='corners'){
    var hd=hitHandle(pos(e),e.pointerType==='touch');
    if(!hd)return;
    drag={e:hd.e,i:hd.i};selH={e:hd.e,i:hd.i};
    try{canvas.focus({preventScroll:true})}catch(err){}
    try{canvas.setPointerCapture(e.pointerId)}catch(err){}
    move(e);e.preventDefault();return;
  }
  var d=hit(pos(e),e.pointerType==='touch');
  if(!d)return;
  drag=d;sel=d.k;
  try{canvas.setPointerCapture(e.pointerId)}catch(err){}
  try{canvas.focus({preventScroll:true})}catch(err){}
  move(e);e.preventDefault();
});
canvas.addEventListener('pointermove',function(e){
  if(drag){move(e);return}
  if(mode==='corners'){canvas.style.cursor=hitHandle(pos(e),false)?'grab':'default';return}
  var d=hit(pos(e),false);
  canvas.style.cursor=d?(d.axis==='x'?'ew-resize':'ns-resize'):'default';
});
canvas.addEventListener('pointerup',endDrag);
canvas.addEventListener('pointercancel',endDrag);
canvas.addEventListener('keydown',function(e){
  if(!sel||mode!=='lines')return;
  var f=faces[current];if(!f.work)return;
  var d=LINES.filter(function(l){return l.k===sel})[0];
  var map={ArrowLeft:['x',-1],ArrowRight:['x',1],ArrowUp:['y',-1],ArrowDown:['y',1]};
  var m=map[e.key];if(!m||m[0]!==d.axis)return;
  e.preventDefault();
  var step=(e.shiftKey?5:1)/(d.axis==='x'?f.work.width:f.work.height);
  setLine(d.k,f.lines[d.k]+m[1]*step);
});

rot.addEventListener('input',function(){
  var f=faces[current];if(!f.base)return;
  f.rot=parseFloat(rot.value)||0;
  rotOut.textContent=f1(f.rot)+'°';
  buildWork(f);draw();renderReadout();
});
reset.addEventListener('click',function(){
  var f=faces[current];if(!f.work)return;
  f.lines=Object.assign({},f.defaults);sel=null;draw();renderReadout();
});
function pickFile(){fileIn.click()}
swap.addEventListener('click',pickFile);
$('pick').addEventListener('click',pickFile);
$('samplePick').addEventListener('click',pickFile);
fileIn.addEventListener('change',function(){
  var fl=fileIn.files&&fileIn.files[0];
  if(fl)loadFile(fl);
  fileIn.value='';
});
['dragenter','dragover'].forEach(function(n){stage.addEventListener(n,function(e){e.preventDefault();drop.classList.add('over')})});
['dragleave','drop'].forEach(function(n){stage.addEventListener(n,function(){drop.classList.remove('over')})});
stage.addEventListener('drop',function(e){
  e.preventDefault();
  var fl=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];
  if(fl)loadFile(fl);
});
document.addEventListener('paste',function(e){
  var fl=e.clipboardData&&e.clipboardData.files&&e.clipboardData.files[0];
  if(fl)loadFile(fl);
});
tabsEl.addEventListener('click',function(e){
  var b=e.target.closest('.tab');if(!b)return;
  current=b.getAttribute('data-face');sel=null;mode='lines';sync();
});
readout.addEventListener('click',function(e){
  var b=e.target.closest('[data-goto]');if(!b)return;
  current=b.getAttribute('data-goto');sel=null;mode='lines';sync();
});

/* ---------- Aplatir la perspective ---------- */
function c01(v){return Math.max(0,Math.min(1,v))}
function hitHandle(p,touch){
  var f=faces[current],best=null,bd=touch?28:16;
  ['T','R','B','L'].forEach(function(k){
    [0,1].forEach(function(i){
      var q=f.edges[k][i],d=Math.hypot(p.x-q[0]*view.w,p.y-q[1]*view.h);
      if(d<bd){bd=d;best={e:k,i:i}}
    });
  });
  return best;
}
function lineOf(e,w,h){return [e[0][0]*w,e[0][1]*h,e[1][0]*w,e[1][1]*h]}
function inter(l1,l2){
  var x1=l1[0],y1=l1[1],x2=l1[2],y2=l1[3],x3=l2[0],y3=l2[1],x4=l2[2],y4=l2[3];
  var d=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);
  if(Math.abs(d)<1e-9)return null;
  var a=x1*y2-y1*x2,b=x3*y4-y3*x4;
  return [(a*(x3-x4)-(x1-x2)*b)/d,(a*(y3-y4)-(y1-y2)*b)/d];
}
function quadFromEdges(E,w,h){
  var T=lineOf(E.T,w,h),R=lineOf(E.R,w,h),B=lineOf(E.B,w,h),L=lineOf(E.L,w,h);
  var tl=inter(T,L),tr=inter(T,R),br=inter(B,R),bl=inter(B,L);
  if(!tl||!tr||!br||!bl)return null;
  return [tl,tr,br,bl].map(function(p){return [p[0]/w,p[1]/h]});
}
function lum(sd,w,h,x,y){
  if(x<0)x=0;if(y<0)y=0;if(x>w-1.001)x=w-1.001;if(y>h-1.001)y=h-1.001;
  var x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;
  var i=(y0*w+x0)*4,j=i+4,k=i+w*4,l=k+4;
  function Y(t){return .299*sd[t]+.587*sd[t+1]+.114*sd[t+2]}
  return (Y(i)*(1-fx)+Y(j)*fx)*(1-fy)+(Y(k)*(1-fx)+Y(l)*fx)*fy;
}
function snapOffset(sd,w,h,px,py,nx,ny,tx,ty,r){
  var best=0,bs=-1,t;
  function prof(t){var s=0;for(var j=-2;j<=2;j++){s+=lum(sd,w,h,px+nx*t+tx*j*3,py+ny*t+ty*j*3)}return s/5}
  for(t=-r;t<=r;t+=.5){
    var sc=Math.abs(prof(t+1.5)-prof(t-1.5))*(1-.5*Math.abs(t)/r);
    if(sc>bs){bs=sc;best=t}
  }
  return best;
}
function snapAll(){
  var f=faces[current],O=f.orig;if(!O||!f.edges)return;
  var w=O.width,h=O.height,sd=O.getContext('2d').getImageData(0,0,w,h).data;
  var r=Math.max(6,.008*Math.max(w,h)),moved=0;
  ['T','R','B','L'].forEach(function(k){
    var a=f.edges[k][0],b=f.edges[k][1];
    var tx=(b[0]-a[0])*w,ty=(b[1]-a[1])*h,n=Math.hypot(tx,ty);
    var vertical=(k==='L'||k==='R');
    if(n<20){tx=vertical?0:1;ty=vertical?1:0;n=1}
    tx/=n;ty/=n;
    var nx=-ty,ny=tx;
    [0,1].forEach(function(i){
      var p=f.edges[k][i],px=p[0]*w,py=p[1]*h;
      var t=snapOffset(sd,w,h,px,py,nx,ny,tx,ty,r);
      f.edges[k][i]=[c01((px+nx*t)/w),c01((py+ny*t)/h)];
      if(Math.abs(t)>.5)moved++;
    });
  });
  draw();
  showNote(moved?'Points ajustés sur le contour le plus net. Vérifie à la loupe : si un point a sauté sur un autre trait, remets-le à la main.':'Aucun ajustement : les points sont déjà sur le contour le plus net.',true);
}
canvas.addEventListener('keydown',function(e){
  if(mode!=='corners'||!selH)return;
  var f=faces[current],O=f.orig;if(!O||!f.edges)return;
  var map={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  var m=map[e.key];if(!m)return;
  e.preventDefault();
  var st=e.shiftKey?5:1,pt=f.edges[selH.e][selH.i];
  pt[0]=c01(pt[0]+m[0]*st/O.width);pt[1]=c01(pt[1]+m[1]*st/O.height);
  schedule();
});
function convex(q){
  var sgn=0;
  for(var i=0;i<4;i++){
    var a=q[i],b=q[(i+1)%4],c=q[(i+2)%4];
    var cr=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
    if(cr===0)return false;
    var sg=cr>0?1:-1;
    if(sgn&&sg!==sgn)return false;
    sgn=sg;
  }
  return true;
}
function solve(A,b){
  var n=b.length,i,r,c;
  for(i=0;i<n;i++){
    var p=i;
    for(r=i+1;r<n;r++)if(Math.abs(A[r][i])>Math.abs(A[p][i]))p=r;
    if(Math.abs(A[p][i])<1e-9)return null;
    var t=A[i];A[i]=A[p];A[p]=t;
    var tb=b[i];b[i]=b[p];b[p]=tb;
    for(r=i+1;r<n;r++){
      var m=A[r][i]/A[i][i];
      for(c=i;c<n;c++)A[r][c]-=m*A[i][c];
      b[r]-=m*b[i];
    }
  }
  var x=new Array(n);
  for(i=n-1;i>=0;i--){
    var s2=b[i];
    for(c=i+1;c<n;c++)s2-=A[i][c]*x[c];
    x[i]=s2/A[i][i];
  }
  return x;
}
function enterCorners(){
  var f=faces[current];if(!f.orig)return;
  if(!f.edges)f.edges={T:[[.3,.08],[.7,.08]],R:[[.88,.3],[.88,.7]],B:[[.3,.92],[.7,.92]],L:[[.12,.3],[.12,.7]]};
  selH=null;mode='corners';sel=null;showNote('');sync();
}
function leaveCorners(){mode='lines';showNote('');sync()}
function doFlatten(){
  var f=faces[current],O=f.orig;if(!O||!f.edges)return;
  var w=O.width,h=O.height;
  var qn=quadFromEdges(f.edges,w,h);
  if(!qn||!convex(qn)){showNote('Les quatre bords ne forment pas un rectangle en perspective. Vérifie que chaque paire de points est sur le bord indiqué (Haut, Droite, Bas, Gauche) et bien écartée.');return}
  var q=qn.map(function(p){return [p[0]*w,p[1]*h]});
  var CW=760,CH=Math.round(CW*CARD_H/CARD_W),M=48,W=CW+2*M,H=CH+2*M;
  var dst=[[M,M],[M+CW,M],[M+CW,M+CH],[M,M+CH]];
  var A=[],b=[],i;
  for(i=0;i<4;i++){
    var x=dst[i][0],y=dst[i][1],u=q[i][0],v=q[i][1];
    A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);
    A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v);
  }
  var hh=solve(A,b);
  if(!hh){showNote('Calcul impossible avec ces coins. Écarte-les un peu et réessaie.');return}
  var sd=O.getContext('2d').getImageData(0,0,w,h).data;
  var out=document.createElement('canvas');out.width=W;out.height=H;
  var ox=out.getContext('2d'),od=ox.createImageData(W,H),o=od.data;
  var k=0,xx,yy,c;
  for(yy=0;yy<H;yy++){
    for(xx=0;xx<W;xx++,k+=4){
      var den=hh[6]*xx+hh[7]*yy+1;
      var uu=(hh[0]*xx+hh[1]*yy+hh[2])/den,vv=(hh[3]*xx+hh[4]*yy+hh[5])/den;
      if(!(uu>=0&&vv>=0&&uu<=w-1&&vv<=h-1)){o[k]=27;o[k+1]=35;o[k+2]=43;o[k+3]=255;continue}
      var x0=Math.floor(uu),y0=Math.floor(vv),x1=Math.min(x0+1,w-1),y1=Math.min(y0+1,h-1);
      var fx=uu-x0,fy=vv-y0;
      var i00=(y0*w+x0)*4,i10=(y0*w+x1)*4,i01=(y1*w+x0)*4,i11=(y1*w+x1)*4;
      for(c=0;c<3;c++){
        o[k+c]=(sd[i00+c]*(1-fx)+sd[i10+c]*fx)*(1-fy)+(sd[i01+c]*(1-fx)+sd[i11+c]*fx)*fy;
      }
      o[k+3]=255;
    }
  }
  ox.putImageData(od,0,0);
  var ins=.045*CW;
  var L={oL:M/W,oR:(M+CW)/W,oT:M/H,oB:(M+CH)/H,iL:(M+ins)/W,iR:(M+CW-ins)/W,iT:(M+ins)/H,iB:(M+CH-ins)/H};
  f.base=out;f.warped=true;f.rot=0;
  f.lines=L;f.defaults=Object.assign({},L);
  buildWork(f);
  mode='lines';sel=null;showNote('');sync();
}
function undoFlat(){
  var f=faces[current];if(!f.warped)return;
  f.base=f.orig;f.warped=false;f.rot=0;
  var L=f.sample?SAMPLE_LINES:DEFAULT_LINES;
  f.lines=Object.assign({},L);f.defaults=Object.assign({},L);
  buildWork(f);sel=null;sync();
}
flatten.addEventListener('click',enterCorners);
unflatten.addEventListener('click',undoFlat);
$('cancelFlat').addEventListener('click',leaveCorners);
$('applyFlat').addEventListener('click',doFlatten);
$('snapEdges').addEventListener('click',snapAll);

/* ---------- Lecture des résultats ---------- */
function renderTabs(M){
  var btns=tabsEl.querySelectorAll('.tab');
  for(var i=0;i<btns.length;i++){
    var b=btns[i],k=b.getAttribute('data-face'),m=M[k];
    b.setAttribute('aria-pressed',k===current?'true':'false');
    var dot=b.querySelector('.dot'),v=b.querySelector('.v');
    dot.className='dot'+(m?' s-'+stat(m.worst,k):'');
    v.textContent=m?f1(m.worst)+' %':'';
  }
}
function gauge(axisName,nameA,nameB,a,k,mmA,mmB){
  var st=stat(Math.max(a,100-a),k);
  var lim=limTop(k),l9=k==='front'?60:90;
  var z10l=100-lim,z10w=2*lim-100,z9l=100-l9,z9w=2*l9-100;
  return '<div class="gauge s-'+st+'">'+
    '<div class="g-head"><span class="axis">'+axisName+'</span><span class="big"><b>'+f1(a)+'</b><i>/</i><b>'+f1(100-a)+'</b></span></div>'+
    '<div class="track"><div class="band b9" style="left:'+z9l+'%;width:'+z9w+'%"></div><div class="band b10" style="left:'+z10l+'%;width:'+z10w+'%"></div><div class="mid"></div><div class="pin" style="left:'+Math.max(0,Math.min(100,a))+'%"></div></div>'+
    '<div class="g-foot"><span>'+nameA+' '+f1(mmA)+' mm</span><span>PSA 10 : '+z10l+' à '+lim+' %</span><span>'+nameB+' '+f1(mmB)+' mm</span></div>'+
  '</div>';
}
function renderReadout(){
  var M={front:measure(faces.front),back:measure(faces.back)};
  renderTabs(M);
  var ks=['front','back'].filter(function(k){return M[k]});
  if(!ks.length){readout.innerHTML='';return}

  var overall='ok';
  ks.forEach(function(k){var s=stat(M[k].worst,k);if(s==='fail')overall='fail';else if(s==='edge'&&overall!=='fail')overall='edge'});
  var cap=Math.min.apply(null,ks.map(function(k){return capOf(k,M[k])}));
  var label,title,text;
  if(overall==='ok'){label='Dans les critères';title='Centrage compatible PSA 10';text='Marge suffisante sur les faces mesurées.'}
  else if(overall==='edge'){label='Limite';title='À la limite du PSA 10';text='Sous le seuil, mais avec peu de marge. Un pixel de décalage sur une ligne peut changer le verdict : vérifie en main ou sur un scan à plat.'}
  else{label='Hors critères';title='Hors critères PSA 10';text=cap>0?'Le centrage plafonne à PSA '+cap+'.':'Le centrage est en dessous de PSA 5.'}

  var rows=['front','back'].map(function(k){
    var m=M[k];
    if(!m)return '<li class="pending">'+faceName(k)+' : pas encore mesuré, seuil '+(k==='front'?'55/45':'75/25')+' pour un 10. <button class="link" type="button" data-goto="'+k+'">Mesurer le '+(k==='front'?'recto':'verso')+'</button></li>';
    var st=stat(m.worst,k);
    return '<li><span>'+faceName(k)+(faces[k].sample?'<em>exemple</em>':'')+'</span><span class="num s-'+st+'" style="color:var(--c)">'+f1(m.worst)+' %</span><span class="thr">seuil '+limTop(k)+' %</span></li>';
  }).join('');

  var html='<section class="card verdict s-'+overall+'"><span class="tag">'+label+'</span><h2 class="v-title">'+title+'</h2><p class="v-note">'+text+'</p><ul class="faces">'+rows+'</ul></section>';

  var mc=M[current];
  if(mc){
    var warn='';
    if(Math.abs(mc.aspect/(CARD_W/CARD_H)-1)>.03){
      warn='<p class="warn">Le rectangle extérieur a un format de '+f2(mc.aspect)+' alors qu’une carte fait '+f2(CARD_W/CARD_H)+' (63 × 88 mm). Redresse la photo ou recale les bords de la carte.</p>';
    }
    var lim=limTop(current),l9=current==='front'?60:90;
    html+='<section class="card"><h3>Mesure du '+(current==='front'?'recto':'verso')+'</h3>'+
      gauge('Horizontal','Gauche','Droite',mc.h,current,mc.mmL,mc.mmR)+
      gauge('Vertical','Haut','Bas',mc.v,current,mc.mmT,mc.mmB)+
      '<div class="key"><span><i style="background:var(--zone10)"></i>Zone PSA 10 ('+(100-lim)+' à '+lim+' %)</span><span><i style="background:var(--zone9)"></i>Zone PSA 9 ('+(100-l9)+' à '+l9+' %)</span></div>'+
      warn+'</section>';
  }else{
    html+='<section class="card"><h3>Mesure du '+(current==='front'?'recto':'verso')+'</h3><p style="margin:0;color:var(--ink-2)">Ajoute la photo pour afficher les jauges de centrage.</p></section>';
  }

  var trs=GRADES.map(function(g){
    var tds=['front','back'].map(function(k){
      var l=k==='front'?g.f:g.b,m=M[k],mark='';
      if(m){mark=m.worst<=l?'<span class="m ok" aria-label="conforme">✓</span>':'<span class="m fail" aria-label="non conforme">✗</span>'}
      return '<td>'+l+'/'+(100-l)+mark+'</td>';
    }).join('');
    var isCap=(g.g===cap);
    return '<tr'+(isCap?' class="cap"':'')+'><th scope="row">PSA '+g.g+(isCap?'<span class="capt">Note max du centrage</span>':'')+'</th>'+tds+'</tr>';
  }).join('');
  html+='<section class="card"><h3>Seuils PSA</h3><div class="tbl"><table class="grades"><thead><tr><th>Note</th><th>Recto</th><th>Verso</th></tr></thead><tbody>'+trs+'</tbody></table></div>'+
    '<p class="fine">Le centrage n’est qu’un critère : coins, bords et surface comptent aussi, et PSA juge la carte en main. Une mesure sur photo reste approximative. En cas de doute, vérifie sur un scan à plat ou à la règle.</p></section>';

  readout.innerHTML=html;
}

/* ---------- Synchronisation ---------- */
function sync(){
  var f=faces[current],has=!!f.work;
  wrap.hidden=!has;drop.hidden=has;
  var corners=(mode==='corners');
  controlsEl.hidden=corners;cornerbar.hidden=!corners;
  flatten.disabled=!has;unflatten.hidden=!f.warped;
  rot.disabled=!has;reset.disabled=!has;
  rot.value=f.rot;rotOut.textContent=f1(f.rot)+'°';
  sampleNote.hidden=!(has&&f.sample);
  dropTitle.textContent=current==='front'?'Ajoute la photo du recto':'Ajoute la photo du verso';
  layout();draw();renderReadout();
}

var lastW=0;
function onResize(){
  var w=stage.clientWidth;
  if(w===lastW&&!onResize.force)return;
  lastW=w;layout();draw();
}
if(window.ResizeObserver){new ResizeObserver(function(){onResize()}).observe(stage)}
window.addEventListener('resize',function(){onResize.force=true;onResize();onResize.force=false});

/* ---------- Démarrage avec l'exemple ---------- */
(function init(){
  var s=makeSample(),f=faces.front;
  f.orig=s.canvas;f.base=s.canvas;SAMPLE_LINES=s.lines;f.sample=true;f.lines=Object.assign({},s.lines);f.defaults=Object.assign({},s.lines);
  buildWork(f);
  sync();
})();
})();

/* Mode hors connexion : enregistre le service worker (nécessite https ou localhost). */
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('sw.js').catch(function(){});
  });
}
