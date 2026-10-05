/* 선택 시트의 종이 보드게임 장면. 320 × 140 논리 좌표, 외부 리소스·난수 없음. */
(function (global) {
  'use strict';
  const INK = '#232a3b', PAPER = '#fff8e8', WOOD = '#a77549', GOLD = '#efc45a';

  function fill(c, color, width = 2.5) {
    c.fillStyle = color; c.fill(); c.strokeStyle = INK; c.lineWidth = width;
    c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke();
  }
  function polygon(c, points, color, width) {
    c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.closePath(); fill(c, color, width);
  }
  function line(c, points, color = INK, width = 2.5) {
    c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
  }
  function box(c, x, y, w, h, color, r = 3) {
    c.beginPath(); c.roundRect(x, y, w, h, r); fill(c, color);
  }
  function oval(c, x, y, rx, ry, color, width = 2.5) {
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); fill(c, color, width);
  }
  function dots(c, color = '#232a3b14') {
    c.fillStyle = color;
    for (let y = 5; y < 140; y += 9) for (let x = 4 + ((y / 9 | 0) % 2) * 4; x < 320; x += 10) {
      c.beginPath(); c.arc(x, y, .65 + (y > 94 ? .35 : 0), 0, Math.PI * 2); c.fill();
    }
  }
  function shadow(c, x, y, rx = 25, ry = 5) {
    c.fillStyle = '#232a3b1c'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill();
  }
  function sparkle(c, x, y, r = 6, color = GOLD) {
    polygon(c, [[x, y-r], [x+2, y-2], [x+r, y], [x+2, y+2], [x, y+r], [x-2, y+2], [x-r, y], [x-2, y-2]], color, 2);
  }
  function moon(c, x, y, color = '#f1d994') {
    oval(c, x, y, 13, 13, color); line(c, [[x-5,y+3],[x-2,y+6]], '#c2a967', 2);
  }
  function tree(c, x, y, scale = 1, color = '#779177') {
    c.save(); c.translate(x, y); c.scale(scale, scale);
    box(c, -3, -29, 7, 33, '#a27c59');
    polygon(c, [[0,-81],[-22,-40],[-11,-42],[-29,-18],[28,-18],[11,-42],[21,-40]], color);
    line(c, [[0,-53],[0,-22]], '#232a3b38', 2); c.restore();
  }
  function stone(c, x, y, w = 18, color = '#a5aaa2') {
    polygon(c, [[x-w/2,y],[x-w*.35,y-9],[x+w*.2,y-12],[x+w/2,y-3],[x+w*.4,y+3],[x-w*.3,y+4]], color);
  }
  function flame(c, x, y, scale = 1, color = '#e87c42') {
    c.save(); c.translate(x,y); c.scale(scale,scale);
    c.beginPath(); c.moveTo(0,5); c.bezierCurveTo(-24,3,-19,-18,-8,-27);
    c.quadraticCurveTo(-8,-16,-1,-18); c.quadraticCurveTo(10,-30,3,-43);
    c.bezierCurveTo(27,-23,22,1,0,5); fill(c,color);
    c.beginPath(); c.moveTo(0,3); c.quadraticCurveTo(-10,-6,0,-18); c.quadraticCurveTo(13,-4,0,3); fill(c,'#ffdf80',2); c.restore();
  }
  function lantern(c,x,y) {
    line(c,[[x,y-22],[x,y-12]]); box(c,x-8,y-10,16,22,'#f3cc72');
    polygon(c,[[x-11,y-10],[x-6,y-16],[x+6,y-16],[x+11,y-10]],'#72898a');
    line(c,[[x,y-5],[x,y+7]],'#fff3be',3); line(c,[[x-10,y+13],[x+10,y+13]]);
  }
  function sword(c,x,y,angle=0,scale=1) {
    c.save(); c.translate(x,y); c.rotate(angle); c.scale(scale,scale);
    polygon(c,[[-4,-9],[-4,-42],[0,-50],[4,-42],[4,-9]],'#c1d2dc');
    line(c,[[0,-42],[0,-15]],PAPER,2); box(c,-12,-10,24,5,GOLD,1);
    box(c,-3,-4,6,16,'#96624d',1); oval(c,0,14,4,3,GOLD,2); c.restore();
  }
  function shield(c,x,y,color='#537b8a',scale=1) {
    c.save(); c.translate(x,y); c.scale(scale,scale);
    polygon(c,[[-18,-21],[0,-26],[18,-21],[16,5],[0,18],[-16,5]],color);
    line(c,[[0,-17],[0,8]],GOLD,3); line(c,[[-9,-5],[9,-5]],GOLD,3); c.restore();
  }
  function book(c,x,y,color='#a66f70',angle=0) {
    c.save(); c.translate(x,y); c.rotate(angle); box(c,-16,-10,32,20,PAPER,2);
    box(c,-17,-14,34,19,color,2); line(c,[[-10,-11],[-10,3]],'#232a3b55',2);
    polygon(c,[[2,-10],[7,-5],[2,0],[-3,-5]],GOLD,2); c.restore();
  }
  function scroll(c,x,y,angle=0) {
    c.save(); c.translate(x,y); c.rotate(angle); box(c,-14,-17,28,35,PAPER,1);
    box(c,-17,-20,34,7,'#e8d5a9',3); box(c,-17,15,34,7,'#e8d5a9',3);
    line(c,[[-7,-7],[7,-7]],'#918675',2); line(c,[[-7,0],[4,0]],'#918675',2);
    oval(c,5,10,4,4,'#b76559',2); c.restore();
  }
  function coins(c,x,y,n=3) {
    for(let i=0;i<n;i++) { oval(c,x+(i%3)*10,y-Math.floor(i/3)*5,7,3,GOLD,2); }
  }
  function chest(c,x,y,open=false,color=WOOD) {
    c.save(); c.translate(x,y); shadow(c,0,8,33,5);
    if(open) { polygon(c,[[-30,-17],[-25,-42],[24,-42],[30,-17]],'#d7a45e'); polygon(c,[[-23,-21],[-20,-35],[19,-35],[23,-21]],'#6d5350'); }
    else { c.beginPath(); c.moveTo(-30,-10); c.lineTo(-30,-20); c.quadraticCurveTo(0,-40,30,-20); c.lineTo(30,-10); c.closePath(); fill(c,color); }
    box(c,-30,-16,60,24,color,2); box(c,-22,-16,6,24,'#d9b663',1); box(c,16,-16,6,24,'#d9b663',1);
    box(c,-5,-15,10,12,GOLD,1); oval(c,0,-9,1.4,1.8,INK,1); c.restore();
  }
  function person(c,x,y,{color='#6b8772',hood=false,helmet=false,hat=false,beard=false,arm=false,scale=1}={}) {
    c.save(); c.translate(x,y); c.scale(scale,scale); shadow(c,0,3,22,4);
    polygon(c,[[-15,-7],[-13,-38],[-7,-44],[8,-44],[15,-36],[19,-7]],color);
    line(c,[[-6,-8],[-8,1]]); line(c,[[8,-8],[10,1]]);
    oval(c,0,-52,12,13,'#f0c9a0');
    if(hood) { c.beginPath(); c.moveTo(-13,-41); c.bezierCurveTo(-27,-72,13,-84,17,-49); c.lineTo(12,-37); c.lineTo(9,-55); c.quadraticCurveTo(-2,-71,-11,-53); c.closePath(); fill(c,color); }
    if(helmet) { c.beginPath(); c.arc(0,-55,14,Math.PI,0); c.closePath(); fill(c,'#a9becb'); box(c,-16,-55,32,4,'#c7d6db',2); }
    if(hat) polygon(c,[[-19,-57],[-12,-63],[-11,-76],[9,-74],[13,-63],[20,-60]],color);
    oval(c,-4,-51,1.2,1.5,INK,1); oval(c,5,-51,1.2,1.5,INK,1);
    if(beard) polygon(c,[[-10,-45],[0,-25],[11,-46],[0,-41]],'#eee3cb',2);
    else line(c,[[-2,-44],[3,-44]],INK,2);
    line(c,[[-14,-32],[-22,-20]],INK,3); oval(c,-22,-20,4,4,'#f0c9a0',2);
    line(c,[[13,-32],[arm?29:21,arm?-44:-19]],INK,3); oval(c,arm?29:21,arm?-44:-19,4,4,'#f0c9a0',2);
    c.restore();
  }
  function stall(c,color='#7c759c') {
    box(c,63,48,6,75,WOOD); box(c,250,48,6,75,WOOD);
    polygon(c,[[48,47],[79,18],[238,18],[271,47]],color);
    for(let i=0;i<6;i++) polygon(c,[[79+i*26.5,18],[92+i*26.5,18],[70+i*32,47],[54+i*32,47]],i%2?PAPER:color,2);
    box(c,49,46,221,10,color,3); box(c,74,97,172,25,WOOD,2);
    line(c,[[84,109],[235,109]],'#cfa574',2);
  }
  function ruin(c,color='#b6b4a9') {
    box(c,31,49,27,66,color); box(c,261,31,26,86,color);
    box(c,24,43,42,10,'#d1c9b7'); box(c,254,25,40,10,'#d1c9b7');
    line(c,[[44,61],[40,76],[48,85]],'#747f7c',2); line(c,[[275,46],[269,63],[279,80]],'#747f7c',2);
    stone(c,25,122,29,color); stone(c,286,125,27,color);
  }
  function scene(sky,ground,paint) {
    return function(ctx,w,h) {
      ctx.save(); ctx.scale(w/320,h/140); ctx.beginPath(); ctx.rect(0,0,320,140); ctx.clip();
      ctx.fillStyle=sky; ctx.fillRect(0,0,320,140);
      polygon(ctx,[[0,104],[51,97],[108,104],[185,97],[252,104],[320,97],[320,140],[0,140]],ground,2);
      paint(ctx); dots(ctx); ctx.restore();
    };
  }

  global.SCENES4 = {
    '야영지': scene('#7c92a0','#adaf80',c=>{
      moon(c,257,26); tree(c,24,115,1.05,'#496c66'); tree(c,293,119,1.2,'#527469'); tree(c,70,102,.75,'#658175');
      shadow(c,110,118,52); polygon(c,[[62,111],[105,41],[155,111]],'#dbae69');
      polygon(c,[[105,41],[107,111],[155,111]],'#b77656'); polygon(c,[[84,110],[105,69],[122,110]],'#49595a');
      line(c,[[60,113],[45,120]]); line(c,[[157,113],[173,121]]);
      line(c,[[179,120],[211,107]],'#765142',6); line(c,[[179,108],[213,122]],'#765142',6); flame(c,196,108,.8);
      oval(c,183,76,2,2,GOLD,1); oval(c,208,62,2,2,GOLD,1); person(c,253,120,{color:'#7d6380',hood:true,scale:.65});
    }),
    '대장간': scene('#bda795','#b5a38a',c=>{
      box(c,20,12,85,112,'#7c7776'); box(c,32,49,59,65,'#393c47',15);
      line(c,[[27,30],[96,30]],'#a29a8b',2); line(c,[[58,14],[58,30]],'#a29a8b',2); flame(c,61,106,.9);
      person(c,197,115,{color:'#a26749',beard:true,arm:true});
      box(c,212,43,7,39,WOOD,1); box(c,203,38,30,13,'#8ba0ac',2);
      polygon(c,[[111,79],[166,79],[178,68],[177,89],[158,99],[159,111],[122,111],[129,98],[117,91]],'#859daa');
      sword(c,146,77,Math.PI/2,.7); sparkle(c,166,57,5); sparkle(c,180,64,4);
      box(c,263,58,9,65,WOOD); sword(c,277,105,.15,.95); shield(c,263,107,'#967348',.7);
    }),
    '훈련장': scene('#c9d4b4','#b5b28a',c=>{
      for(let x=17;x<320;x+=34){box(c,x,74,7,39,'#b39770',1);} line(c,[[0,85],[320,85]],'#8e775b',5);
      for(const [x,s] of [[91,.8],[163,1],[238,.7]]){
        c.save(); c.translate(x,115); c.scale(s,s); box(c,-3,-75,6,76,WOOD,1); line(c,[[-30,-49],[30,-49]],WOOD,7);
        oval(c,0,-51,17,25,'#d5b96d'); oval(c,0,-91,12,12,'#e5cf8e');
        line(c,[[-5,-94],[-1,-90]],INK,2); line(c,[[1,-94],[5,-90]],INK,2); line(c,[[-5,-85],[5,-85]],INK,2);
        line(c,[[-15,-58],[15,-39]],'#9d7a48',2); c.restore();
      }
      sword(c,38,116,-.25,.8); shadow(c,167,123,29); shield(c,289,115,'#b9795d',.6);
    }),
    '훈련 교관': scene('#c7c9b7','#b8b39a',c=>{
      box(c,32,28,74,56,'#667c74'); box(c,42,83,6,38,WOOD); box(c,91,83,6,38,WOOD);
      line(c,[[47,66],[60,50],[77,63],[95,40]],PAPER,2); line(c,[[85,40],[95,40],[95,50]],PAPER,2);
      person(c,157,125,{color:'#547489',helmet:true,arm:true,scale:1.28}); sword(c,196,99,.15,1.1);
      person(c,258,123,{color:'#bb9154',helmet:true,scale:.85}); shield(c,237,102,'#9ba875',.65);
      box(c,122,34,21,6,'#c06a58',1); coins(c,39,124,4);
    }),
    '폐허의 서고': scene('#b8b9b4','#aba598',c=>{
      ruin(c); box(c,71,14,111,96,'#8c7665');
      for(const y of [45,78,106]){line(c,[[74,y],[178,y]],'#4c5056',4); for(let i=0;i<7;i++){const colors=['#9e6870','#749388','#c5a35f'];box(c,79+i*14,y-24,9,22,colors[i%3],1);}}
      line(c,[[211,9],[217,38],[207,48]],'#738774',3); oval(c,211,31,7,3,'#738774',2);
      book(c,221,111,'#6f8c89',-.12); book(c,244,123,'#ba8564',.15); scroll(c,203,82,.25); sparkle(c,225,58,6,'#e8d491');
    }),
    '좀도둑': scene('#abb7bb','#b2a89a',c=>{
      box(c,16,12,83,102,'#9e9991'); box(c,24,35,42,10,'#bfb8a5'); box(c,255,40,65,75,'#979693');
      line(c,[[22,73],[88,73]],'#777b7c',2); line(c,[[277,65],[318,65]],'#777b7c',2);
      c.save(); c.translate(187,111); c.rotate(.28); person(c,0,0,{color:'#626b79',hood:true,arm:true}); c.restore();
      oval(c,228,84,14,17,'#bc905b'); line(c,[[218,71],[237,71]],'#e8cc88',3);
      line(c,[[110,53],[140,53]],INK,2); line(c,[[104,68],[132,68]],INK,2); line(c,[[123,83],[145,83]],INK,2);
      coins(c,124,123,2); coins(c,93,110,1); polygon(c,[[158,113],[168,113],[155,128],[142,126]],'#626b79');
    }),
    '용병 길드 게시판': scene('#c4cfb7','#b5aa89',c=>{
      tree(c,30,122,1.08,'#7d9174'); tree(c,291,124,.86,'#779077');
      box(c,85,22,7,109,WOOD); box(c,229,22,7,109,WOOD); box(c,70,20,180,92,'#b48755');
      box(c,77,27,166,78,'#866b52'); scroll(c,114,65,-.1); scroll(c,167,65,.08);
      box(c,200,39,29,44,'#e0d0a8'); sword(c,214,65,0,.45); oval(c,214,79,4,4,'#b55f55',2);
      shield(c,159,23,'#557a79',.45); person(c,281,126,{color:'#9c695a',helmet:true,scale:.64});
    }),
    '쓰러진 기사': scene('#c0c7b5','#a5ad91',c=>{
      tree(c,30,117,1,'#73816f'); tree(c,289,115,.86,'#80907a'); stone(c,221,112,54);
      shadow(c,142,121,68); c.save(); c.translate(141,106); c.rotate(-Math.PI/2+.15); person(c,0,0,{color:'#7e91a3',helmet:true,scale:1.1}); c.restore();
      shield(c,187,106,'#986365',.85); sword(c,225,104,.12,1.35);
      polygon(c,[[77,126],[64,115],[84,120]],'#72885f'); polygon(c,[[246,127],[239,113],[256,121]],'#72885f');
      line(c,[[200,44],[203,34],[208,38]],'#d8d9bc',2);
    }),
    '신비한 샘': scene('#a5c3bb','#a1bba2',c=>{
      tree(c,25,113,1.1,'#6c9285'); tree(c,292,119,1.22,'#648c7d');
      oval(c,159,109,80,20,'#829fa1'); oval(c,159,103,66,15,'#85c8cb');
      for(const [x,y] of [[89,105],[110,91],[142,86],[185,88],[217,98],[218,117],[177,125],[126,122]])stone(c,x,y,22,'#b2bdb1');
      line(c,[[123,102],[151,106],[181,102]],'#edf1cc',2); line(c,[[147,114],[171,114]],'#edf1cc',2);
      sparkle(c,160,46,11,'#f7e6a2'); sparkle(c,127,70,5,'#e9f4d1'); sparkle(c,191,64,6,'#e9f4d1');
      box(c,253,96,13,26,'#a9d8cf',4); box(c,256,90,7,7,WOOD,1);
    }),
    '수상한 제단': scene('#9996ad','#9a9b95',c=>{
      ruin(c,'#90939f'); moon(c,160,24,'#d4c7e2');
      box(c,105,100,112,24,'#747f89'); polygon(c,[[99,98],[111,78],[210,78],[224,98]],'#a4a3b1');
      polygon(c,[[160,46],[182,61],[173,85],[146,85],[137,61]],'#aa7bae'); sparkle(c,160,65,9,'#e5b8dc');
      for(const x of [81,239]){box(c,x-4,82,8,38,'#e8d6b2',2);flame(c,x,79,.34,'#b285c1');}
      line(c,[[145,110],[160,118],[175,110]],'#d4c8dc',2); coins(c,111,132,3);
    }),
    '버려진 무기고': scene('#aaaead','#a79f8f',c=>{
      box(c,23,19,69,92,'#7d7770'); line(c,[[26,51],[90,51]],'#a49782',4);
      sword(c,44,91,-.06,1.15); sword(c,70,94,.13,.85);
      chest(c,136,119,false,'#9c7d58'); chest(c,233,112,false,'#7f8a79'); shield(c,287,98,'#9f735d',.8);
      line(c,[[97,16],[97,47],[124,16]],'#ece5ce',1); line(c,[[97,30],[110,30]],'#ece5ce',1);
      stone(c,43,125,25); polygon(c,[[177,133],[184,119],[190,134]],'#7c8865');
    }),
    '떠돌이 상인': scene('#c4d1bd','#b3b398',c=>{
      tree(c,30,117,.9,'#789478');
      box(c,49,67,122,45,WOOD); oval(c,72,119,15,15,'#9b8165'); oval(c,148,119,15,15,'#9b8165');
      for(const x of [72,148]){line(c,[[x-10,119],[x+10,119]]);line(c,[[x,109],[x,129]]);}
      polygon(c,[[45,69],[67,23],[144,23],[175,69]],'#b76b5c'); polygon(c,[[89,24],[89,68],[133,68],[123,24]],'#f0d9ac');
      book(c,73,77,'#718c8a'); oval(c,144,81,14,13,'#cab171'); person(c,220,123,{color:'#7b7796',hat:true,beard:true});
      line(c,[[242,111],[280,93]],WOOD,4); box(c,269,99,22,24,'#bda073'); coins(c,256,129,3);
    }),
    '도박꾼': scene('#a8a4ae','#b5a390',c=>{
      lantern(c,48,45); person(c,156,104,{color:'#836176',hat:true,arm:true,scale:1.12});
      oval(c,162,112,96,19,'#8b725a'); polygon(c,[[90,110],[160,96],[228,109],[164,124]],'#6a8a79');
      c.save();c.translate(131,109);c.rotate(-.16);box(c,-12,-13,24,29,PAPER);polygon(c,[[0,-7],[6,1],[0,9],[-6,1]],'#b36664',2);c.restore();
      box(c,183,102,20,20,'#eee1bf',3);for(const [x,y]of [[188,107],[198,107],[193,112],[188,117],[198,117]])oval(c,x,y,1.4,1.4,INK,1);
      coins(c,220,120,4);oval(c,197,31,9,9,GOLD);line(c,[[197,26],[197,36]],INK,2);
    }),
    '길 잃은 용병': scene('#bac8bb','#b0b798',c=>{
      tree(c,28,123,1.1,'#778d7a'); tree(c,294,116,.85,'#73907e');
      polygon(c,[[131,140],[155,90],[176,76],[189,81],[170,108],[167,140]],'#ddcda8');
      box(c,88,24,7,99,WOOD); polygon(c,[[70,38],[126,38],[137,48],[126,57],[70,57]],'#d3b276');
      polygon(c,[[108,63],[52,63],[42,72],[52,80],[108,80]],'#b88d61');
      person(c,206,126,{color:'#839ba0',helmet:true,scale:1.12}); shield(c,237,113,'#b08d62',.7);
      c.save();c.translate(154,95);c.rotate(.15);box(c,-16,-12,32,24,PAPER,1);line(c,[[-11,5],[-2,-6],[8,4],[12,-5]],'#b08166',2);c.restore();
    }),
    '보물': scene('#b5b9b1','#afa58b',c=>{
      ruin(c); shadow(c,164,126,65); chest(c,162,115,true,'#b6814c');
      coins(c,129,96,7); coins(c,186,123,5); coins(c,111,127,3);
      polygon(c,[[169,70],[182,80],[175,94],[159,94],[153,80]],'#81b9bb');
      sparkle(c,164,37,12); sparkle(c,118,58,7); sparkle(c,208,70,7); sparkle(c,224,110,5);
      book(c,75,125,'#92709b',-.13); sword(c,245,120,.35,.7);
    }),
    '암시장': scene('#626e88','#8d9290',c=>{
      moon(c,286,23); box(c,13,35,31,80,'#4c586e'); box(c,277,56,42,62,'#4c586e'); stall(c,'#776386');
      person(c,161,98,{color:'#4a536b',hood:true,scale:.75}); lantern(c,68,72); lantern(c,250,72);
      box(c,89,82,16,19,'#9db4a4',5);box(c,93,76,8,7,WOOD,1);book(c,216,91,'#a27378',.06);
      sword(c,127,98,-.25,.62);oval(c,191,90,10,12,'#b6a479');coins(c,178,106,3);
      line(c,[[87,121],[103,125],[118,121]],'#795b49',2);
    }),
  };
})(window);
