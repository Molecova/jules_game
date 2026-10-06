/* Pure visual profiles: no combat RNG, damage or projectile speed changes. */
(function(g){
 'use strict';
 const P={};
 const rows=[
 ['archer','깃털 화살','arrow','#37896a',23,'feather'],['venom','독빛 바늘','needle','#88a93c',25,'drops'],['crossbow','강철 쇠뇌살','bolt','#839aaa',20,'steel'],['scout','기습 화살','arrow','#b38a51',28,'dash'],['hunter','매깃 화살','feather','#bc8351',28,'feather'],['arbalest','중장 쇠뇌살','heavy','#536f8c',30,'steel'],['ranger','추적 화살','arrow','#386653',33,'sight'],['windarcher','돌풍 화살','wind','#61bcbe',30,'wind'],['ninja','별빛 화살','stararrow','#b3a9e5',34,'stars'],
 ['apprentice','마력 불씨','orb','#a282d4',8,'dots'],['acolyte','약초 잎새','leaf','#70ad60',10,'leaves'],['monk','룬 문자','rune','#679cc7',10,'runes'],['pyro','불꽃 탄환','flame','#e87436',12,'embers'],['cryo','별자리 파편','star','#ac9bdc',11,'stars'],['summoner','돌 파편','stone','#9c9379',11,'dust'],['archmage','비전 나선','arcane','#647edd',12,'spiral'],['warlock','저주 불꽃','shadow','#9c59bb',11,'smoke'],['bishop','성광 탄환','holy','#d3b044',11,'cross']
 ];
 for(const [id,name,shape,color,size,trail]of rows)P[id]={id,name,shape,color,size,trail};
 const enemy={fire:{name:'불꽃',shape:'flame',color:'#e87436',size:10,trail:'embers'},mage:{name:'마력',shape:'orb',color:'#b976c4',size:9,trail:'dots'},bow:{name:'화살',shape:'arrow',color:'#c86b58',size:24,trail:'dash'}};
 const custom={thornroot:['needle','#749448'],acornlobber:['stone','#b68955'],bellkeeper:['holy','#99ba86'],chainwraith:['rune','#a294cb'],powderimp:['stone','#c17d42'],lavaborer:['flame','#ff8a3c'],crystalmage:['star','#8acde7'],contractpriest:['shadow','#b479ca'],snowarcher:['arrow','#7da8c2'],icesprite:['needle','#88d1ee'],shroom:['leaf','#a3b849'],necro:['rune','#95b49b'],darkpriest:['shadow','#9670bc']};
 const weapons={};
 const weaponShapes={sword:'blade',greatsword:'blade',twin:'blade',dagger:'needle',mace:'hammer',hammer:'hammer',shield:'hex',tower:'hex',bow:'arrow',wand:'rune',staff:'arcane',orb:'orb',book:'book',grail:'grail',ring:'ring',tooth:'tooth',cloak:'shadow'};
 const accents={venombow:'#7fbf4a',flamebow:'#ef6b38',frostorb:'#7dcfff',firestaff:'#ef6b38',prayerbook:'#7dffa0',lifeorb:'#7dffa0',stormstaff:'#ac91ff',vampsword:'#c85f83',abysstome:'#a282d4',dragoneye:'#f5c400',eagleeye:'#d6bd68',philostone:'#f5c400'};
 for(const [i,d] of (g.V4?.ITEMS||[]).entries())weapons[d.id]={id:d.id,name:d.name,weaponShape:d.shape,shape:weaponShapes[d.shape]||'orb',color:accents[d.id]||({war:'#79d4ed',arc:'#37896a',mag:'#a282d4'})[d.cls],size:d.shape==='bow'?23+i%5:d.shape==='dagger'?22:9+i%3,trail:d.shape==='bow'?'feather':d.shape==='book'?'runes':'stars',variant:i};
 function profile(src){const item=src?.side===0&&src.card?.item;if(item&&weapons[item.id])return weapons[item.id];const id=src?.artId||src?.def?.id;if(P[id])return P[id];if(custom[id]){const [shape,color]=custom[id];return{shape,color,size:shape==='arrow'?26:10,trail:'dots'};}return enemy[src?.cls]||enemy.bow;}
 function poly(c,points){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();c.stroke();}
 function star(c,r,n=4){poly(c,Array.from({length:n*2},(_,i)=>{const a=i*Math.PI/n,rr=i%2?r*.35:r;return[Math.cos(a)*rr,Math.sin(a)*rr];}));}
 function body(c,p,time){
  const r=p.size;c.fillStyle=p.color;c.strokeStyle='#283347';c.lineWidth=1.4;
  if(['arrow','bolt','heavy','needle','feather','wind','stararrow'].includes(p.shape)){
   const heavy=p.shape==='heavy'||p.shape==='bolt',w=heavy?3:1.5;
   c.lineWidth=w;c.beginPath();c.moveTo(-r*.65,0);c.lineTo(r*.3,0);c.stroke();
   poly(c,[[r*.55,0],[r*.18,-(heavy?5:3)],[r*.23,0],[r*.18,heavy?5:3]]);
   if(p.shape!=='needle')poly(c,[[-r*.55,0],[-r*.82,-5],[-r*.4,-2],[-r*.25,0],[-r*.4,2],[-r*.82,5]]);
   if(p.shape==='wind'||p.shape==='feather'){c.strokeStyle=p.color;for(const y of [-7,7]){c.beginPath();c.moveTo(-r,y);c.quadraticCurveTo(-r*.3,y*1.8,1,y);c.stroke();}}
   if(p.shape==='stararrow'){c.save();c.translate(r*.3,0);star(c,6);c.restore();}
   if(p.weaponShape==='bow'){c.strokeStyle='#fff7df';c.lineWidth=1;c.beginPath();c.moveTo(-r*.55,-3-(p.variant%3));c.lineTo(-r*.3,0);c.lineTo(-r*.55,3+(p.variant%3));c.stroke();}
  }else if(['book','grail','ring','tooth','hex','blade','hammer'].includes(p.shape)){
   if(p.shape==='book'){poly(c,[[-r,-r*.7],[0,-r*.45],[r,-r*.7],[r,r*.6],[0,r*.8],[-r,r*.6]]);c.strokeStyle='#fff7df';c.beginPath();c.moveTo(0,-r*.4);c.lineTo(0,r*.7);c.stroke();}
   else if(p.shape==='grail'){poly(c,[[-r,-r*.7],[r,-r*.7],[r*.5,r*.1],[0,r*.4],[-r*.5,r*.1]]);c.beginPath();c.moveTo(0,r*.3);c.lineTo(0,r);c.moveTo(-r*.5,r);c.lineTo(r*.5,r);c.stroke();}
   else if(p.shape==='ring'){c.beginPath();c.arc(0,0,r*.8,0,7);c.lineWidth=3;c.stroke();c.fillStyle='#fff7df';star(c,r*.4,4);}
   else if(p.shape==='tooth'){poly(c,[[r,-r*.25],[-r,-r*.6],[-r*.4,r*.7],[r*.2,r*.2]]);}
   else if(p.shape==='hex'){poly(c,Array.from({length:6},(_,i)=>[Math.cos(i*Math.PI/3)*r,Math.sin(i*Math.PI/3)*r]));}
   else if(p.shape==='blade'){poly(c,[[r*1.4,0],[-r,-r*.35],[-r*1.2,0],[-r,r*.35]]);}
   else{poly(c,[[r*.8,-r*.65],[r*.8,r*.65],[-r*.2,r*.65],[-r*.2,-r*.65]]);c.beginPath();c.moveTo(-r*.2,0);c.lineTo(-r*1.4,0);c.stroke();}
  }else if(p.shape==='leaf'){
   c.beginPath();c.moveTo(r,0);c.quadraticCurveTo(0,-r*1.3,-r,0);c.quadraticCurveTo(0,r*1.3,r,0);c.fill();c.stroke();c.beginPath();c.moveTo(-r,0);c.lineTo(r,0);c.stroke();
  }else if(p.shape==='rune'){c.rotate(time*3);poly(c,[[r,0],[0,-r],[-r,0],[0,r]]);c.strokeStyle='#fff6db';c.beginPath();c.moveTo(-4,0);c.lineTo(0,-4);c.lineTo(4,2);c.lineTo(-2,4);c.stroke();
  }else if(p.shape==='stone'){poly(c,[[r,1],[r*.3,-r],[-r*.8,-r*.5],[-r,r*.5],[r*.2,r*.8]]);c.strokeStyle='#e3dcc4';c.beginPath();c.moveTo(-4,-3);c.lineTo(2,0);c.lineTo(5,5);c.stroke();
  }else if(p.shape==='flame'||p.shape==='shadow'){
   c.beginPath();c.moveTo(r,0);c.bezierCurveTo(r,-r,-r,-r*.5,-r*1.8,Math.sin(time*20)*3);c.quadraticCurveTo(-r*.3,r*1.3,r,0);c.fill();c.stroke();c.fillStyle=p.shape==='flame'?'#ffe899':'#e7c9ff';poly(c,[[r*.65,0],[-r*.7,-3],[-r*.15,4]]);
  }else if(p.shape==='star'||p.shape==='holy'){
   c.rotate(time*2);star(c,r,p.shape==='star'?5:4);c.fillStyle='#fff7d7';star(c,r*.45,4);
  }else{
   if(p.shape==='arcane'){c.strokeStyle=p.color;for(const a of [time*4,time*4+Math.PI]){c.beginPath();c.ellipse(0,0,r*1.5,r*.6,a,0,7);c.stroke();}}
   c.beginPath();c.arc(0,0,r*.65,0,7);c.fill();c.stroke();c.fillStyle='#fff7e7';c.beginPath();c.arc(2,-2,r*.28,0,7);c.fill();
  }
 }
 function draw(c,p,time){const s=profile(p.src),a=Math.atan2(p.tgt.py-p.y,p.tgt.px-p.x);c.save();c.translate(p.x,p.y);c.rotate(a);
  const magic=!['arrow','bolt','heavy','needle','feather','wind','stararrow'].includes(s.shape);
  for(let i=5;i>0;i--){c.globalAlpha=.07+(6-i)*.045;c.strokeStyle=s.color;c.fillStyle=s.color;const x=-i*(magic?7:9),y=Math.sin(time*10-i)* (magic?3:1);c.lineWidth=2;
   if(['stars','cross'].includes(s.trail)){c.save();c.translate(x,y);star(c,2.4);c.restore();}
   else if(['runes','leaves','dust','steel'].includes(s.trail)){c.save();c.translate(x,y);c.rotate(i+time);c.fillRect(-2,-2,4,3);c.restore();}
   else{c.beginPath();c.moveTo(x,y);c.lineTo(x+5,y);c.stroke();}}
  c.globalAlpha=1;if(magic){c.fillStyle=s.color+'25';c.beginPath();c.arc(0,0,s.size*1.5,0,7);c.fill();}body(c,s,time);c.restore();
 }
 function impact(cb,src,t){if(!src||src.range<=1)return;const s=profile(src);if(cb.fx.length<180)cb.fx.push({kind:'unitImpact',x:t.px,y:t.py,profile:s,t:0,life:.32});}
 function drawImpacts(c,cb){for(const f of cb.fx){if(f.kind!=='unitImpact')continue;const p=f.t/f.life;c.save();c.translate(f.x,f.y);c.globalAlpha=1-p;c.strokeStyle=f.profile.color;c.fillStyle=f.profile.color;c.lineWidth=2;
  for(let i=0;i<6;i++){const a=i*Math.PI/3,r=5+p*19;c.save();c.translate(Math.cos(a)*r,Math.sin(a)*r);c.rotate(a);if(['star','holy','stararrow'].includes(f.profile.shape))star(c,3);else if(f.profile.shape==='leaf'){c.beginPath();c.ellipse(0,0,4,2,.5,0,7);c.fill();}else{c.beginPath();c.moveTo(0,0);c.lineTo(5*(1-p),0);c.stroke();}c.restore();}
  c.restore();}}
 g.SHOTS4={profiles:P,weapons,profile,draw,impact,drawImpacts,body};
})(window);
