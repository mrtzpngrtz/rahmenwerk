import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { DEFAULTS, buildCorner, dimensions, validate, normalizeSettings, profile, signedVolume, binarySTL, printLayout } from '../src/geometry.js';

function checkSolid(m) {
  const edges=new Map();
  for(const f of m.faces) {
    const [a,b,c]=f.map(i=>m.vertices[i]);
    const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]);
    assert.ok(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-8,'non-degenerate triangle');
    for(let i=0;i<3;i++){
      const a=f[i],b=f[(i+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(',');
      const e=edges.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);
    }
  }
  assert.ok([...edges.values()].every(([count,winding])=>count===2&&winding===0),'each edge shared by two oppositely wound triangles');
  assert.equal(m.vertices.length-edges.size+m.faces.length,2,'single genus-zero closed shell');
  assert.ok(signedVolume(m)>0,'outward winding');
}

test('default corner is one closed solid with the specified dimensions',()=>{
  const m=buildCorner(DEFAULTS);checkSolid(m);
  assert.deepEqual([0,1,2].map(i=>Math.max(...m.vertices.map(v=>v[i]))),[53,53,9]);
  assert.equal(dimensions(DEFAULTS).gap,4.4);
  const d=dimensions(DEFAULTS);
  assert.ok(m.vertices.some(v=>v[2]===DEFAULTS.wallBack));
  assert.ok(m.vertices.some(v=>Math.abs(v[2]-(DEFAULTS.wallBack+d.gap))<1e-10));
});

test('zero-radius, original dimensions, asymmetric walls and limiting groove sizes remain manifold',()=>{
  const variants=[
    {bevel:0,slotRadius:0},
    {cordEnabled:false},
    {cordEnabled:false,bevel:0,slotRadius:0},
    {plateFront:1,plateBack:1,photo:0,clearance:.4,bevel:0,slotRadius:1.2,slotDepth:4.92},
    {lengthX:100,lengthY:23,wallFront:1,wallBack:4,plateFront:1,plateBack:5},
    {cordDepth:1.1},
    {slotRadius:2.2},
    {width:11.1,slotDepth:5,cordDepth:5.1},
    {width:35,lengthX:180,lengthY:180,plateFront:10,plateBack:10,slotDepth:25,cordDepth:9},
    {quantity:1,clearance:-.5,quality:64},
  ];
  for(const changes of variants)checkSolid(buildCorner({...DEFAULTS,...changes}));
});

test('sampled valid parameter combinations remain closed and consistently wound',()=>{
  let seed=5181;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  let checked=0;
  for(let i=0;i<180;i++){
    const p={...DEFAULTS,lengthX:40+rand()*100,lengthY:40+rand()*100,width:9+rand()*18,plateFront:.8+rand()*5,plateBack:.8+rand()*5,wallFront:1+rand()*4,wallBack:1+rand()*4,slotDepth:2+rand()*6,cordDepth:2+rand()*3,cordDiameter:1+rand()*2,slotRadius:rand(),bevel:rand()*.7,cordEnabled:rand()>.2,quality:12};
    if(validate(p).length)continue;checkSolid(buildCorner(p));checked++;
  }
  assert.ok(checked>90);
});

test('invalid dimensions cannot produce STL geometry',()=>{
  for(const changes of [{width:6},{slotDepth:20},{cordDiameter:8},{cordDepth:.6},{lengthX:15,width:14},{slotRadius:4},{bevel:2,wallFront:1},{plateBack:NaN},{quantity:1.4},{orientation:'bad'},{plateSpacing:-1},{plateSpacing:251},{plateFront:251},{plateSpacing:.1,photo:0},{plateSpacing:5,slotRadius:1.2}]){
    assert.ok(validate({...DEFAULTS,...changes}).length);assert.throws(()=>buildCorner({...DEFAULTS,...changes}));
  }
});

test('10 cm cord groove is closed at minimum and maximum depth; incompatible sizes are rejected',()=>{
  const p={...DEFAULTS,lengthX:250,lengthY:250,width:140,slotDepth:20,plateFront:50,plateBack:50,cordDiameter:100};
  for(const cordDepth of [50,100])checkSolid(buildCorner({...p,cordDepth}));
  for(const changes of [{cordDiameter:100.1,cordDepth:100},{cordDepth:100.1},{cordDepth:49.9},{cordDepth:100,width:110},{cordDepth:50,plateFront:2,plateBack:2}]){
    assert.ok(validate({...p,...changes}).length);
    assert.throws(()=>buildCorner({...p,...changes}));
  }
});

