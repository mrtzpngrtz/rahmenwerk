import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { dimensions, profile } from './geometry.js';

export function geometryFromMesh(mesh) {
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(mesh.vertices.flat(),3));
  g.setIndex(mesh.faces.flat());
  const flat=g.toNonIndexed(); g.dispose(); flat.computeVertexNormals();
  return flat;
}

export class Preview {
  constructor(host) {
    this.host=host; this.color='#dedede'; this.view='corner'; this.wire=false;
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x111111,0);
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.1;
    host.append(this.renderer.domElement);
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(34,1,0.1,10000);
    this.camera.up.set(0,0,1);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true; this.controls.dampingFactor=.09;
    this.controls.maxPolarAngle=Math.PI*.94;
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x222222,2.5));
    this.sun=new THREE.DirectionalLight(0xffffff,3.2);
    this.sun.position.set(-90,-60,160); this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048); this.sun.shadow.bias=-.0004;
    this.sun.shadow.normalBias=.12;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    const fill=new THREE.DirectionalLight(0xffffff,2);fill.position.set(40,80,30);this.scene.add(fill);
    this.group=new THREE.Group();this.scene.add(this.group);
    this.ground=new THREE.Mesh(new THREE.PlaneGeometry(10000,10000),new THREE.ShadowMaterial({opacity:.12}));
    this.ground.position.z=-.15;this.ground.receiveShadow=true;this.scene.add(this.ground);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);
    this.resize();
    this.renderer.setAnimationLoop(()=>{if(!document.hidden&&host.offsetParent!==null){this.controls.update();this.renderer.render(this.scene,this.camera);}});
  }
  resize() {
    const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);
    if(this.initialized)this.home();
  }
  clear() {
    this.group.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}}});
    this.group.clear();
  }
  corner(mesh,x=0,y=0,angle=0) {
    const part=new THREE.Mesh(geometryFromMesh(mesh),new THREE.MeshStandardMaterial({color:this.color,roughness:.58,metalness:.06,wireframe:this.wire}));
    part.rotation.z=angle;part.position.set(x,y,0);part.castShadow=true;part.receiveShadow=true;this.group.add(part);
    if(!this.wire){const edges=new THREE.LineSegments(new THREE.EdgesGeometry(part.geometry,30),new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.14}));edges.rotation.copy(part.rotation);edges.position.copy(part.position);this.group.add(edges);}
  }
  line(points,color=0x777777) {
    const g=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));
    const l=new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:true,opacity:.65}));this.group.add(l);
  }
  label(text,position,size) {
    const canvas=document.createElement('canvas');canvas.width=384;canvas.height=80;
    const ctx=canvas.getContext('2d');ctx.font='400 34px Helvetica, Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#aaaaaa';ctx.fillText(text,192,40);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const m=new THREE.SpriteMaterial({map:texture,depthTest:false,toneMapped:false});const s=new THREE.Sprite(m);
    s.position.set(...position);s.scale.set(size*4.8,size,1);this.group.add(s);
  }
  dimension(a,b,text,offset,labelSize=6.5) {
    const aa=a.map((v,i)=>v+offset[i]),bb=b.map((v,i)=>v+offset[i]);
    this.line([a,aa,bb,b]);const tick=offset.map(x=>x*.10);
    for(const v of [aa,bb])this.line([v.map((x,i)=>x-tick[i]),v.map((x,i)=>x+tick[i])]);
    this.label(text,aa.map((x,i)=>(x+bb[i])/2+offset[i]*.3),labelSize);
  }
  update(mesh,p,view,reset=false) {
    const oldCenter=this.center?.clone(),oldExtent=this.extent;
    this.clear();this.view=view;this.params=p;
    const d=dimensions(p),fmt=x=>x.toLocaleString('de-DE',{maximumFractionDigits:1});
    let w=p.lengthX,h=p.lengthY;
    if(view==='frame') {
      const seat=d.root+p.slotRadius;w=p.frameWidth+2*seat;h=p.frameHeight+2*seat;
      this.corner(mesh);this.corner(mesh,w,0,Math.PI/2);this.corner(mesh,w,h,Math.PI);this.corner(mesh,0,h,-Math.PI/2);
      const layer=(z,thickness)=>{
        const m=new THREE.Mesh(new THREE.BoxGeometry(p.frameWidth,p.frameHeight,thickness),new THREE.MeshPhysicalMaterial({color:0xdddddd,transparent:true,opacity:.12,roughness:.12,metalness:.08,depthWrite:false}));
        m.position.set(w/2,h/2,z+thickness/2);m.renderOrder=2;this.group.add(m);
        const edge=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),new THREE.LineBasicMaterial({color:0xaaaaaa,transparent:true,opacity:.55}));edge.position.copy(m.position);this.group.add(edge);
      };
      // The plate's straight edge stops at the tangent of the rounded slot root.
      layer(d.plateBackZ,p.plateBack);layer(d.plateFrontZ,p.plateFront);
      const photoW=p.frameWidth*.65,photoH=Math.min(p.frameHeight*.67,photoW*1.4);
      const canvas=document.createElement('canvas');canvas.width=420;canvas.height=540;const ctx=canvas.getContext('2d');
      ctx.fillStyle='#eeeeee';ctx.fillRect(0,0,420,540);ctx.fillStyle='#272727';ctx.fillRect(25,25,370,470);ctx.fillStyle='#eeeeee';ctx.textAlign='left';ctx.font='500 54px Helvetica, Arial';ctx.fillText('Foto.',50,105);
      const photoTexture=new THREE.CanvasTexture(canvas);photoTexture.colorSpace=THREE.SRGBColorSpace;
      const artwork=new THREE.Mesh(new THREE.PlaneGeometry(photoW,photoH),new THREE.MeshBasicMaterial({map:photoTexture,side:THREE.DoubleSide,toneMapped:false}));artwork.position.set(w/2,h/2,d.plateBackZ+p.plateBack+p.photo/2);this.group.add(artwork);
      if(p.cordEnabled) {
        const u=p.cordDepth-p.cordDiameter/2,cz=d.thickness/2;
        const points=[[u,h-u,cz],[u,u,cz],[w-u,u,cz],[w-u,h-u,cz],[w/2,h+h*.17,cz],[u,h-u,cz]];
        for(let i=0;i<points.length-1;i++){
          const curve=new THREE.LineCurve3(new THREE.Vector3(...points[i]),new THREE.Vector3(...points[i+1]));
          const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,1,p.cordDiameter*.44,8,false),new THREE.MeshStandardMaterial({color:0xaaaaaa,roughness:1}));this.group.add(tube);
        }
      }
      this.dimension([seat,0,0],[seat+p.frameWidth,0,0],`${fmt(p.frameWidth)} mm`,[0,-h*.08,0],h*.095);
      this.dimension([0,seat,0],[0,seat+p.frameHeight,0],`${fmt(p.frameHeight)} mm`,[-w*.10,0,0],h*.095);
    } else {
      this.corner(mesh);
      const size=Math.max(p.lengthX,p.lengthY,d.thickness),offset=size*.15,label=size*.123;
      this.dimension([0,0,0],[p.lengthX,0,0],`${fmt(p.lengthX)} mm`,[0,-offset,0],label);
      this.dimension([0,0,0],[0,p.lengthY,0],`${fmt(p.lengthY)} mm`,[-offset,0,0],label);
    }
    this.extent=Math.max(w,h,p.lengthX,p.lengthY,d.thickness);this.center=new THREE.Vector3(w/2,h/2,d.thickness/2);
    this.camera.near=Math.max(.05,this.extent/10000);this.camera.far=this.extent*50;this.camera.updateProjectionMatrix();
    const grid=new THREE.GridHelper(this.extent*5,50,0x444444,0x2a2a2a);grid.rotation.x=Math.PI/2;grid.position.set(w/2,h/2,-.12);grid.material.transparent=true;grid.material.opacity=.32;this.group.add(grid);
    this.sun.position.set(w/2-this.extent,h/2-this.extent,this.extent*2.7);this.sun.target.position.copy(this.center);
    const sc=this.sun.shadow.camera;sc.left=sc.bottom=-this.extent*1.5;sc.right=sc.top=this.extent*1.5;sc.near=.1;sc.far=this.extent*7;sc.updateProjectionMatrix();
    if(reset||!this.initialized){this.home();this.initialized=true;}
    else if(oldCenter&&(oldExtent!==this.extent||!oldCenter.equals(this.center))){
      const offset=this.camera.position.clone().sub(oldCenter).multiplyScalar(this.extent/oldExtent);
      this.camera.position.copy(this.center).add(offset);this.controls.target.copy(this.center);
      this.controls.minDistance=this.extent*.35;this.controls.maxDistance=this.extent*8;this.controls.update();
    }
  }
  home(top=false) {
    if(!this.center)return;
    this.controls.target.copy(this.center);
    const scale=this.extent*(this.camera.aspect<1.15?1.18:1);
    const direction=top?new THREE.Vector3(0,-.0001,2.5):this.view==='frame'?new THREE.Vector3(.25,-.65,2.45):new THREE.Vector3(1.16,-1.65,1.8);
    this.camera.position.copy(this.center).addScaledVector(direction,scale);
    this.controls.minDistance=this.extent*.35;this.controls.maxDistance=this.extent*8;
    this.camera.lookAt(this.center);this.controls.update();
  }
}

