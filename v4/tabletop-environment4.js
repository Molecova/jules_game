/* A manufactured board and real tabletop props. No combat obstacles or RNG. */
import * as THREE from './vendor/three.module.min.js';

export const LOOKS = [null,
  { name:'숲의 인쇄 보드', paper:'#f5efdf', wood:'#dfc6ac', felt:'#384b3d', table:'#afa496', sky:'#47443f', light:'#fff6e9', fill:'#dde6e5', exposure:1.0 },
  { name:'폐허의 인쇄 보드', paper:'#dddcd4', wood:'#d0c5b7', felt:'#3d4746', table:'#96928d', sky:'#414443', light:'#f5f3ee', fill:'#d4e1eb', exposure:1.0 },
  { name:'황야의 인쇄 보드', paper:'#f2dab8', wood:'#e5c7a8', felt:'#594b3f', table:'#ae9680', sky:'#4a4138', light:'#fff0dc', fill:'#dce3e7', exposure:1.02 },
  { name:'설원의 인쇄 보드', paper:'#e7eeee', wood:'#d3cfc3', felt:'#405159', table:'#a1a7a5', sky:'#444c50', light:'#f3f6f6', fill:'#c7dfed', exposure:1.02 },
  { name:'밤의 인쇄 보드', paper:'#d9d8e0', wood:'#bfb5aa', felt:'#363e48', table:'#928780', sky:'#303943', light:'#fff0dc', fill:'#b9d0e6', exposure:1.04 },
];

function prism(points, height, bevel = .015) {
  const shape = new THREE.Shape(); points.forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z)); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape,{depth:Math.max(.001,height-bevel*2),bevelEnabled:bevel>0,
    bevelThickness:bevel,bevelSize:bevel,bevelSegments:3,steps:1,curveSegments:1});
  g.rotateX(-Math.PI/2); g.translate(0,-height/2+bevel,0);
  const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
  for(let i=0;i<p.count;i++) {
    if(Math.abs(n.getY(i))>.65) uv.setXY(i,p.getX(i)/3,-p.getZ(i)/3);
    else if(Math.abs(n.getX(i))>.65) uv.setXY(i,p.getZ(i)/3,p.getY(i)*2);
    else uv.setXY(i,p.getX(i)/3,p.getY(i)*2);
  }
  return g;
}
const block = (w,h,d,b=.015)=>prism([[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]],h,b);

