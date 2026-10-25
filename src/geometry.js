import { ShapeUtils, Vector2 } from 'three';

export const DEFAULTS = Object.freeze({
  lengthX: 53, lengthY: 53, width: 10.5,
  plateFront: 2, plateBack: 2, photo: 0.2, plateSpacing: 0, clearance: 0.2,
  wallFront: 2.3, wallBack: 2.3, slotDepth: 5, slotRadius: 0.6,
  bevel: 0.4, cordEnabled: true, cordDiameter: 2.2, cordDepth: 3.6,
  frameWidth: 210, frameHeight: 297, quantity: 4, spacing: 6,
  orientation: 'flat', quality: 24,
});

export const LIMITS = {
  lengthX: [15, 1000], lengthY: [15, 1000], width: [5, 200],
  plateFront: [0.5, 250], plateBack: [0.5, 250], photo: [0, 10], plateSpacing: [0, 250], clearance: [-0.5, 1.5],
  wallFront: [0.8, 30], wallBack: [0.8, 30], slotDepth: [1, 180], slotRadius: [0, 5],
  bevel: [0, 2], cordDiameter: [0.8, 100], cordDepth: [0.5, 100],
  frameWidth: [40, 3000], frameHeight: [40, 3000], quantity: [1, 16], spacing: [2, 100], quality: [12, 64],
};

// Older saved configurations have no plateSpacing: their original geometry
// remains unchanged. Other missing fields still identify an incomplete file.
export function normalizeSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Ungültige Einstellungen.');
  const result = {};
  for (const key of Object.keys(DEFAULTS)) {
    if (key === 'plateSpacing' && !Object.hasOwn(input, key)) result[key] = 0;
    else {
      if (!Object.hasOwn(input, key)) throw new Error('Unvollständige Einstellungen.');
      result[key] = input[key];
    }
  }
  return result;
}

export function dimensions(p) {
  const separation = p.photo + p.plateSpacing;
  const stack = p.plateFront + p.plateBack + separation;
  const gap = stack + p.clearance;
  const thickness = gap + p.wallFront + p.wallBack;
  const root = p.width - p.slotDepth;
  const split = p.plateSpacing > 0;
  const backGap = p.plateBack + p.clearance / 2;
  const separator = split ? { start: p.wallBack + backGap, width: separation } : null;
  const slots = split ? [
    { start: p.wallBack, width: backGap },
    { start: separator.start + separation, width: p.plateFront + p.clearance / 2 },
  ] : [{ start: p.wallBack, width: gap }];
  // In split mode both plates sit against the integral separator. Clearance
  // belongs to the outside of each plate, leaving the intended distance fixed.
  const plateBackZ = p.wallBack + p.clearance / 2;
  const plateFrontZ = plateBackZ + p.plateBack + separation;
  return { stack, gap, thickness, root, separation, separator, slots, plateBackZ, plateFrontZ,
    web: root - (p.cordEnabled ? p.cordDepth : 0) };
}

export function validate(p) {
  const errors = [];
  for (const [key, [min,max]] of Object.entries(LIMITS)) {
    if (typeof p[key] !== 'number' || !Number.isFinite(p[key]) || p[key] < min || p[key] > max)
      errors.push(`Wert außerhalb des Bereichs: ${key} (${min}–${max}).`);
  }
  if (errors.length) return errors;
  const d = dimensions(p);
  if (p.width >= Math.min(p.lengthX, p.lengthY) - 2) errors.push('Die Schenkel müssen mindestens 2 mm länger als die Leistenbreite sein.');
  if (d.gap < 0.6) errors.push('Der Plattenschlitz muss mindestens 0,6 mm breit sein.');
  if (d.separator && d.separator.width < 0.8 - 1e-8) errors.push('Der Abstandssteg muss mindestens 0,8 mm dick sein. Plattenabstand oder Einlage erhöhen.');
  if (d.slots.some(slot => slot.width < 0.4)) errors.push('Jede einzelne Plattenaufnahme muss mindestens 0,4 mm breit sein.');
  if (d.web < 1 - 1e-8) errors.push('Zwischen Plattenschlitz und Schnurnut muss mindestens 1 mm Material bleiben. Leiste verbreitern oder Nuten verkleinern.');
  if (p.slotRadius > Math.min(...d.slots.map(slot => slot.width / 2), p.slotDepth) + 1e-8) errors.push('Die Schlitzrundung darf höchstens die halbe Breite der schmalsten Plattenaufnahme und höchstens die Einstecktiefe betragen.');
  if (p.bevel > Math.min(p.wallBack, p.wallFront, p.width / 2) - 0.1) errors.push('Die Kantenfase muss mindestens 0,1 mm kleiner als die dünnste Deckwand sein.');
  if (p.cordEnabled && p.cordDepth < p.cordDiameter / 2) errors.push('Die Schnurnut muss mindestens so tief wie der halbe Schnurdurchmesser sein.');
  if (p.cordEnabled && p.cordDiameter > d.thickness - 2 * (p.bevel + 0.8)) errors.push('Die Schnurnut ist zu breit für diese Bauteildicke. Es müssen beidseitig mindestens 0,8 mm Wand verbleiben.');
  if (!Number.isInteger(p.quantity) || !Number.isInteger(p.quality)) errors.push('Anzahl und Auflösung müssen ganze Zahlen sein.');
  if (!['flat', 'upright'].includes(p.orientation)) errors.push('Unbekannte Druckausrichtung.');
  if (typeof p.cordEnabled !== 'boolean') errors.push('Ungültige Einstellung für die Schnurnut.');
  return errors;
}

