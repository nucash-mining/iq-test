/* ---------- figure engine (Raven-style 3x3 matrices) ---------- */
const DEF={shape:0,count:1,fill:0,size:2,rot:0,lines:0};
const ATTRS=['shape','count','fill','size','rot','lines'];
const POS={1:[[50,50]],2:[[29,50],[71,50]],3:[[50,29],[29,71],[71,71]],4:[[29,29],[71,29],[29,71],[71,71]]};
const SEG=[[8,50,92,50],[50,8,50,92],[14,86,86,14],[14,14,86,86]];
function poly(n,cx,cy,r,deg){let p=[];for(let i=0;i<n;i++){const a=(deg+i*360/n)*Math.PI/180;p.push((cx+r*Math.cos(a)).toFixed(1)+','+(cy+r*Math.sin(a)).toFixed(1))}return p.join(' ')}
function fig(s,cx,cy,r,rot,st){
  if(s===0)return `<circle cx="${cx}" cy="${cy}" r="${r}" style="${st}"/>`;
  const P={1:[4,1.13,45],2:[3,1.18,-90+rot*90],3:[4,1.18,-90],4:[5,1.07,-90],5:[6,1.04,0]}[s];
  return `<polygon points="${poly(P[0],cx,cy,r*P[1],P[2])}" style="${st}"/>`;
}
function cellSVG(c){
  let s='<svg viewBox="0 0 100 100" aria-hidden="true">';
  SEG.forEach((g,i)=>{if(c.lines>>i&1)s+=`<line x1="${g[0]}" y1="${g[1]}" x2="${g[2]}" y2="${g[3]}" style="stroke:var(--fig);stroke-width:2.6;stroke-linecap:round"/>`});
  const base=c.count===1?27:15, r=base*[.56,.78,1][c.size];
  const fillv=['var(--cellbg)','var(--figmid)','var(--fig)'][c.fill];
  const st=`fill:${fillv};stroke:var(--fig);stroke-width:2.6;stroke-linejoin:round`;
  for(const [x,y] of POS[c.count])s+=fig(c.shape,x,y,r,c.rot,st);
  return s+'</svg>';
}
function rv(R,r,c){
  switch(R.t){
    case 'const':return R.v;
    case 'row':return R.v[r];
    case 'col':return R.v[c];
    case 'prog':{const s=Array.isArray(R.s)?R.s[r]:R.s,k=Array.isArray(R.k)?R.k[r]:R.k,v=s+c*k;return R.mod?((v%R.mod)+R.mod)%R.mod:v}
    case 'dist':return R.v[(((c+R.d*r)%3)+3)%3];
    default:{const [a,b]=R.v[r];if(c===0)return a;if(c===1)return b;
      return {xor:a^b,or:a|b,sub:a&~b&15,add:a+b,minus:a-b}[R.t]}
  }
}
function cellAt(spec,r,c){const o={...DEF};for(const k in spec.rules)o[k]=rv(spec.rules[k],r,c);return o}
const key=c=>ATTRS.map(a=>c[a]).join('.');
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function shuffle(a,R){for(let i=a.length-1;i>0;i--){const j=Math.floor(R()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const DOM={shape:[0,1,2,3,4,5],count:[1,2,3,4],fill:[0,1,2],size:[0,1,2],rot:[0,1,2,3]};
/* Build 8 options as every combination of 3 attributes x {correct, alternate}.
   Each correct value appears in exactly half the options, so "pick the most common features" doesn't work. */
function buildOptions(spec,seed){
  const R=rng(seed), ans=cellAt(spec,2,2), cells=[];
  for(let r=0;r<3;r++)for(let c=0;c<3;c++)if(r<2||c<2)cells.push(cellAt(spec,r,c));
  const varying=ATTRS.filter(a=>spec.rules[a]&&spec.rules[a].t!=='const');
  let pool=shuffle(varying.slice(),R);
  const extra=shuffle(['fill','size','count','shape'].filter(a=>!pool.includes(a)),R);
  pool=pool.concat(extra);
  const chosen=[];
  for(const a of pool){
    if(chosen.length===3)break;
    if(a==='shape'&&(chosen.includes('rot')||varying.includes('rot')))continue;
    if(a==='rot'&&chosen.includes('shape'))continue;
    if(a==='rot'&&ans.shape!==2)continue;
    chosen.push(a);
  }
  const alt={};
  for(const a of chosen){
    const seen=[...new Set(cells.map(c=>c[a]))].filter(v=>v!==ans[a]);
    if(a==='lines'){alt[a]=seen.length?seen[Math.floor(R()*seen.length)]:ans.lines^(1<<Math.floor(R()*4));}
    else{const d=(seen.length?seen:DOM[a].filter(v=>v!==ans[a]));alt[a]=d[Math.floor(R()*d.length)]}
  }
  const opts=[];
  for(let m=0;m<8;m++){const o={...ans};chosen.forEach((a,i)=>{if(m>>i&1)o[a]=alt[a]});opts.push(o)}
  shuffle(opts,R);
  return {opts,correct:opts.findIndex(o=>key(o)===key(ans))};
}
const NAMES={shape:['shape','shapes'],count:['number of figures','counts'],fill:['shading','shadings'],size:['size','sizes'],rot:['orientation','orientations'],lines:['line pattern','line patterns']};
function explain(spec){
  const out=[];
  for(const a of ATTRS){const R=spec.rules[a];if(!R||R.t==='const')continue;const n=NAMES[a][0],N=n[0].toUpperCase()+n.slice(1);
    if(R.t==='row')out.push(`${N} is the same within each row.`);
    else if(R.t==='col')out.push(`${N} depends on the column and repeats in every row.`);
    else if(R.t==='dist')out.push(`Each row uses the same three ${NAMES[a][1]}, once each.`);
    else if(R.t==='prog'){
      if(a==='rot')out.push(Array.isArray(R.k)?'Each row turns by its own step: 90°, then 180°, then 270° clockwise per cell.':'The figure turns 90° clockwise from cell to cell.');
      else out.push(`${N} goes up by ${R.k} from left to right.`);
    }
    else if(R.t==='xor')out.push('A line appears in the third cell when it is in exactly one of the first two; lines in both cancel.');
    else if(R.t==='or')out.push('The third cell combines every line from the first two.');
    else if(R.t==='sub')out.push('The third cell keeps the first cell’s lines minus those in the second.');
    else if(R.t==='add')out.push('The third cell’s count is the sum of the first two.');
    else if(R.t==='minus')out.push('The third cell’s count is the first minus the second.');
  }
  return out.join(' ');
}

/* ---------- item bank ---------- */
/* b = difficulty on the z-scale (0 = average adult, 1 = one SD above). c = chance of guessing. */
const MX=[
 {b:-2.6,rules:{shape:{t:'row',v:[0,1,3]},count:{t:'prog',s:1,k:1}}},
 {b:-2.1,rules:{shape:{t:'dist',v:[0,1,2],d:1},fill:{t:'const',v:2},size:{t:'const',v:1}}},
 {b:-1.6,rules:{fill:{t:'col',v:[0,1,2]},shape:{t:'row',v:[5,0,3]},count:{t:'const',v:2}}},
 {b:-1.1,rules:{shape:{t:'const',v:2},rot:{t:'prog',s:[0,1,2],k:1,mod:4},fill:{t:'row',v:[2,0,1]}}},
 {b:-0.6,rules:{lines:{t:'or',v:[[1,2],[4,8],[1,4]]},shape:{t:'const',v:0},size:{t:'const',v:0},fill:{t:'const',v:2}}},
 {b:-0.2,rules:{shape:{t:'dist',v:[1,3,5],d:1},count:{t:'dist',v:[1,2,3],d:-1}}},
 {b:0.2,rules:{shape:{t:'dist',v:[0,2,1],d:1},fill:{t:'dist',v:[0,1,2],d:-1},count:{t:'prog',s:[1,2,1],k:1}}},
 {b:0.6,rules:{lines:{t:'xor',v:[[3,6],[9,5],[12,6]]},shape:{t:'row',v:[1,3,0]},size:{t:'const',v:0}}},
 {b:0.9,rules:{shape:{t:'dist',v:[4,0,1],d:1},fill:{t:'dist',v:[0,1,2],d:-1},size:{t:'col',v:[0,1,2]}}},
 {b:1.3,rules:{lines:{t:'xor',v:[[5,3],[6,12],[10,9]]},shape:{t:'dist',v:[0,1,3],d:-1},count:{t:'dist',v:[1,2,3],d:1},size:{t:'const',v:1}}},
 {b:1.7,rules:{lines:{t:'sub',v:[[15,3],[7,4],[14,8]]},fill:{t:'dist',v:[0,1,2],d:1},shape:{t:'row',v:[5,2,1]},size:{t:'const',v:0}}},
 {b:2.1,rules:{count:{t:'add',v:[[1,2],[2,1],[1,1]]},shape:{t:'dist',v:[0,1,3],d:1},fill:{t:'dist',v:[0,2,1],d:-1},size:{t:'const',v:1}}},
 {b:2.5,rules:{lines:{t:'xor',v:[[3,5],[12,9],[6,3]]},shape:{t:'dist',v:[1,3,5],d:1},fill:{t:'dist',v:[0,1,2],d:-1},size:{t:'col',v:[0,1,2]}}},
 {b:2.9,rules:{count:{t:'minus',v:[[4,1],[3,2],[4,2]]},lines:{t:'xor',v:[[9,6],[5,3],[10,12]]},shape:{t:'dist',v:[4,0,3],d:-1},fill:{t:'dist',v:[2,0,1],d:1},size:{t:'const',v:1}}},
 {b:3.3,rules:{count:{t:'add',v:[[1,1],[2,1],[1,2]]},lines:{t:'xor',v:[[6,5],[12,10],[3,9]]},shape:{t:'dist',v:[1,5,3],d:-1},fill:{t:'dist',v:[1,2,0],d:1},size:{t:'col',v:[2,1,0]}}},
 {b:3.6,rules:{shape:{t:'const',v:2},rot:{t:'prog',s:[0,1,0],k:[1,2,3],mod:4},count:{t:'minus',v:[[3,1],[4,3],[4,2]]},fill:{t:'dist',v:[0,1,2],d:1},lines:{t:'xor',v:[[1,2],[2,4],[4,8]]},size:{t:'const',v:1}}},
];
const NS=[
 {b:-2.2,seq:'3, 6, 12, 24',ans:'48',ex:'Each number doubles.'},
 {b:-1.2,seq:'7, 10, 8, 11, 9, 12',ans:'10',ex:'Alternating +3 and −2.'},
 {b:-0.3,seq:'2, 6, 12, 20, 30, 42',ans:'56',ex:'n × (n+1): 1·2, 2·3, … 7·8 = 56. The gaps grow by 2.'},
 {b:0.6,seq:'1, 3, 2, 6, 5, 15, 14',ans:'42',ex:'Alternating ×3 and −1.'},
 {b:1.1,seq:'3, 4, 8, 17, 33, 58',ans:'94',ex:'The gaps are perfect squares: 1, 4, 9, 16, 25, then 36.'},
 {b:1.7,seq:'1, 2, 4, 7, 28, 33, 198',ans:'205',ex:'+1, ×2, +3, ×4, +5, ×6, then +7.'},
 {b:2.2,seq:'2, 12, 36, 80, 150',ans:'252',ex:'n² × (n+1): 1·2, 4·3, 9·4, 16·5, 25·6, then 36·7 = 252.'},
 {b:2.8,seq:'0, 1, 5, 19, 65, 211',ans:'665',ex:'3ⁿ − 2ⁿ: 729 − 64 = 665. (Also: each term is 5× the last minus 6× the one before.)'},
];
const VB=[
 {b:-2.6,q:'Glove is to hand as sock is to…',o:['Shoe','Foot','Leg','Wool','Pair'],a:1,ex:'A glove covers a hand; a sock covers a foot.'},
 {b:-2.2,q:'Which word does not belong?',o:['Apple','Banana','Carrot','Cherry','Grape'],a:2,ex:'The others are fruits.'},
 {b:-1.3,q:'A is taller than B. B is taller than D. C is shorter than D. Who is the shortest?',o:['A','B','C','D','Cannot be determined'],a:2,ex:'A > B > D > C.'},
 {b:-0.7,q:'Ocean is to drop as desert is to…',o:['Cactus','Grain','Heat','Dune','Oasis'],a:1,ex:'A drop is the smallest unit of an ocean; a grain is the smallest unit of a desert.'},
 {b:-0.2,q:'One word fits in front of all four to make new words. Type it.',sub:'___BALL · ___PRINT · ___NOTE · ___STEP',free:'text',ans:'FOOT',ex:'Football, footprint, footnote, footstep.'},
 {b:0.2,q:'If the day after tomorrow is two days before Thursday, what day was the day before yesterday?',o:['Thursday','Friday','Saturday','Sunday','Monday'],a:1,ex:'The day after tomorrow is Tuesday, so today is Sunday and the day before yesterday was Friday.'},
 {b:0.7,q:'No A are B. All C are B. Which statement must be true?',o:['All A are C','Some C are A','No C are A','Some B are not C','None of these must be true'],a:2,ex:'Every C sits inside B, and no A is in B, so no C can be an A. B and C could be the same set, so “some B are not C” is not guaranteed.'},
 {b:1.0,q:'At a meeting, everyone shook hands with everyone else exactly once. There were 66 handshakes. How many people were there?',free:'num',ans:'12',ex:'n(n−1)/2 = 66 gives n = 12.'},
 {b:1.4,q:'You have 7 identical-looking coins. One is lighter than the rest. What is the fewest balance-scale weighings that guarantees you find it?',o:['1','2','3','4','6'],a:1,ex:'Each weighing has 3 outcomes, and 3² = 9 ≥ 7. Weigh 3 against 3: if they balance the odd one is the 7th; otherwise weigh 1 against 1 from the lighter group.'},
 {b:1.8,q:'Cacophony is to euphony as turbid is to…',o:['Murky','Turgid','Limpid','Torpid','Placid'],a:2,ex:'Antonyms: cacophony (harsh sound) vs euphony (pleasant sound); turbid (cloudy) vs limpid (clear). Placid means calm, not clear.'},
 {b:2.4,q:'On an island, knights always tell the truth and knaves always lie. A says: “At least one of us is a knave.” What are A and B?',o:['Both knights','Both knaves','A is a knight, B is a knave','A is a knave, B is a knight','Cannot be determined'],a:2,ex:'If A were a knave, the statement would be true, which a knave can’t say. So A is a knight, the statement is true, and B must be the knave.'},
 {b:2.7,q:'Four cards show A, K, 4 and 7. Each has a letter on one side and a number on the other. Rule: “If a card has a vowel on one side, it has an even number on the other.” Which cards must you turn over to test the rule?',o:['A only','A and 4','A and 7','A, 4 and 7','All four'],a:2,ex:'Only A (a vowel that needs an even back) and 7 (an odd number that must not hide a vowel) can break the rule. The 4 can’t: the rule says nothing about what’s behind an even number.'},
];
/* Extended range: items meant to separate scores from 150 to 200+. */
const EX=[
 {b:3.6,q:'How many squares of any size are there on a standard 8×8 chessboard?',free:'num',ans:'204',ex:'1² + 2² + … + 8² = 204.'},
 {b:3.8,ns:true,seq:'4, 16, 37, 58, 89, 145, 42, 20',ans:'4',ex:'Each term is the sum of the squares of the previous term’s digits: 2² + 0² = 4. The loop repeats.'},
 {b:3.9,q:'Knights always tell the truth; knaves always lie. A says: “B is a knave.” B says: “A and C are the same type.” What is C?',o:['A knight','A knave','Cannot be determined'],a:1,ex:'If A is a knight, B is a knave, so A and C differ: C is a knave. If A is a knave, B is a knight, so A and C match: C is a knave. Either way C is a knave.'},
 {b:4.0,ns:true,seq:'1, 2, 6, 42, 1806',ans:'3263442',ex:'Each term is the previous one times (itself + 1): 1806 × 1807 = 3,263,442.'},
 {b:4.2,mx:{rules:{shape:{t:'const',v:2},rot:{t:'prog',s:[1,0,2],k:[1,2,3],mod:4},count:{t:'add',v:[[1,2],[2,2],[1,1]]},fill:{t:'dist',v:[2,0,1],d:-1},size:{t:'col',v:[2,1,0]},lines:{t:'xor',v:[[5,6],[3,9],[12,10]]}}}},
 {b:4.4,q:'12 coins look identical. One is counterfeit and is either heavier or lighter, you don’t know which. What is the fewest balance-scale weighings that guarantees you find the coin and tell whether it is heavier or lighter?',free:'num',ans:'3',ex:'There are 24 possibilities (12 coins × heavy/light). Two weighings give only 9 outcomes; three give 27, and a known 4-4-4 strategy solves it.'},
 {b:4.6,ns:true,seq:'1, 11, 21, 1211, 111221',ans:'312211',ex:'Look-and-say: read the previous term aloud. 111221 is “three 1s, two 2s, one 1” = 312211.'},
 {b:4.8,q:'In one 24-hour day, how many times do a clock’s hour and minute hands point in exactly opposite directions?',free:'num',ans:'22',ex:'The minute hand gains one lap on the hour hand 22 times a day, and each lap has one moment where they are opposite.'},
 {b:5.0,mx:{rules:{count:{t:'minus',v:[[4,3],[4,1],[3,1]]},shape:{t:'dist',v:[3,5,0],d:-1},fill:{t:'dist',v:[1,0,2],d:1},size:{t:'dist',v:[0,2,1],d:-1},lines:{t:'sub',v:[[15,6],[13,4],[11,8]]}}}},
 {b:5.3,q:'In how many different ways can a 2×10 strip be completely covered by ten 1×2 dominoes?',free:'num',ans:'89',ex:'Tilings of a 2×n strip follow the Fibonacci numbers: 1, 2, 3, 5, 8, … the 10th is 89.'},
 {b:5.7,q:'A family has two children. At least one is a boy born on a Tuesday. What is the probability both children are boys? Type it as a fraction.',free:'text',ans:'13/27',ex:'Of the 196 equally likely (sex, weekday) pairs, 27 include a Tuesday boy. 13 of those are two boys (7 + 7 − 1).'},
 {b:6.3,q:'What is the sum of all the digits of all the whole numbers from 1 to 1,000,000?',free:'num',ans:'27000001',ex:'From 0 to 999,999 every digit 0–9 appears equally often in each of 6 places: 10⁶ × 6 × 4.5 = 27,000,000. Add 1 for 1,000,000.'},
];
const ITEMS=[];
const addMx=(s,i,sec)=>{const o=buildOptions(s,i*7919+13);ITEMS.push({sec,kind:'mx',b:s.b,c:1/8,spec:s,opts:o.opts,a:o.correct,ex:explain(s)})};
MX.forEach((s,i)=>addMx(s,i,0));
NS.forEach(s=>ITEMS.push({sec:1,kind:'ns',b:s.b,c:0,...s}));
VB.forEach(s=>ITEMS.push({sec:2,kind:s.free?'free':'vb',c:s.free?0:1/s.o.length,...s}));
EX.forEach((s,i)=>{
  if(s.mx)addMx({b:s.b,...s.mx},100+i,3);
  else if(s.ns)ITEMS.push({sec:3,kind:'ns',c:0,...s});
  else ITEMS.push({sec:3,kind:s.free?'free':'vb',c:s.free?0:1/s.o.length,...s});
});
const SECS=['Matrix Reasoning','Number Series','Verbal & Logical Reasoning','Extended Range'];
const LIMIT=70*60*1000, STORE='hrit-form-b-v1';

/* ---------- scoring: 3-parameter IRT, expected a-posteriori ability ---------- */
const A_DISC=1.1, PRIOR_SD=3;
function isRight(it,ans){
  if(ans===undefined||ans===null||ans==='')return false;
  if(it.kind==='mx'||it.kind==='vb')return ans===it.a;
  const norm=s=>String(s).trim().toUpperCase().replace(/[,\s]/g,'');
  return norm(ans)===norm(it.ans);
}
function scoreAll(answers){
  const resp=ITEMS.map((it,i)=>isRight(it,answers[i]));
  let num=0,den=0,sq=0;
  for(let t=-9;t<=9.0001;t+=0.02){
    let l=Math.exp(-t*t/(2*PRIOR_SD*PRIOR_SD));
    ITEMS.forEach((it,k)=>{const p=it.c+(1-it.c)/(1+Math.exp(-1.7*A_DISC*(t-it.b)));l*=resp[k]?p:1-p});
    num+=t*l;den+=l;sq+=t*t*l;
  }
  const m=num/den, se=Math.sqrt(sq/den-m*m);
  return {resp,theta:m,iq:Math.round(100+15*m),se:15*se};
}
function phi(z){const t=1/(1+.2316419*Math.abs(z)),d=.3989423*Math.exp(-z*z/2);const p=d*t*(.3193815+t*(-.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return z>0?1-p:p}
function band(iq){return iq>=190?'Beyond the range of standard tests':iq>=175?'Exceptionally gifted':iq>=160?'Highly gifted':iq>=145?'Profoundly gifted range':iq>=130?'Very superior':iq>=120?'Superior':iq>=110?'High average':iq>=90?'Average':iq>=80?'Low average':iq>=70?'Borderline':'Extremely low'}

/* ---------- state ---------- */
let S=load()||{phase:'cover',idx:0,answers:{},elapsed:0};
function load(){try{return JSON.parse(localStorage.getItem(STORE))}catch(e){return null}}
function save(){try{localStorage.setItem(STORE,JSON.stringify(S))}catch(e){}}
let lastTick=Date.now(), confirmReset=false, confirmSubmit=false;
setInterval(()=>{
  const now=Date.now(),dt=now-lastTick;lastTick=now;
  if(S.phase!=='test'||document.hidden)return;
  S.elapsed+=Math.min(dt,2000);
  if(S.elapsed>=LIMIT){S.elapsed=LIMIT;finish();return}
  save();paintClock();
},500);
document.addEventListener('visibilitychange',()=>{lastTick=Date.now()});
function fmt(ms){const s=Math.max(0,Math.ceil(ms/1000));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function paintClock(){const el=document.getElementById('clock');if(el){const left=LIMIT-S.elapsed;el.textContent=fmt(left);el.classList.toggle('low',left<5*60*1000)}}
function finish(){S.phase='done';confirmSubmit=false;save();render();window.scrollTo(0,0)}

/* ---------- views ---------- */
const app=document.getElementById('app');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function render(){
  if(S.phase==='cover')return renderCover();
  if(S.phase==='test')return renderTest();
  return renderResults();
}
function renderCover(){
  const counts=SECS.map((_,k)=>ITEMS.filter(i=>i.sec===k).length);
  app.innerHTML=`<div class="pad stack" style="gap:22px">
   <div class="formhead"><div class="stack" style="gap:8px"><span class="label">Fluid reasoning battery · Form A</span><h1>High Range<br>IQ Test<span class="cursor"></span></h1></div>
   <span class="label mono" style="text-align:right">Ceiling<br><b style="font-size:22px;color:var(--ink)">IQ 209</b></span></div>
   <div class="facts"><div><span class="label">Items</span><b>${ITEMS.length}</b></div><div><span class="label">Time limit</span><b>70:00</b></div><div><span class="label">Score range</span><b>40–209</b></div></div>
   <p>This test uses the item formats that carry most of the weight on standard intelligence tests: matrix puzzles in the style of Raven’s Advanced Progressive Matrices and the WAIS matrix subtest, number series, and verbal and logical reasoning. Items get harder within each section. The Extended Range section is built in the style of high-range societies’ tests and separates scores from 150 to above 200.</p>
   <table class="subtests"><tr><th>Section</th><th>What it measures</th><th style="text-align:right">Items</th></tr>
    <tr><td>Matrix Reasoning</td><td>Finding the rules in a 3×3 grid of figures and picking the missing piece</td><td class="n">${counts[0]}</td></tr>
    <tr><td>Number Series</td><td>Working out the rule behind a sequence and typing the next number</td><td class="n">${counts[1]}</td></tr>
    <tr><td>Verbal &amp; Logical</td><td>Analogies, deduction and multi-step logic</td><td class="n">${counts[2]}</td></tr>
    <tr><td>Extended Range</td><td>Very hard matrices, series, logic and combinatorics for scores above 150</td><td class="n">${counts[3]}</td></tr></table>
   <div class="stack" style="gap:8px"><span class="label">Instructions</span>
   <p>Work without a calculator, notes or search. You can skip items and come back using the bubbles at the top. Unanswered items count as wrong, so guess before time runs out. Your progress saves automatically and the clock pauses if you leave this tab, so clicking away won’t lose your place.</p></div>
   <p class="notice">Scores are estimated from each item’s difficulty using item response theory. This test has not been normed on a population sample, so treat the result as a well-built estimate. Only a clinician-given test such as the WAIS-5 or Stanford-Binet 5 produces an official score.</p>
   <div class="row"><button class="btn" id="go">Begin test</button><span class="label">The clock starts when you press Begin</span></div>
  </div>`;
  document.getElementById('go').onclick=()=>{S={phase:'test',idx:0,answers:{},elapsed:0};save();render()};
}
function renderTest(){
  const it=ITEMS[S.idx],n=S.idx+1,inSec=ITEMS.filter(i=>i.sec===it.sec),pos=inSec.indexOf(it)+1;
  const bubbles=ITEMS.map((x,i)=>`<button class="bub ${S.answers[i]!==undefined&&S.answers[i]!==''?'done':''} ${i===S.idx?'cur':''} ${i>0&&ITEMS[i-1].sec!==x.sec?'sec':''}" data-go="${i}" aria-label="Item ${i+1}">${i+1}</button>`).join('');
  const answered=Object.values(S.answers).filter(v=>v!==undefined&&v!=='').length;
  let body='';
  const cur=S.answers[S.idx];
  if(it.kind==='mx'){
    let cells='';
    for(let r=0;r<3;r++)for(let c=0;c<3;c++)cells+=`<div class="cell">${r===2&&c===2?'<div class="qmark">?</div>':cellSVG(cellAt(it.spec,r,c))}</div>`;
    body=`<p class="prompt">Which figure completes the pattern?</p><div class="matrix" role="img" aria-label="3 by 3 figure matrix with the bottom-right cell missing">${cells}</div>
    <div class="opts">${it.opts.map((o,i)=>`<button class="opt ${cur===i?'sel':''}" data-pick="${i}" aria-label="Option ${'ABCDEFGH'[i]}" aria-pressed="${cur===i}"><span class="let">${'ABCDEFGH'[i]}</span><div class="art">${cellSVG(o)}</div></button>`).join('')}</div>`;
  }else if(it.kind==='ns'){
    body=`<p class="prompt">What number comes next?</p><div class="series">${esc(it.seq)}, <span class="blank">${cur?esc(cur):'?'}</span></div>
    <div class="free"><label class="label" for="ans">Your answer</label><input id="ans" inputmode="numeric" autocomplete="off" value="${cur?esc(cur):''}"></div>`;
  }else if(it.kind==='free'){
    body=`<p class="prompt">${esc(it.q)}</p>${it.sub?`<div class="series" style="font-size:clamp(17px,4vw,23px)">${esc(it.sub)}</div>`:''}
    <div class="free"><label class="label" for="ans">Your answer</label><input id="ans" ${it.free==='num'?'inputmode="numeric"':''} autocomplete="off" value="${cur?esc(cur):''}"></div>`;
  }else{
    body=`<p class="prompt">${esc(it.q)}</p><div class="txtopts">${it.o.map((o,i)=>`<button class="opt txtopt ${cur===i?'sel':''}" data-pick="${i}" aria-pressed="${cur===i}"><span class="dot">${'ABCDE'[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>`;
  }
  const last=S.idx===ITEMS.length-1;
  app.innerHTML=`<div class="bar"><div class="bar-in"><span class="label">Form A · ${answered}/${ITEMS.length} answered</span><span class="clock" id="clock">${fmt(LIMIT-S.elapsed)}</span></div><div class="bubbles">${bubbles}</div></div>
  <div class="pad stack" style="gap:20px">
   <div class="itemhead"><span class="label">${SECS[it.sec]} · ${pos} of ${inSec.length}</span><span class="qnum">Item ${n} / ${ITEMS.length}</span></div>
   ${body}
   <hr>
   ${confirmSubmit?`<div class="confirm stack" style="gap:10px"><p><b>Hand in now?</b> ${ITEMS.length-answered} item${ITEMS.length-answered===1?' is':'s are'} unanswered and will count as wrong.</p><div class="row"><button class="btn" id="yes">Hand in</button><button class="btn ghost" id="no">Keep working</button></div></div>`:''}
   <div class="nav"><button class="btn ghost" id="prev" ${S.idx===0?'disabled':''}>Back</button>
    <div class="row"><button class="btn ghost" id="submit">Hand in</button><button class="btn" id="next">${last?'Review':'Next'}</button></div></div>
  </div>`;
  paintClock();
  app.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(+b.dataset.go));
  app.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{S.answers[S.idx]=+b.dataset.pick;save();render()});
  const inp=document.getElementById('ans');
  if(inp){inp.oninput=()=>{S.answers[S.idx]=inp.value;save();const bl=app.querySelector('.blank');if(bl)bl.textContent=inp.value||'?';
      const bb=app.querySelector(`[data-go="${S.idx}"]`);bb.classList.toggle('done',inp.value.trim()!=='')};
    inp.onkeydown=e=>{if(e.key==='Enter')go(S.idx+1)};
    if(matchMedia('(pointer:fine)').matches)inp.focus();}
  document.getElementById('prev').onclick=()=>go(S.idx-1);
  document.getElementById('next').onclick=()=>last?(confirmSubmit=true,render()):go(S.idx+1);
  document.getElementById('submit').onclick=()=>{confirmSubmit=true;render()};
  const y=document.getElementById('yes');if(y){y.onclick=finish;document.getElementById('no').onclick=()=>{confirmSubmit=false;render()}}
}
function go(i){if(i<0||i>=ITEMS.length)return;S.idx=i;confirmSubmit=false;save();render();window.scrollTo(0,0)}
function curveSVG(iq){
  const W=600,H=150,x=v=>((v-40)/(215-40))*W,y=z=>H-22-(Math.exp(-z*z/2))*(H-38);
  let d='',fillD=`M${x(40)},${H-22}`;
  for(let v=40;v<=215;v+=1){const z=(v-100)/15;d+=(v===40?'M':'L')+x(v).toFixed(1)+','+y(z).toFixed(1);if(v<=iq)fillD+=`L${x(v).toFixed(1)},${y(z).toFixed(1)}`}
  fillD+=`L${x(Math.max(40,Math.min(iq,215)))},${H-22}Z`;
  const ticks=[55,70,85,100,115,130,145,160,175,190,205].map(v=>`<line x1="${x(v)}" y1="${H-22}" x2="${x(v)}" y2="${H-17}" style="stroke:var(--muted)"/><text x="${x(v)}" y="${H-4}" text-anchor="middle" style="fill:var(--muted);font:11px var(--f-mono)">${v}</text>`).join('');
  const mx=x(Math.max(40,Math.min(215,iq)));
  return `<svg class="curve" viewBox="0 0 ${W} ${H}" role="img" aria-label="Normal curve with your score marked at ${iq}">
   <path d="${fillD}" style="fill:var(--accent-soft)"/><path d="${d}" style="fill:none;stroke:var(--ink);stroke-width:1.6"/>
   <line x1="0" y1="${H-22}" x2="${W}" y2="${H-22}" style="stroke:var(--rule)"/>${ticks}
   <line x1="${mx}" y1="8" x2="${mx}" y2="${H-22}" style="stroke:var(--accent);stroke-width:2.5"/>
   <text x="${mx}" y="12" dx="${iq>190?-6:6}" text-anchor="${iq>190?'end':'start'}" style="fill:var(--accent);font:600 12px var(--f-mono)">${iq}</text></svg>`;
}
function renderResults(){
  const R=scoreAll(S.answers);R.iq=Math.max(40,R.iq);const pct=phi(R.theta)*100,rarer=1/(1-phi(R.theta));
  const lo=Math.round(R.iq-1.96*R.se),hi=Math.round(R.iq+1.96*R.se);
  const pctTxt=pct>=99.9?'>99.9':pct<0.1?'<0.1':pct.toFixed(pct>=99?1:0);
  const rows=SECS.map((s,k)=>{const its=ITEMS.map((x,i)=>[x,i]).filter(([x])=>x.sec===k);const ok=its.filter(([,i])=>R.resp[i]).length;return `<tr><td>${s}</td><td class="n">${ok} / ${its.length}</td></tr>`}).join('');
  const total=R.resp.filter(Boolean).length;
  const review=ITEMS.map((it,i)=>{
    const a=S.answers[i],ok=R.resp[i];
    let yours='—',right='';
    if(it.kind==='mx'){yours=a===undefined?'—':'ABCDEFGH'[a];right='ABCDEFGH'[it.a]}
    else if(it.kind==='vb'){yours=a===undefined?'—':it.o[a];right=it.o[it.a]}
    else{yours=a?a:'—';right=it.ans}
    const q=it.kind==='mx'?'Matrix':it.kind==='ns'?esc(it.seq)+', ?':esc(it.q);
    return `<div class="rv"><span class="m ${ok?'ok':'no'}">${String(i+1).padStart(2,'0')} ${ok?'✓':'✗'}</span><div class="stack" style="gap:3px"><span>${q}</span>
      <span>Your answer: <b>${esc(yours)}</b>${ok?'':` · Correct: <b>${esc(right)}</b>`}</span><span class="ex">${esc(it.ex)}</span></div></div>`}).join('');
  app.innerHTML=`<div class="pad stack" style="gap:24px">
   <div class="formhead"><div class="stack" style="gap:8px"><span class="label">Score report · Form A</span><h2>High Range IQ Test</h2></div><span class="label mono">${total}/${ITEMS.length} correct</span></div>
   <div class="score"><div class="big mono">${R.iq}</div>
    <div class="stack" style="gap:6px"><span class="label">Estimated full-scale IQ</span><p style="font-size:20px;font-family:var(--f-display);font-weight:600">${band(R.iq)}</p>
    <p class="mono" style="font-size:14.5px">95% range ${lo}–${hi} · percentile ${pctTxt}${R.iq>=115?` · about 1 in ${Math.round(rarer).toLocaleString()}`:''}</p></div></div>
   ${curveSVG(R.iq)}
   <table class="tbl"><tr><th>Section</th><th style="text-align:right">Correct</th></tr>${rows}</table>
   <p class="notice">Estimate based on item difficulty (mean 100, SD 15), not on a norming sample. Scores from free online tests run several points higher than proctored ones. Retaking the same form inflates the score because you’ve seen the answers.</p>
   ${confirmReset?`<div class="confirm stack" style="gap:10px"><p><b>Erase this result and start over?</b></p><div class="row"><button class="btn" id="rsy">Erase and restart</button><button class="btn ghost" id="rsn">Cancel</button></div></div>`:`<div class="row"><button class="btn ghost" id="reset">Start over</button></div>`}
   <div class="stack" style="gap:6px"><span class="label">Answer review</span><div class="review">${review}</div></div>
  </div>`;
  const r=document.getElementById('reset');if(r)r.onclick=()=>{confirmReset=true;render()};
  const ry=document.getElementById('rsy');if(ry){ry.onclick=()=>{confirmReset=false;S={phase:'cover',idx:0,answers:{},elapsed:0};save();render()};document.getElementById('rsn').onclick=()=>{confirmReset=false;render()}}
}
render();

/* ---------- digital rain background ---------- */
(function rain(){
  const cv=document.getElementById('rain'),ctx=cv.getContext('2d');
  const glyphs='アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789Z:."=*+-<>¦';
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W,H,fs,cols,drops;
  function size(){
    const dpr=Math.min(window.devicePixelRatio||1,2);
    W=innerWidth;H=innerHeight;cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
    fs=W<600?14:18;cols=Math.ceil(W/fs);
    drops=Array.from({length:cols},()=>Math.random()*-H/fs);
    ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
  }
  function frame(){
    ctx.fillStyle='rgba(0,0,0,0.08)';ctx.fillRect(0,0,W,H);
    ctx.font=fs+'px "Share Tech Mono", monospace';
    for(let i=0;i<cols;i++){
      const y=drops[i]*fs, ch=glyphs[Math.floor(Math.random()*glyphs.length)];
      ctx.fillStyle=Math.random()<0.04?'#D8FFE0':'#00C732';
      ctx.fillText(ch,i*fs,y);
      if(y>H&&Math.random()>0.975)drops[i]=0;
      drops[i]+=1;
    }
  }
  size();addEventListener('resize',size);
  if(reduce){for(let k=0;k<60;k++)frame();return}
  let last=0;(function loop(t){requestAnimationFrame(loop);if(document.hidden||t-last<50)return;last=t;frame()})(0);
})();