export function sectionSVG(p,color) {
  const d=dimensions(p),pts=profile(p),s=Math.min(18,240/Math.max(p.width,d.thickness));
  const path=pts.map(([u,z],i)=>`${i?'L':'M'}${u*s},${(d.thickness-z)*s}`).join(' ')+' Z';
  const w=p.width*s,h=d.thickness*s,slotY=(d.thickness-p.wallBack-d.gap)*s;
  const fmt=x=>x.toLocaleString('de-DE',{maximumFractionDigits:2});
  return `<svg viewBox="-80 -60 ${w+310} ${h+170}" role="img" aria-label="Querschnitt: Plattenaufnahme ${fmt(d.gap)} Millimeter, Plattenabstand inklusive Foto ${fmt(d.separation)} Millimeter, Verbindungssteg ${fmt(d.web)} Millimeter"><defs><pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line y2="9" stroke="#ffffff" stroke-opacity=".1" stroke-width="1"/></pattern></defs><path d="${path}" fill="${color}" fill-opacity=".16" stroke="#bcbcbc" stroke-width="1"/><path d="${path}" fill="url(#hatch)"/>
  <rect x="${(d.root+p.slotRadius)*s}" y="${(d.thickness-d.plateFrontZ-p.plateFront)*s}" width="${(p.slotDepth-p.slotRadius)*s+30}" height="${p.plateFront*s}" fill="#eeeeee" fill-opacity=".5" stroke="#dddddd" stroke-width=".6"/>
  <rect x="${(d.root+p.slotRadius)*s}" y="${(d.thickness-d.plateBackZ-p.plateBack)*s}" width="${(p.slotDepth-p.slotRadius)*s+30}" height="${p.plateBack*s}" fill="#eeeeee" fill-opacity=".5" stroke="#dddddd" stroke-width=".6"/>
  <path d="M ${w+50} ${slotY}h12 M ${w+56} ${slotY}v${d.gap*s} M ${w+50} ${slotY+d.gap*s}h12" fill="none" stroke="#888888"/><text x="${w+70}" y="${slotY+d.gap*s/2+4}" fill="#dddddd" font-size="13" font-family="Helvetica, Arial, sans-serif">${fmt(d.gap)} mm</text>
  ${d.separator?`<text x="${w+70}" y="${slotY+d.gap*s/2+23}" fill="#dddddd" font-size="11" font-family="Helvetica, Arial, sans-serif">Steg: ${fmt(d.separation)} mm</text>`:''}
  <path d="M0 ${h+17}v14 M0 ${h+24}H${w} M${w} ${h+17}v14" stroke="#777777" fill="none"/><text x="${w/2}" y="${h+46}" text-anchor="middle" fill="#bcbcbc" font-size="12" font-family="Helvetica, Arial, sans-serif">${fmt(p.width)} mm Leistenbreite</text>
  <text x="0" y="-29" fill="#bcbcbc" font-size="11" font-family="Helvetica, Arial, sans-serif">AUSSEN</text><text x="${w}" y="-29" text-anchor="end" fill="#bcbcbc" font-size="11" font-family="Helvetica, Arial, sans-serif">ACRYL</text>
  ${p.cordEnabled?`<circle cx="${(p.cordDepth-p.cordDiameter/2)*s}" cy="${h/2}" r="${p.cordDiameter*s*.44}" fill="#777777" stroke="#cccccc" stroke-width="1"/><path d="M${(p.cordDepth-p.cordDiameter/2)*s} ${h/2}H-45" stroke="#888888" stroke-width=".8"/><text x="-48" y="${h/2-8}" text-anchor="middle" fill="#aaaaaa" font-size="10" font-family="Helvetica, Arial, sans-serif">Schnur</text>`:''}
  </svg>`;
}