// A single closed section, swept through a mitred 90° bend. Shared vertices
// join both legs, avoiding overlapping shells or coincident boolean faces.
export function profile(p) {
  const d = dimensions(p), w = p.width, t = d.thickness;
  const r = p.slotRadius, c = p.bevel, pts = [];
  const add = (u,z) => {
    const last = pts.at(-1);
    if (!last || Math.hypot(last[0]-u,last[1]-z)>1e-8) pts.push([u,z]);
  };
  const arc = (u,z,rad,a0,a1,n) => {
    for(let i=0;i<=n;i++) { const a=a0+(a1-a0)*i/n; add(u+rad*Math.cos(a),z+rad*Math.sin(a)); }
  };
  add(c,0); add(w-c,0); add(w,c);
  for (const slot of d.slots) {
    const b = slot.start;
    add(w,b); add(d.root+r,b);
    if(r) arc(d.root+r,b+r,r,-Math.PI/2,-Math.PI,Math.ceil(p.quality/4));
    add(d.root,b+slot.width-r);
    if(r) arc(d.root+r,b+slot.width-r,r,Math.PI,Math.PI/2,Math.ceil(p.quality/4));
    add(w,b+slot.width);
  }
  add(w,t-c); add(w-c,t); add(c,t); add(0,t-c);
  if(p.cordEnabled) {
    const cr=p.cordDiameter/2, center=t/2;
    add(0,center+cr); add(p.cordDepth-cr,center+cr);
    arc(p.cordDepth-cr,center,cr,Math.PI/2,-Math.PI/2,p.quality);
    add(0,center-cr);
  }
  add(0,c);
  if(Math.hypot(pts[0][0]-pts.at(-1)[0],pts[0][1]-pts.at(-1)[1])<1e-8) pts.pop();
  return pts;
}

export function buildCorner(p) {
  const errors = validate(p);
  if(errors.length) throw new Error(errors.join(' '));
  const cross = profile(p), n=cross.length;
  const vertices = [
    ...cross.map(([u,z])=>[u,p.lengthY,z]),
    ...cross.map(([u,z])=>[u,u,z]),
    ...cross.map(([u,z])=>[p.lengthX,u,z]),
  ];
  const faces=[];
  for(let ring=0;ring<2;ring++) for(let i=0;i<n;i++) {
    const j=(i+1)%n,a=ring*n+i,b=ring*n+j,c=(ring+1)*n+j,e=(ring+1)*n+i;
    faces.push([a,b,c],[a,c,e]);
  }
  const caps=ShapeUtils.triangulateShape(cross.map(([x,y])=>new Vector2(x,y)),[]);
  for(const [a,b,c] of caps) faces.push([c,b,a],[2*n+a,2*n+b,2*n+c]);
  const mesh={vertices,faces};
  if(signedVolume(mesh)<0) faces.forEach(f=>f.reverse());
  return mesh;
}

export function signedVolume({vertices:v,faces:f}) {
  let vol=0;
  for(const [i,j,k] of f) { const a=v[i],b=v[j],c=v[k]; vol += a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]); }
  return vol/6;
}

export function printLayout(mesh,p,count=p.quantity) {
  const d=dimensions(p), cols=Math.ceil(Math.sqrt(count));
  const sx=(p.orientation==='upright'?d.thickness:p.lengthX)+p.spacing;
  const sy=p.lengthY+p.spacing;
  const vertices=[],faces=[];
  for(let i=0;i<count;i++) {
    const offset=vertices.length;
    for(const [x,y,z] of mesh.vertices) {
      const v=p.orientation==='upright'?[d.thickness-z,y,x]:[x,y,z];
      vertices.push([v[0]+(i%cols)*sx,v[1]+Math.floor(i/cols)*sy,v[2]]);
    }
    faces.push(...mesh.faces.map(f=>f.map(x=>x+offset)));
  }
  return {vertices,faces};
}

export function binarySTL(mesh) {
  const buffer=new ArrayBuffer(84+mesh.faces.length*50), dv=new DataView(buffer);
  new Uint8Array(buffer,0,80).set(new TextEncoder().encode('RAHMENWERK | units: millimetres | closed parametric corner'));
  dv.setUint32(80,mesh.faces.length,true);
  let offset=84;
  for(const f of mesh.faces) {
    const [a,b,c]=f.map(i=>mesh.vertices[i]);
    const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const len=Math.hypot(...n)||1;
    for(const value of [...n.map(x=>x/len),...a,...b,...c]) { dv.setFloat32(offset,value,true); offset+=4; }
    dv.setUint16(offset,0,true); offset+=2;
  }
  return buffer;
}
