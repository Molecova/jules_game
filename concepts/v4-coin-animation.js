import * as THREE from '../v4/vendor/three.module.min.js';
import { createCoins } from '../v4/tabletop-tokens4.js';
import { createMaterials } from '../v4/tabletop-materials4.js';
const canvas = document.getElementById('stage'), renderer = new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(1.5,devicePixelRatio));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
const scene=new THREE.Scene();scene.background=new THREE.Color('#393830');
const camera=new THREE.OrthographicCamera(-2.05,2.05,1.1,-1.1,.1,30);camera.position.set(0,5,5);camera.lookAt(0,0,0);
scene.add(new THREE.HemisphereLight('#fff4dc','#4e4a40',2));
const light=new THREE.DirectionalLight('#fff1d3',3.2);light.position.set(-3,5,-2);light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.1,far:12});light.shadow.normalBias=.01;scene.add(light);
const fill=new THREE.DirectionalLight('#d6e6f7',1.1);fill.position.set(4,3,3);scene.add(fill);
const materials=await createMaterials(false),table=new THREE.Mesh(new THREE.BoxGeometry(12,.1,6),materials.wood('#ddd2ba',.25));table.position.y=-.053;table.receiveShadow=true;scene.add(table);
// Match the game's printed tier colors and class rims as well as its shared coin model.
const tierColors=[null,'#cfcabd','#86c991','#7eaaea','#ad8be6','#efc33f'];
for(const d of V4.UNITS)ART.TIER_BG[d.id]=tierColors[d.t];
const tokenApi=createCoins(scene,{W:244,H:174,CS:64,sprite:(id,side,kind)=>ART.token(id,side,23,2,kind||(side?'':V4.DEF['unit:'+id]?.cls))},()=>{renderer.shadowMap.needsUpdate=true;});
let star=1,cls='war',serial=0,hero,action=null,selected=false,paused=false,auto=!matchMedia('(prefers-reduced-motion: reduce)').matches&&!new URLSearchParams(location.search).has('still'),nextAction=1,autoIndex=0;
const context={},labels={place:'딱지를 내려놓고 안착',move:'살짝 들려 이동',attack:'기본 공격의 기울기·반동',cast:'시전할 때 들림과 회전',hit:'피격 반동과 짧은 빛',death:'기울어 퇴장',select:'선택한 딱지를 들어 올리기'},sequence=['place','move','attack','cast','hit','death'];
const target={id:901,uidRef:'demo-target',side:1,artId:'goblin',px:186,py:87,range:1,cls:'war',castCount:{},dead:false,rot:0};
function reset(){hero={id:++serial,uidRef:'demo-'+serial,side:0,artId:{war:'squire',arc:'archer',mag:'apprentice'}[cls],cls,range:cls==='war'?1:3,px:74,py:87,dead:false,moving:null,rot:0,castCount:{}};selected=false;action=null;}
function play(name){if(!hero||hero.dead)reset();const t=tokenApi.stats().coins.time;action={name,at:t};selected=false;document.getElementById('state').textContent=labels[name];
 if(name==='place')reset();if(name==='attack')tokenApi.attack(hero,target);if(name==='hit'){tokenApi.hit(hero,target);hero.flash=.12;}if(name==='cast')hero.castCount.demo=(hero.castCount.demo||0)+1;if(name==='death'){hero.dead=true;tokenApi.death(hero,target);}if(name==='select')selected=true;
}
reset();
for(const b of document.querySelectorAll('[data-class]'))b.onclick=()=>{cls=b.dataset.class;for(const n of document.querySelectorAll('[data-class]'))n.setAttribute('aria-pressed',n===b);reset();};
for(const b of document.querySelectorAll('[data-action]'))b.onclick=()=>{auto=false;document.getElementById('auto').setAttribute('aria-pressed',false);play(b.dataset.action);};
document.getElementById('auto').onclick=()=>{auto=!auto;document.getElementById('auto').setAttribute('aria-pressed',auto);nextAction=tokenApi.stats().coins.time+.3;};
document.getElementById('pause').onclick=()=>{paused=!paused;document.getElementById('pause').setAttribute('aria-pressed',paused);};
document.getElementById('rank').onclick=()=>{star=star%3+1;document.getElementById('rank').textContent='성급 '+'★'.repeat(star);};
document.getElementById('auto').setAttribute('aria-pressed',auto);document.getElementById('state').textContent='직업과 움직임을 선택하세요';
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.left=-1.1*w/h;camera.right=1.1*w/h;camera.updateProjectionMatrix();}window.addEventListener('resize',resize);resize();
let lastDraw=0;
function loop(now){requestAnimationFrame(loop);if(document.hidden||now-lastDraw<1000/30)return;lastDraw=now;
 tokenApi.begin({context,phase:'demo',paused,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});const t=tokenApi.stats().coins.time;
 if(auto&&t>=nextAction){play(sequence[autoIndex++%sequence.length]);nextAction=t+1.25;}
 if(action?.name==='move'){const k=Math.min(1,(t-action.at)/.65),ease=k*k*(3-2*k);hero.px=74+35*ease;hero.moving=k<1?{fx:74,fy:87,tx:109,ty:87,t:k}:null;}else hero.moving=null;
 if(hero.flash&&!paused)hero.flash=Math.max(0,.12-(t-(action?.at||0)));
 if(!hero.dead)tokenApi.token(hero.px,hero.py,{artId:hero.artId,side:0,star,entity:hero,lift:selected?9:hero.moving?Math.sin(hero.moving.t*Math.PI)*5:0,flash:hero.flash},23);
 tokenApi.token(target.px,target.py,{artId:target.artId,side:1,entity:target},23);tokenApi.update();renderer.render(scene,camera);
}
window.COIN_DEMO={play,inspect:tokenApi.inspect,stats:tokenApi.stats,get paused(){return paused;},get subject(){return hero.uidRef;}};requestAnimationFrame(loop);
