import * as THREE from '../v4/vendor/three.module.min.js';
import {createMaterials} from '../v4/tabletop-materials4.js';
import {createEnvironment} from '../v4/tabletop-environment4.js';
import {createStudio} from '../v4/tabletop-lighting4.js';
import {createCoins} from '../v4/tabletop-tokens4.js';
const canvas=document.getElementById('studio'),renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(1.5,devicePixelRatio));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.1,40),studio=createStudio(renderer,scene);
const CS=64,ML=96,M=22,W=438,H=428,grid={cells:Array.from({length:30},(_,i)=>({c:i%5,r:Math.floor(i/5),x:ML+(i%5+.5)*CS,y:M+(Math.floor(i/5)+.5)*CS}))};
const tiers=[null,'#cfcabd','#86c991','#7eaaea','#ad8be6','#efc33f'];for(const d of V4.UNITS)ART.TIER_BG[d.id]=tiers[d.t];
const config={W,H,CS,ML,M,grid,sprite:(id,side,kind)=>ART.token(id,side,23,4,kind||V4.DEF['unit:'+id]?.cls)},materials=await createMaterials(),board=createEnvironment(config,materials);
scene.add(board.root);const coins=createCoins(scene,config,()=>renderer.shadowMap.needsUpdate=true),context={};
const hero={id:1,uidRef:'studio-war',side:0,artId:'squire',cls:'war',range:1,px:320,py:54,castCount:{},dead:false};
const other={id:2,uidRef:'studio-arc',side:0,artId:'archer',cls:'arc',range:3,px:384,py:118,castCount:{},dead:false};
let paused=false,star=1,angle='corner',act=1,hitAt=-1,lastDraw=0,dirty=true,animationUntil=.35,lastPose='',baseFov=32;
function fitCamera(){camera.fov=2*Math.atan(Math.tan(baseFov*Math.PI/360)*Math.max(1,1.5/camera.aspect))*180/Math.PI;camera.updateProjectionMatrix();}
function theme(n){act=n;const look=board.build(n);studio.theme(look);scene.background=new THREE.Color(look.sky);renderer.toneMappingExposure=look.exposure;renderer.shadowMap.needsUpdate=true;dirty=true;}
function view(name){angle=name;dirty=true;const target=new THREE.Vector3(2.08,0,-2.0);
 if(name==='corner'){camera.position.set(3.8,3.0,-5.0);camera.fov=32;}
 if(name==='edge'){camera.position.set(4.5,1.5,-4.5);camera.fov=30;target.y=.05;}
 if(name==='overhead'){camera.position.set(2.0,5.8,-2.01);camera.fov=39;}
 baseFov=camera.fov;camera.lookAt(target);fitCamera();}
function play(name){animationUntil=coins.stats().coins.time+.7;dirty=true;document.getElementById('state').textContent={attack:'전사 공격 · 궁수 반동',cast:'마법 시전',hit:'피격 반동'}[name];
 if(name==='attack'){coins.attack(hero,other);coins.attack(other,hero);}
 if(name==='cast'){hero.castCount.demo=(hero.castCount.demo||0)+1;other.castCount.demo=(other.castCount.demo||0)+1;}
 if(name==='hit'){coins.hit(hero,other);hitAt=coins.stats().coins.time;}}
for(const button of document.querySelectorAll('[data-camera]'))button.onclick=()=>{view(button.dataset.camera);for(const b of document.querySelectorAll('[data-camera]'))b.setAttribute('aria-pressed',b===button);};
for(const button of document.querySelectorAll('[data-action]'))button.onclick=()=>play(button.dataset.action);
document.getElementById('act').onchange=e=>theme(Number(e.target.value));
document.getElementById('rank').onclick=()=>{star=star%3+1;document.getElementById('rank').textContent='성급 '+'★'.repeat(star);};
document.getElementById('pause').onclick=()=>{paused=!paused;document.getElementById('pause').setAttribute('aria-pressed',paused);};
function resize(){renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/canvas.clientHeight;fitCamera();dirty=true;}
window.addEventListener('resize',resize);theme(1);view('corner');resize();
function loop(now){requestAnimationFrame(loop);if(document.hidden||now-lastDraw<1000/30)return;lastDraw=now;
 coins.begin({context,phase:'studio',paused});const time=coins.stats().coins.time;
 coins.token(hero.px,hero.py,{artId:hero.artId,side:0,star,rot:Math.PI,entity:hero,flash:Math.max(0,.12-(time-hitAt))},23);
 coins.token(other.px,other.py,{artId:other.artId,side:0,star,rot:Math.PI,entity:other},23);coins.update();
 const pose=JSON.stringify(coins.inspect());
 if(dirty||pose!==lastPose||(!paused&&time<animationUntil)){renderer.render(scene,camera);dirty=false;lastPose=pose;}}
function framing(){return coins.inspect().map(c=>{const corners=[];for(const dx of [-1,1])for(const dz of [-1,1]){const p=new THREE.Vector3(c.position[0]+dx*c.diameter/2,c.position[1],c.position[2]+dz*c.diameter/2).project(camera);corners.push([(p.x+1)*canvas.clientWidth/2,(1-p.y)*canvas.clientHeight/2]);}return{id:c.id,left:Math.min(...corners.map(p=>p[0])),right:Math.max(...corners.map(p=>p[0])),top:Math.min(...corners.map(p=>p[1])),bottom:Math.max(...corners.map(p=>p[1])),width:canvas.clientWidth,height:canvas.clientHeight};});}
window.TABLETOP_STUDIO={play,view,theme,inspect:coins.inspect,stats:()=>({angle,act,coins:coins.stats(),studio:studio.stats(),board:board.diagnostics(),framing:framing(),triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls}),get paused(){return paused;}};
document.getElementById('state').textContent='무광 인쇄면 · 금속 테두리 · 원목 프레임';requestAnimationFrame(loop);
