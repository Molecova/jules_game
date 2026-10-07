// Route studies are isolated from the live game. Verify every proposed composition and choice flow.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const out=process.env.ROUTE_OUTPUT||'/tmp/jules-route-proposals';fs.mkdirSync(out,{recursive:true});
(async()=>{
  const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const p=await b.newPage({viewport:{width:1180,height:1050},deviceScaleFactor:2}),errors=[],failed=[];p.on('pageerror',e=>errors.push(e.message));p.on('requestfailed',r=>failed.push(r.url()));
  try{
    await p.goto('http://127.0.0.1:8000/concepts/v4-route-proposals.html');
    const counts=[];
    for(let act=1;act<=5;act++){
      await p.locator('#act').selectOption(String(act));
      for(const phase of ['early','late']){
        await p.locator(`[data-phase="${phase}"]`).click();
        const states=await p.evaluate(()=>RouteStudy.states);
        for(const s of states){assert.equal(s.act,act);assert.equal(s.stage,'choice');assert.equal(s.choices.length,2);assert.ok(s.choices[0].ids.length>= (phase==='early'?act+3:act+5));assert.ok(s.choices.every(r=>r.count===r.ids.length));assert.ok(s.choices.every(r=>new Set(r.ids).size>=4));}
        assert.equal(await p.evaluate(()=>RouteStudy.states.every(s=>s.choices.every(r=>r.ids.every(id=>!!GD.MONSTERS[id])))),true);
        const fit=await p.evaluate(()=>[...document.querySelectorAll('.proposal .screen')].map(s=>({variant:s.closest('.proposal').id,content:s.querySelector('.theme-note,.journal-note').getBoundingClientRect().bottom,bottom:s.querySelector('.bottom').getBoundingClientRect().top})));
        for(const r of fit)assert.ok(r.content<=r.bottom+1,JSON.stringify(r));
        counts.push({act,phase,left:states[0].choices[0],right:states[0].choices[1]});
      }
    }
    for(let act=1;act<=5;act++){const early=counts.find(c=>c.act===act&&c.phase==='early'),late=counts.find(c=>c.act===act&&c.phase==='late');assert.ok(late.left.ids.every(id=>!early.left.ids.includes(id)),'distinct early/late roster');assert.ok(late.left.count>early.left.count);}
    await p.locator('#act').selectOption('1');await p.locator('[data-phase="early"]').click();await p.screenshot({path:path.join(out,'comparison-desktop.png'),fullPage:true});
    for(const [width,height]of [[390,844],[360,640]]){
      await p.setViewportSize({width,height});
      for(const view of ['a','b','c']){
        await p.locator(`[data-view="${view}"]`).click();
        const screen=p.locator(`#proposal-${view} .screen`);
        for(const phase of ['early','late']){
          await p.locator(`[data-phase="${phase}"]`).click();
          assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
          assert.equal(await screen.locator('.depart').isDisabled(),true);
          const fit=await screen.evaluate(s=>({content:s.querySelector('.theme-note,.journal-note').getBoundingClientRect().bottom,bottom:s.querySelector('.bottom').getBoundingClientRect().top}));assert.ok(fit.content<=fit.bottom+1,JSON.stringify({view,width,phase,...fit}));
          await screen.screenshot({path:path.join(out,`${view}-${phase}-${width}.png`)});
          const initial=await p.evaluate(view=>RouteStudy.states.find(s=>s.id===view),view);
          await screen.locator('[data-side="0"]').click();assert.equal(await screen.locator('[data-side="0"]').getAttribute('aria-pressed'),'true');assert.equal(await screen.locator('[data-depart]').isEnabled(),true);
          await screen.locator('[data-side="1"]').click();assert.equal(await screen.locator('[data-side="0"]').getAttribute('aria-pressed'),'false');
          await screen.locator('[data-depart]').click();assert.equal(await screen.locator('.arrival h4').innerText(),initial.choices[1].name);
          assert.equal(await p.evaluate(view=>RouteStudy.states.find(s=>s.id===view).stage,view),'arrival');
          await screen.locator('[data-next]').click();assert.equal(await p.evaluate(view=>RouteStudy.states.find(s=>s.id===view).step,view),initial.step+1);
        }
      }
    }
    // Eight choices lead to the boss; clearing the preview opens the next act.
    await p.locator('[data-view="b"]').click();await p.locator('[data-phase="early"]').click();
    const s=p.locator('#proposal-b .screen');
    for(let i=0;i<8;i++){await s.locator(`[data-side="${i%2}"]`).click();await s.locator('[data-depart]').click();await s.locator('[data-next]').click();}
    assert.equal(await p.evaluate(()=>RouteStudy.states.find(s=>s.id==='b').stage),'boss');await s.screenshot({path:path.join(out,'boss-gate.png')});await s.locator('[data-next]').click();assert.equal(await p.evaluate(()=>RouteStudy.states.find(s=>s.id==='b').act),2);
    await p.goto('http://127.0.0.1:8000/concepts/v4-route-proposals.html#c');assert.equal(await p.locator('#proposal-c').isVisible(),true);assert.equal(await p.locator('#proposal-a').isVisible(),false);
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
    fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({variants:3,compositions:30,viewports:[[390,844],[360,640]],counts,errors,failed},null,2));
    console.log('PASS 3 layouts, 30 compositions, 2 mobile viewports, left/right switch, arrival, boss, next act, direct links; console exceptions and resource failures 0');
  }catch(e){await p.screenshot({path:path.join(out,'failure.png'),fullPage:true});throw e;}finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