export function createEnvironment(config, materials, low=false) {
  const {W,H,CS,ML,M}=config,root=new THREE.Group(),geometries=new Map(),owned=new Set();
  let localTextures=[],decorations=[],theme=0;
  const own=m=>{owned.add(m);return m;};
  const geo=(key,make)=>{if(!geometries.has(key))geometries.set(key,make());return geometries.get(key);};
  const xy=(x,y)=>new THREE.Vector3((x-W/2)/CS,0,(y-H/2)/CS);
  function add(g,m,x,y,z) { const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh; }
  const box=(w,h,d,m,x,y,z,b=.012)=>add(geo(`box:${w}:${h}:${d}:${b}`,()=>block(w,h,d,b)),m,x,y,z);
  function batch(g,m,transforms,shadows=true) {
    const mesh=new THREE.InstancedMesh(g,m,transforms.length),dummy=new THREE.Object3D();
    transforms.forEach((t,i)=>{dummy.position.set(...t.p);dummy.scale.set(...(t.s||[1,1,1]));dummy.rotation.set(...(t.r||[0,0,0]));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.castShadow=shadows;mesh.receiveShadow=true;root.add(mesh);return mesh;
  }
  function texture(canvas) {const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=low?1:4;localTextures.push(t);return t;}
  function clear() {root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});root.clear();owned.forEach(m=>m.dispose());owned.clear();localTextures.forEach(t=>t.dispose());localTextures=[];decorations=[];}
  function build(act) {
    clear();theme=act;const L=LOOKS[act]||LOOKS[1],BW=5,BH=6,center=xy(ML+CS*2.5,M+CS*3),width=W/CS;
    const wood=own(materials.wood(L.wood,.10));wood.roughness=.58;
    const end=own(materials.wood('#836d58',.14)),desk=own(materials.wood(L.table,.09));desk.roughness=.86;
    const felt=own(materials.fabric(L.felt)),paper=own(materials.paper(L.paper));
    const brass=own(new THREE.MeshStandardMaterial({color:'#b6a47e',metalness:.85,roughness:.29,envMapIntensity:.7}));
    const dark=own(new THREE.MeshStandardMaterial({color:'#39332c',roughness:.86}));
    // Large desk, narrow joints, and a thin felt underside rather than a floating block.
    batch(geo('desk',()=>block(18,.12,2.99,.012)),desk,[-2,-1,0,1,2].map(i=>({p:[0,-.43,i*3]})),false);
    box(width+.03,.022,H/CS+.03,felt,0,-.245,0,.006);
    box(width-.05,.18,H/CS-.05,end,0,-.14,0,.025);
    box(width-.06,.025,H/CS-.06,wood,0,-.039,0,.006);
    // A continuous card-stock insert sits flush in a routed wooden recess.
    box(BW+.025,.05,BH+.025,dark,center.x,-.029,center.z,.006);
    const sheet=box(BW,.014,BH,paper,center.x,-.007,center.z,.002);
    const p=sheet.geometry.attributes.position,n=sheet.geometry.attributes.normal,uv=sheet.geometry.attributes.uv;
    for(let i=0;i<p.count;i++) if(Math.abs(n.getY(i))>.65)uv.setXY(i,p.getX(i)/BW+.5,.5-p.getZ(i)/BH);
    const outer=.22,left=center.x-BW/2-outer,right=center.x+BW/2+outer;
    const back=center.z-BH/2-outer,front=center.z+BH/2+outer;
    for(const [key,points]of [
      ['back',[[left,back],[right,back],[right-outer,back+outer],[left+outer,back+outer]]],
      ['front',[[left,front],[left+outer,front-outer],[right-outer,front-outer],[right,front]]],
      ['left',[[left,back],[left+outer,back+outer],[left+outer,front-outer],[left,front]]],
      ['right',[[right,back],[right,front],[right-outer,front-outer],[right-outer,back+outer]]]
    ]) add(geo('miter-'+key,()=>prism(points,.10,.012)),wood,0,.007,0);
    const inlays=[];
    for(const z of [back+.055,front-.055])inlays.push({p:[center.x,.058,z],s:[BW+.25,.002,.008]});
    for(const x of [left+.055,right-.055])inlays.push({p:[x,.058,center.z],s:[.008,.002,BH+.25]});
    batch(geo('hardware',()=>new THREE.BoxGeometry(1,1,1)),brass,inlays,false);
    box((ML-18)/CS,.013,6.02,felt,xy(ML/2-2,0).x,-.007,center.z,.003);
    // Small manufacturer marks on the frame, printed rather than raised hardware.
    const label=document.createElement('canvas'),glyphSize=low?32:64;label.width=glyphSize*8;label.height=glyphSize*2;
    const c=label.getContext('2d'),glyphs='ABCDE123456';c.fillStyle='#dbcbb0';c.font=`${glyphSize*.625}px Georgia,serif`;c.textAlign='center';c.textBaseline='middle';
    for(let i=0;i<glyphs.length;i++)c.fillText(glyphs[i],(i%8+.5)*glyphSize,(Math.floor(i/8)+.5)*glyphSize);
    const labelGeometry=geo('labels',()=>{
      const entries=[],positions=[],uvs=[];
      for(let i=0;i<5;i++){entries.push(['ABCDE'[i],ML+i*CS+32,M-10]);entries.push(['ABCDE'[i],ML+i*CS+32,H-M+10]);}
      for(let i=0;i<6;i++)entries.push([String(6-i),W-9,M+i*CS+32]);
      for(const [char,x,y]of entries){const p=xy(x,y),index=glyphs.indexOf(char),u=index%8/8,v=1-Math.floor(index/8)/2,h=.10;
        for(const [dx,dz,du,dv]of [[-1,-1,0,0],[-1,1,0,-.5],[1,1,.125,-.5],[-1,-1,0,0],[1,1,.125,-.5],[1,-1,.125,0]]){positions.push(p.x+dx*h,0,p.z+dz*h);uvs.push(u+du,v+dv);}}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.computeVertexNormals();return g;
    });
    const print=add(labelGeometry,own(new THREE.MeshBasicMaterial({map:texture(label),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1})),0,.061,0);
    print.castShadow=false;
    // Full-size physical props are on the table, beyond the board's 30 squares.
    const cardCanvas=document.createElement('canvas');cardCanvas.width=192;cardCanvas.height=256;
    const cc=cardCanvas.getContext('2d');cc.fillStyle='#344c43';cc.fillRect(0,0,192,256);cc.strokeStyle='#bfa982';cc.lineWidth=2;
    cc.strokeRect(10,10,172,236);cc.strokeRect(15,15,162,226);cc.translate(96,128);cc.rotate(Math.PI/4);cc.strokeRect(-36,-36,72,72);cc.rotate(-Math.PI/4);
    cc.beginPath();cc.arc(0,0,22,0,Math.PI*2);cc.stroke();cc.fillStyle='#cbbb9c';cc.font='10px Georgia';cc.textAlign='center';cc.fillText('PAPER TOKEN',0,83);cc.fillText('FORCES',0,96);
    const cardFace=own(new THREE.MeshStandardMaterial({map:texture(cardCanvas),roughness:.89,envMapIntensity:.25}));
    const cardEdge=own(new THREE.MeshStandardMaterial({color:'#dcd6c8',roughness:.95}));
    const cardPos=xy(260,-28),cardGroup=new THREE.Group();root.add(cardGroup);cardGroup.position.set(cardPos.x,-.355,cardPos.z);cardGroup.rotation.y=-.24;
    for(let i=0;i<5;i++) {const m=box(.66,.012,.90,cardEdge,0,0,0,.003);root.remove(m);cardGroup.add(m);m.position.set(i*.007,i*.014,0);m.rotation.y=i===4?.08:0;}
    const card=add(geo('card-print',()=>new THREE.PlaneGeometry(.644,.884)),cardFace,0,0,0);root.remove(card);cardGroup.add(card);card.rotation.set(-Math.PI/2,0,.08);card.position.set(.028,.064,0);
    decorations.push({x:260,y:-28,radius:37,kind:'cards'});
    // Ivory dice have rounded edges and recessed-looking printed pips.
    const diceCanvas=document.createElement('canvas');diceCanvas.width=384;diceCanvas.height=256;
    const dc=diceCanvas.getContext('2d');dc.fillStyle='#e9e3d6';dc.fillRect(0,0,384,256);
    const cornerPips=[[32,32],[96,32],[32,96],[96,96]],diagonal=[[32,32],[96,96]];
    const faces=[[[64,64]],diagonal,[...diagonal,[64,64]],cornerPips,[...cornerPips,[64,64]],[[32,32],[32,64],[32,96],[96,32],[96,64],[96,96]]];
    faces.forEach((pips,i)=>{const ox=i%3*128,oy=Math.floor(i/3)*128;for(const [x,y]of pips){dc.fillStyle='#403b33';dc.beginPath();dc.arc(ox+x,oy+y,7,0,Math.PI*2);dc.fill();dc.fillStyle='#201d19';dc.beginPath();dc.arc(ox+x+1,oy+y+1,5,0,Math.PI*2);dc.fill();}});
    const dice=own(new THREE.MeshStandardMaterial({map:texture(diceCanvas),roughness:.31,envMapIntensity:.45}));
    function dieUV(mesh,size) {
      const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,u=mesh.geometry.attributes.uv;
      for(let i=0;i<p.count;i++) {
        let face,a,b;
        const nx=n.getX(i),ny=n.getY(i),nz=n.getZ(i);
        if(Math.abs(ny)>=Math.abs(nx)&&Math.abs(ny)>=Math.abs(nz)){face=ny>0?4:1;a=p.getX(i)/size+.5;b=.5-p.getZ(i)/size;}
        else if(Math.abs(nx)>=Math.abs(nz)){face=nx>0?2:3;a=p.getZ(i)/size+.5;b=p.getY(i)/size+.5;}
        else{face=nz>0?0:5;a=p.getX(i)/size+.5;b=p.getY(i)/size+.5;}
        u.setXY(i,(face%3+a)/3,(1-Math.floor(face/3)+b)/2);
      }
    }
    const dp=xy(144,-11),die=box(.23,.23,.23,dice,dp.x,-.255,dp.z,.025);die.rotation.y=.43;dieUV(die,.23);
    decorations.push({x:144,y:-11,radius:13,kind:'dice'});
    const dp2=xy(179,-13),die2=box(.19,.19,.19,dice,dp2.x,-.275,dp2.z,.021);die2.rotation.y=-.23;dieUV(die2,.19);
    decorations.push({x:179,y:-13,radius:11,kind:'dice'});
    // A tray at the edge of the table, with a few spare metal counters.
    const trayPos=xy(500,300),tray=box(.9,.10,1.25,wood,trayPos.x,-.32,trayPos.z,.04);
    box(.74,.008,1.09,felt,trayPos.x,-.264,trayPos.z,.015);
    const counterGeometry=geo('counter',()=>new THREE.CylinderGeometry(.11,.11,.035,40));
    batch(counterGeometry,brass,[{p:[trayPos.x-.16,-.241,trayPos.z-.19]},{p:[trayPos.x+.11,-.24,trayPos.z+.13]},{p:[trayPos.x+.12,-.205,trayPos.z+.13]}]);
    decorations.push({x:500,y:300,radius:51,kind:'counter tray'});
    return L;
  }
  return {root,build,diagnostics:()=>({theme,decorations,sharedGeometries:geometries.size,localTextures:localTextures.length,
    textureMiB:localTextures.reduce((sum,t)=>sum+t.image.width*t.image.height*4*(t.generateMipmaps?4/3:1)/1048576,0)}),
    dispose(){clear();geometries.forEach(g=>g.dispose());geometries.clear();}};
}
