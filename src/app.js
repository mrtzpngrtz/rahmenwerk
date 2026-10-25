import { DEFAULTS, LIMITS, dimensions, validate, normalizeSettings, buildCorner, signedVolume, printLayout, binarySTL } from './geometry.js';
import { Preview, sectionSVG } from './preview.js';

const $=s=>document.querySelector(s);
const icons={
  download:'<path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"/>',
  upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 16v4h16v-4"/>',
  save:'<path d="M5 3h12l4 4v14H3V3h2Zm2 0v6h10V3M7 21v-8h10v8"/>',
  reset:'<path d="M4 9a8 8 0 1 1 .5 7M4 3v6h6"/>',
  home:'<path d="m3 10 9-7 9 7M6 9v11h12V9M10 20v-7h4v7"/>',
  top:'<path d="M4 4h16v16H4zM8 8h8v8H8z"/>',
  mesh:'<path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 0v10m9-5-9 5-9-5m9 5v9M3 17l9-14 9 14"/>',
  check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  warning:'<path d="m12 3 10 18H2L12 3Zm0 6v5m0 3h.01"/>',
};
const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.check}</svg>`;
const updateIcons=()=>document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
let p={...DEFAULTS}, currentMesh, currentView='corner', color='#dedede', preview, valid=false, timer;
try{const saved=normalizeSettings(JSON.parse(localStorage.getItem('rahmenwerk-v1')));if(!validate(saved).length)p=saved;}catch{}

const labels={lengthX:'Horizontal',lengthY:'Vertikal',width:'Leistenbreite',plateFront:'Dicke vorne',plateBack:'Dicke hinten',photo:'Einlage',plateSpacing:'Zusatzabstand',clearance:'Passungsspiel',wallFront:'Wand vorne',wallBack:'Wand hinten',slotDepth:'Einstecktiefe',slotRadius:'Innenradius',bevel:'Fase',cordDiameter:'Schnur-Ø',cordDepth:'Nuttiefe',frameWidth:'Plattenbreite',frameHeight:'Plattenhöhe',quantity:'Anzahl',spacing:'Druckabstand',quality:'Auflösung'};
function field(key,step=0.1,{range=true,unit='mm'}={}) {
  const [min,max]=LIMITS[key];
  return `<div class="field"><div class="field-heading"><label for="${key}">${labels[key]}</label><div class="number-wrap"><input id="${key}" name="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${p[key]}" inputmode="decimal"><span>${unit}</span></div></div>${range?`<input type="range" data-range="${key}" aria-label="${labels[key]} Schieberegler" min="${min}" max="${max}" step="${step}" value="${p[key]}">`:''}</div>`;
}
const pair=(a,b)=>`<div class="inline-fields">${field(a,.1,{range:false})}${field(b,.1,{range:false})}</div>`;
function group(n,title,body,open=false) {return `<details class="setting-group"${open?' open':''}><summary><span class="section-number">0${n}</span>${title}</summary><div class="group-content">${body}</div></details>`;}
$('#settings').innerHTML=[
  group(1,'Form',field('lengthX',1)+field('lengthY',1)+field('width',.1),true),
  group(2,'Acryl',pair('plateFront','plateBack')+field('plateSpacing',.1)+pair('photo','clearance')+'<div class="computed-value"><span>Aufnahme gesamt</span><strong id="computed-gap">—</strong></div>'+field('slotDepth',.1),true),
  group(3,'Profil',pair('wallFront','wallBack')+field('slotRadius',.1)+field('bevel',.1)),
  group(4,'Schnur','<label class="toggle-label" for="cordEnabled">Schnurnut<input type="checkbox" id="cordEnabled" name="cordEnabled" '+(p.cordEnabled?'checked':'')+'></label><div id="cord-fields">'+field('cordDiameter',.1)+field('cordDepth',.1)+'</div>'),
  group(5,'Rahmen',pair('frameWidth','frameHeight')),
  group(6,'Export',field('quantity',1,{unit:'Stk.',range:false})+field('spacing',1)+'<div class="select-field"><label for="orientation">Ausrichtung</label><select id="orientation" name="orientation"><option value="flat">Flach</option><option value="upright">Hochkant</option></select></div><div class="select-field"><label for="quality">Auflösung</label><select id="quality" name="quality"><option value="12">12 Segmente</option><option value="24">24 Segmente</option><option value="48">48 Segmente</option><option value="64">64 Segmente</option></select></div>'),
].join('');
updateIcons();

function synchronize() {
  for(const [key,value] of Object.entries(p)) {
    const input=document.getElementById(key);if(input){if(input.type==='checkbox')input.checked=value;else input.value=value;}
    const range=document.querySelector(`[data-range="${key}"]`);if(range)range.value=value;
  }
  $('#cord-fields').hidden=!p.cordEnabled;
}
const format=(n,digits=1)=>n.toLocaleString('de-DE',{maximumFractionDigits:digits,minimumFractionDigits:0});
function status(message,type='ok') {
  const el=$('#status');el.hidden=type==='ok';el.className='status-line'+(type==='ok'?'':' '+type);el.innerHTML=icon(type==='ok'?'check':'warning')+'<span></span>';el.lastElementChild.textContent=message;
}
function update(resetCamera=false) {
  const errors=validate(p);valid=!errors.length;
  $('#export-button').disabled=!valid;$('#sample-button').disabled=!valid;
  $('#save-button').disabled=!valid;
  $('#cord-fields').hidden=!p.cordEnabled;
  $('.preview-panel').classList.toggle('is-invalid',!valid);
  $('#validation-error').hidden=valid;
  for(const [key,[min,max]] of Object.entries(LIMITS)){
    const input=document.getElementById(key);
    if(input)input.setAttribute('aria-invalid',String(!Number.isFinite(p[key])||p[key]<min||p[key]>max));
  }
  if(!valid){
    let message=errors[0];for(const [key,label] of Object.entries(labels))message=message.replace(key,label);
    $('#validation-error p').textContent=message;
    for(const id of ['computed-gap','stat-size','stat-slot','stat-volume','stat-web'])$('#'+id).textContent='—';
    $('#export-summary').textContent='Ungültige Maße';
    status(message,'error');return;
  }
  const d=dimensions(p);currentMesh=buildCorner(p);
  $('#computed-gap').textContent=`${format(d.gap,2)} mm`;
  $('#stat-size').innerHTML=`${format(p.lengthX)} × ${format(p.lengthY)} × ${format(d.thickness)}<span class="unit">mm</span>`;
  $('#stat-slot').innerHTML=`${format(d.gap,2)}<span class="unit">mm</span>`;
  $('#stat-volume').innerHTML=`${format(signedVolume(currentMesh)/1000,2)}<span class="unit">cm³</span>`;
  $('#stat-web').innerHTML=`${format(d.web,2)}<span class="unit">mm</span>`;
  $('#export-summary').textContent=`${p.quantity} ${p.quantity===1?'Ecke':'Ecken'} / ${p.orientation==='flat'?'Flach':'Hochkant'} / STL`;
  if(p.clearance<0)status('Passung: Übermaß.','warning');
  else if(currentView==='frame'&&(p.frameWidth+2*(d.root+p.slotRadius)<p.lengthX+p.lengthY||p.frameHeight+2*(d.root+p.slotRadius)<p.lengthX+p.lengthY))status('Ecken überlappen.','warning');
  else if(d.web<1.5)status(`Dünner Steg: ${format(d.web,2)} mm.`,'warning');
  else status('');
  $('#section-host').innerHTML=sectionSVG(p,color);
  if(preview&&currentView!=='section')preview.update(currentMesh,p,currentView,resetCamera);
  try{localStorage.setItem('rahmenwerk-v1',JSON.stringify(p));}catch{}
}

$('#settings').addEventListener('submit',e=>e.preventDefault());
$('#settings').addEventListener('input',e=>{
  const el=e.target,key=el.dataset.range||el.name;if(!key||!(key in DEFAULTS))return;
  p[key]=el.type==='checkbox'?el.checked:el.name==='orientation'?el.value:Number(el.value);
  if(el.value===''&&el.type==='number')p[key]=NaN;
  if(el.dataset.range)document.getElementById(key).value=el.value;
  else {const range=document.querySelector(`[data-range="${key}"]`);if(range)range.value=el.value;}
  $('#preset').value='custom';update();
});
$('#preset').addEventListener('change',e=>{
  p={...DEFAULTS};
  if(e.target.value==='large')Object.assign(p,{lengthX:250,lengthY:250,width:25,slotDepth:10,plateSpacing:5,frameWidth:600,frameHeight:800});
  if(e.target.value==='thick')Object.assign(p,{plateFront:3,plateBack:3});
  if(e.target.value==='original')Object.assign(p,{plateFront:1,plateBack:1,photo:0,clearance:.4,wallFront:2.3,wallBack:2.3,slotDepth:4.92,slotRadius:1.2,bevel:0});
  synchronize();update(true);
});
$('#reset-button').addEventListener('click',()=>{p={...DEFAULTS};$('#preset').value='standard';synchronize();update(true);toast('Zurückgesetzt.');});

function chooseView(view) {
  currentView=view;document.querySelectorAll('[data-view]').forEach(b=>{const selected=b.dataset.view===view;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
  $('#canvas-host').hidden=view==='section';$('#section-host').hidden=view!=='section';$('.view-tools').hidden=view==='section';
  $('#view-number').textContent={corner:'01',frame:'02',section:'03'}[view];
  $('#view-name').textContent={corner:'Ecke',frame:'Rahmen',section:'Schnitt'}[view];
  $('#load-error').hidden=!!preview||view==='section';
  preview?.resize();update(true);
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>chooseView(b.dataset.view)));
$('#home-view').addEventListener('click',()=>preview?.home());
$('#top-view').addEventListener('click',()=>preview?.home(true));
$('#wireframe').addEventListener('click',e=>{if(!preview)return;preview.wire=!preview.wire;e.currentTarget.setAttribute('aria-pressed',String(preview.wire));update();});
document.querySelectorAll('[data-color]').forEach(b=>b.addEventListener('click',()=>{
  color=b.dataset.color;if(preview)preview.color=color;
  document.querySelectorAll('[data-color]').forEach(s=>{s.classList.toggle('selected',s===b);s.setAttribute('aria-pressed',String(s===b));});update();
}));

function download(data,filename,type) {
  const url=URL.createObjectURL(new Blob([data],{type})),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function toast(message) {clearTimeout(timer);$('#toast').textContent=message;$('#toast').hidden=false;timer=setTimeout(()=>$('#toast').hidden=true,4200);}
$('#export-button').addEventListener('click',()=>{
  if(!valid)return;
  try{const model=printLayout(currentMesh,p);download(binarySTL(model),`rahmenwerk_${p.quantity}x_${p.lengthX}x${p.lengthY}_schlitz-${dimensions(p).gap.toFixed(2)}${p.plateSpacing>0?'_abstand-'+dimensions(p).separation.toFixed(2):''}mm.stl`,'model/stl');toast(`${p.quantity} ${p.quantity===1?'Ecke':'Ecken'} als STL exportiert.`);}catch(e){status('Export fehlgeschlagen: '+e.message,'error');}
});
$('#sample-button').addEventListener('click',()=>{
  if(!valid)return;
  const sample={...p,lengthX:Math.min(p.lengthX,Math.max(18,p.width+3)),lengthY:Math.min(p.lengthY,Math.max(18,p.width+3)),quantity:1};
  try{download(binarySTL(printLayout(buildCorner(sample),sample,1)),`rahmenwerk_passprobe_schlitz-${dimensions(p).gap.toFixed(2)}mm.stl`,'model/stl');toast('Passprobe exportiert.');}catch(e){status('Passprobe fehlgeschlagen: '+e.message,'error');}
});
$('#save-button').addEventListener('click',()=>{if(valid){download(JSON.stringify({generator:'rahmenwerk',version:1,settings:p},null,2),'rahmenwerk-einstellungen.json','application/json');toast('Einstellungen gespeichert.');}});
$('#import-button').addEventListener('click',()=>$('#import-file').click());
$('#import-file').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    if(file.size>50000)throw new Error('Die Datei ist zu groß.');
    const data=JSON.parse(await file.text());if(data.generator!=='rahmenwerk'||data.version!==1||!data.settings)throw new Error('Keine unterstützte Rahmenwerk-Datei.');
    const next=normalizeSettings(data.settings);
    const errors=validate(next);if(errors.length)throw new Error(errors[0]);p=next;synchronize();$('#preset').value='custom';update(true);toast('Einstellungen geladen.');
  }catch(error){toast('Datei nicht geladen: '+error.message);}finally{e.target.value='';}
});

synchronize();if(JSON.stringify(p)!==JSON.stringify(DEFAULTS))$('#preset').value='custom';
try{preview=new Preview($('#canvas-host'));}catch(e){console.error('3D-Vorschau konnte nicht gestartet werden.',e);$('#load-error').hidden=false;}
update(true);
