/* Distinct equipment silhouettes, baked by ART's existing portrait cache. */
(function(g){
 'use strict';
 const P=g.ART.PORTRAITS;
 function poly(c,pts,col){c.fillStyle=col;c.strokeStyle='#232a3b';c.lineWidth=3;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();c.stroke();}
 function line(c,pts,col='#232a3b',w=3){c.strokeStyle=col;c.lineWidth=w;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
 for(const id of g.ENEMIES4.added){const d=g.GD.MONSTERS[id],base=P[d.artBase];P[id]=c=>{
  c.save();base(c);const k=d.enemyArt,col=d.color;
  if(['guard','shield','armor'].includes(k)){poly(c,[[15,50],[46,45],[47,78],[30,95],[14,78]],k==='armor'?'#454853':col);line(c,[[30,51],[30,86]],'#eee0b0');if(k==='armor')line(c,[[19,56],[35,64],[24,75],[38,83]],'#f49a58');}
  if(k==='drum'||k==='bell'){c.fillStyle=k==='bell'?'#ccad62':col;c.strokeStyle='#232a3b';c.lineWidth=3;c.beginPath();c.ellipse(52,78,24,16,0,0,7);c.fill();c.stroke();line(c,[[24,56],[45,76]],'#debe88',5);line(c,[[81,53],[62,77]],'#debe88',5);if(k==='bell')poly(c,[[36,76],[42,48],[61,48],[69,76]],'#ccad62');}
  if(k==='coffin'){poly(c,[[15,36],[26,28],[42,37],[44,91],[15,91]],'#765b64');line(c,[[29,42],[29,76]],'#d0bb8c');line(c,[[21,52],[37,52]],'#d0bb8c');}
  if(k==='chain'){for(let i=0;i<7;i++){c.strokeStyle='#c0b9d6';c.lineWidth=4;c.beginPath();c.ellipse(19+i*9,80+Math.sin(i)*4,6,4,0,0,7);c.stroke();}}
  if(k==='bomb'||k==='acorn'){c.fillStyle=k==='bomb'?'#4d4850':'#a67646';c.strokeStyle='#232a3b';c.lineWidth=3;c.beginPath();c.arc(70,77,21,0,7);c.fill();c.stroke();line(c,[[70,57],[74,45],[82,48]],'#e5b855',4);if(k==='acorn')poly(c,[[48,71],[52,58],[83,58],[92,72]],'#77532e');}
  if(k==='root'||k==='worm'){poly(c,[[18,98],[28,70],[35,48],[52,34],[67,49],[74,75],[85,98]],col);c.fillStyle='#282d38';c.beginPath();c.ellipse(51,54,14,10,0,0,7);c.fill();for(const x of [39,50,61])poly(c,[[x,44],[x+3,55],[x+6,44]],'#f4e5c1');}
  if(k==='flag'){line(c,[[20,98],[20,15]],'#dac7a2',5);poly(c,[[21,17],[71,22],[55,35],[70,45],[21,43]],col);}
  if(k==='beast'){poly(c,[[14,39],[21,10],[38,39]],'#f2ead8');poly(c,[[64,36],[83,13],[86,47]],'#f2ead8');for(const [x,y]of [[27,52],[68,57],[42,73],[77,72]]){c.fillStyle='#526878';c.beginPath();c.arc(x,y,4,0,7);c.fill();}}
  if(k==='crystal')for(const x of [19,49,79])poly(c,[[x-10,34],[x,6],[x+9,32],[x,47]],'#9cdbeb');
  if(k==='mirror'){poly(c,[[48,22],[70,28],[80,55],[65,79],[48,76]],'#c2cbe8');line(c,[[57,28],[64,47],[53,59],[63,72]],'#ffffff');}
  if(k==='book'){poly(c,[[14,69],[37,62],[53,68],[72,62],[90,68],[89,94],[54,98],[14,93]],'#d9b9da');line(c,[[53,70],[54,96]],col);}
  if(k==='scythe'){line(c,[[80,96],[72,17]],'#aaa0ae',5);poly(c,[[73,17],[48,10],[20,27],[45,19],[72,29]],'#c0b4d9');}
  c.restore();};}
})(window);