test('25 cm and extended limits produce closed solids with exact size and separate plate tracks',()=>{
  for(const changes of [
    {lengthX:250,lengthY:250,width:25,slotDepth:10,plateSpacing:5},
    {lengthX:1000,lengthY:1000,width:200,slotDepth:180,plateSpacing:100,plateFront:25,plateBack:25,wallFront:30,wallBack:30},
    {lengthX:479,lengthY:522,width:96.8,plateFront:100,plateBack:100,plateSpacing:35.8},
    {lengthX:250,lengthY:250,plateFront:250,plateBack:250,plateSpacing:250},
    {lengthX:250,lengthY:175,plateSpacing:20,plateFront:1,plateBack:4,slotRadius:.3},
    {plateSpacing:.8,photo:0,slotRadius:0,bevel:0,cordEnabled:false},
  ]){
    const p={...DEFAULTS,...changes},d=dimensions(p),mesh=buildCorner(p);checkSolid(mesh);
    const bounds=[0,1,2].map(axis=>Math.max(...mesh.vertices.map(v=>v[axis])));
    assert.deepEqual(bounds,[p.lengthX,p.lengthY,d.thickness]);
    assert.equal(d.slots.length,2);
    assert.ok(Math.abs(d.plateFrontZ-(d.plateBackZ+p.plateBack)-(p.plateSpacing+p.photo))<1e-10);
    assert.ok(Math.abs(d.slots[0].width+d.slots[1].width+d.separator.width-d.gap)<1e-10);
  }
});

test('separator is real material between two open slots, including the short fit sample',()=>{
  const p={...DEFAULTS,lengthX:18,lengthY:18,plateSpacing:5};
  const polygon=profile(p),d=dimensions(p);
  const inside=(x,y)=>{
    let hit=false;
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
      const a=polygon[i],b=polygon[j];
      if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;
    }
    return hit;
  };
  for(const u of [d.root+p.slotRadius+.1,p.width-.1]){
    assert.equal(inside(u,d.separator.start+d.separator.width/2),true);
    for(const slot of d.slots)assert.equal(inside(u,slot.start+slot.width/2),false);
  }
  checkSolid(buildCorner(p));
});

test('older saved settings retain their geometry and new spacing survives round trips',()=>{
  const old={...DEFAULTS,lengthX:125};delete old.plateSpacing;
  const restored=normalizeSettings(old);assert.equal(restored.plateSpacing,0);assert.equal(restored.lengthX,125);
  assert.deepEqual(buildCorner(restored),buildCorner({...DEFAULTS,lengthX:125}));
  const spaced={...DEFAULTS,plateSpacing:12,lengthX:250};
  assert.deepEqual(normalizeSettings(JSON.parse(JSON.stringify(spaced))),spaced);
  assert.throws(()=>normalizeSettings({plateSpacing:1}));
  assert.ok(validate(normalizeSettings({...spaced,plateSpacing:'12'})).length);
});

test('four copies are separated, lie on Z=0, and preserve positive volume in either orientation',()=>{
  const m=buildCorner(DEFAULTS),volume=signedVolume(m);
  for(const orientation of ['flat','upright']){
    const p={...DEFAULTS,orientation},layout=printLayout(m,p);
    assert.equal(layout.faces.length,m.faces.length*4);
    assert.ok(Math.abs(signedVolume(layout)-volume*4)<1e-7);
    assert.equal(Math.min(...layout.vertices.map(v=>v[2])),0);
    const max=[0,1,2].map(i=>Math.max(...layout.vertices.map(v=>v[i])));
    assert.deepEqual(max,orientation==='flat'?[112,112,9]:[24,112,53]);
  }
});

test('binary STL has complete facets and exports fixtures for independent mesh validation',()=>{
  mkdirSync('test-output',{recursive:true});
  for(const [name,p] of Object.entries({default:DEFAULTS,upright:{...DEFAULTS,orientation:'upright'},original:{...DEFAULTS,plateFront:1,plateBack:1,photo:0,clearance:.4,bevel:0,slotRadius:1.2,slotDepth:4.92},sample:{...DEFAULTS,lengthX:18,lengthY:18,quantity:1},no_cord:{...DEFAULTS,cordEnabled:false,slotRadius:0,bevel:0},large_spaced:{...DEFAULTS,lengthX:250,lengthY:250,width:25,slotDepth:10,plateSpacing:5},spaced_sample:{...DEFAULTS,lengthX:18,lengthY:18,plateSpacing:5,quantity:1}})){
    const mesh=printLayout(buildCorner(p),p);const buffer=binarySTL(mesh);
    assert.equal(buffer.byteLength,84+mesh.faces.length*50);
    assert.equal(new DataView(buffer).getUint32(80,true),mesh.faces.length);
    writeFileSync(`test-output/${name}.stl`,Buffer.from(buffer));
  }
});
