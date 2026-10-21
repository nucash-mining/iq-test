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
      if(a==='rot')out.push(Array.isArray(R.k)?`Each row turns by its own step per cell: ${R.k.map(k=>k*90+'°').join(', then ')} clockwise.`:'The figure turns 90° clockwise from cell to cell.');
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
let ITEMS=[], SECS=[], LIMIT=0, STORE='', MODE='A';
const RCEIL=191;
const addMx=(s,i,sec)=>{const o=buildOptions(s,i*7919+13);ITEMS.push({sec,kind:'mx',b:s.b,c:1/8,spec:s,opts:o.opts,a:o.correct,ex:explain(s)})};
function buildFormA(){
  ITEMS=[];
  MX.forEach((s,i)=>addMx(s,i,0));
  NS.forEach(s=>ITEMS.push({sec:1,kind:'ns',b:s.b,c:0,...s}));
  VB.forEach(s=>ITEMS.push({sec:2,kind:s.free?'free':'vb',c:s.free?0:1/s.o.length,...s}));
  EX.forEach((s,i)=>{
    if(s.mx)addMx({b:s.b,...s.mx},100+i,3);
    else if(s.ns)ITEMS.push({sec:3,kind:'ns',c:0,...s});
    else ITEMS.push({sec:3,kind:s.free?'free':'vb',c:s.free?0:1/s.o.length,...s});
  });
}

/* ---------- Random Form: new puzzles generated from a seed ---------- */
const ri=(R,a,b)=>a+Math.floor(R()*(b-a+1));
const pick=(R,a)=>a[Math.floor(R()*a.length)];
/* Matrix difficulty levels: b, number of changing attributes, hardest rule tier allowed */
const MLEVELS=[{b:-2.5,n:1,h:0},{b:-1.6,n:2,h:0},{b:-0.7,n:2,h:1},{b:0.2,n:3,h:1},{b:1.1,n:3,h:2},{b:2.0,n:4,h:2},{b:3.0,n:5,h:3},{b:4.2,n:5,h:3}];
function maskRows(R,ok){const rows=[];while(rows.length<3){const a=ri(R,1,15),b=ri(R,1,15);if(ok(a,b))rows.push([a,b])}return rows}
function genRule(attr,h,R){
  const d3=dom=>shuffle(dom.slice(),R).slice(0,3), o=[];
  const SH=[0,1,2,3,4,5];
  if(attr==='shape'){o.push([0,()=>({t:'row',v:d3(SH)})]);o.push([1,()=>({t:'dist',v:d3(SH),d:pick(R,[1,-1])})])}
  if(attr==='count'){
    o.push([0,()=>({t:'prog',s:[ri(R,1,2),ri(R,1,2),ri(R,1,2)],k:1})]);
    o.push([1,()=>({t:'dist',v:shuffle(pick(R,[[1,2,3],[2,3,4]]).slice(),R),d:pick(R,[1,-1])})]);
    o.push([2,()=>({t:'add',v:shuffle([[1,1],[1,2],[2,1],[1,3],[3,1],[2,2]],R).slice(0,3)})]);
    o.push([2,()=>({t:'minus',v:shuffle([[2,1],[3,1],[3,2],[4,1],[4,2],[4,3]],R).slice(0,3)})]);
  }
  if(attr==='fill'||attr==='size'){
    o.push([0,()=>({t:pick(R,['row','col']),v:shuffle([0,1,2],R)})]);
    o.push([1,()=>({t:'dist',v:shuffle([0,1,2],R),d:pick(R,[1,-1])})]);
  }
  if(attr==='rot'){
    o.push([0,()=>({t:'prog',s:[ri(R,0,3),ri(R,0,3),ri(R,0,3)],k:1,mod:4})]);
    o.push([3,()=>({t:'prog',s:[ri(R,0,3),ri(R,0,3),ri(R,0,3)],k:shuffle([1,2,3],R),mod:4})]);
  }
  if(attr==='lines'){
    o.push([1,()=>({t:'or',v:maskRows(R,(a,b)=>(a|b)!==a&&(a|b)!==b)})]);
    o.push([2,()=>({t:'xor',v:maskRows(R,(a,b)=>a!==b)})]);
    o.push([2,()=>({t:'sub',v:maskRows(R,(a,b)=>(a&~b)!==a&&(a&~b)!==0)})]);
  }
  const avail=o.filter(x=>x[0]<=h), top=Math.max(...avail.map(x=>x[0]));
  const tops=avail.filter(x=>x[0]===top);
  return (R()<0.7?pick(R,tops):pick(R,avail))[1]();
}
function genMatrix(li,R){
  const L=MLEVELS[li];
  for(let tries=0;tries<60;tries++){
    let pool=shuffle(['shape','count','fill','size','lines','rot'].filter(a=>L.h>=1||a!=='lines'),R);
    const chosen=[];
    for(const a of pool){if(chosen.length===L.n)break;if((a==='rot'&&chosen.includes('shape'))||(a==='shape'&&chosen.includes('rot')))continue;chosen.push(a)}
    if(chosen.length<L.n)continue;
    const rules={};chosen.forEach(a=>rules[a]=genRule(a,L.h,R));
    if(!rules.shape)rules.shape={t:'const',v:rules.rot?2:pick(R,[0,1,3,4,5])};
    if(!rules.count)rules.count={t:'const',v:rules.lines?1:ri(R,1,2)};
    if(!rules.fill)rules.fill={t:'const',v:ri(R,0,2)};
    if(!rules.size)rules.size={t:'const',v:rules.lines?pick(R,[0,1]):pick(R,[1,2])};
    if(!rules.rot)rules.rot={t:'const',v:0};
    if(!rules.lines)rules.lines={t:'const',v:0};
    const spec={b:L.b,rules},o=buildOptions(spec,ri(R,1,1e9));
    if(o.correct>=0&&new Set(o.opts.map(key)).size===8)return {spec,o};
  }
  throw new Error('matrix generation failed');
}
const sq=n=>String(n).split('').reduce((t,d)=>t+d*d,0);
/* Number-series templates, easiest to hardest. Each returns the terms with the answer last. */
const SGEN=[
 [-2.2,R=>{const a=ri(R,2,5),r=ri(R,2,3),s=[];for(let i=0;i<5;i++)s.push(a*r**i);return{s,ex:`Each term is ×${r}.`}}],
 [-1.3,R=>{const p=ri(R,3,7),m=ri(R,1,p-1),s=[ri(R,5,20)];for(let i=1;i<8;i++)s.push(s[i-1]+(i%2?p:-m));return{s,ex:`Alternating +${p} and −${m}.`}}],
 [-0.4,R=>{const d=ri(R,2,5),dd=ri(R,2,4),s=[ri(R,1,9)];for(let i=1;i<7;i++)s.push(s[i-1]+d+(i-1)*dd);return{s,ex:`The gaps start at ${d} and grow by ${dd} each time.`}}],
 [0.5,R=>{const a=ri(R,1,9),p=ri(R,2,6),b=ri(R,25,45),q=ri(R,2,5),s=[];for(let i=0;i<9;i++)s.push(i%2?b-((i-1)/2)*q:a+(i/2)*p);return{s,ex:`Two sequences take turns: one goes up by ${p}, the other down by ${q}.`}}],
 [1.0,R=>{const m=ri(R,2,3),c=pick(R,[-1,1,2,3]),s=[ri(R,2,4)];for(let i=1;i<6;i++)s.push(s[i-1]*m+c);return{s,ex:`Each term is ×${m} then ${c>0?'+':'−'}${Math.abs(c)}.`}}],
 [1.6,R=>{const o=ri(R,1,3),s=[ri(R,1,9)];for(let i=1;i<7;i++)s.push(s[i-1]+(i-1+o)**2);return{s,ex:`The gaps are consecutive squares: ${o*o}, ${(o+1)**2}, ${(o+2)**2}, …`}}],
 [2.2,R=>{const o=ri(R,0,1),s=[ri(R,1,4)];for(let i=1;i<8;i++){const n=i+o;s.push(i%2?s[i-1]+n:s[i-1]*n)}return{s,ex:`Alternating + and × with a growing number: +${1+o}, ×${2+o}, +${3+o}, …`}}],
 [2.8,R=>{const k=ri(R,1,3),t=ri(R,0,2),f=[n=>n*n*(n+k),n=>n**3+k*n,n=>n*(n+1)*(n+k)][t],s=[];for(let n=1;n<=6;n++)s.push(f(n));return{s,ex:['n² × (n+'+k+')','n³ + '+k+'n','n × (n+1) × (n+'+k+')'][t]+' for n = 1, 2, 3, …'}}],
 [3.3,R=>{const s=[ri(R,0,2),ri(R,1,3),ri(R,1,4)];for(let i=3;i<8;i++)s.push(s[i-1]+s[i-2]+s[i-3]);return{s,ex:'Each term is the sum of the three before it.'}}],
 [3.6,R=>{const k=ri(R,1,3),s=[ri(R,1,3)];for(let n=2;n<=7;n++)s.push(n*s[n-2]+k);return{s,ex:`Term n = n × previous + ${k}.`}}],
 [3.9,R=>{const r=ri(R,3,5),q=ri(R,2,r-1),s=[];for(let n=0;n<=6;n++)s.push(r**n-q**n);return{s,ex:`${r}ⁿ − ${q}ⁿ for n = 0, 1, 2, …`}}],
 [4.4,R=>{const s=[ri(R,20,99)];for(let i=1;i<9;i++)s.push(sq(s[i-1]));if(s.includes(1))return null;return{s,ex:'Each term is the sum of the squares of the previous term’s digits.'}}],
];
function buildRandom(seed){
  const R=rng(seed);ITEMS=[];
  MLEVELS.forEach((L,li)=>{for(let j=0;j<2;j++){const g=genMatrix(li,R);ITEMS.push({sec:0,kind:'mx',b:L.b,c:1/8,spec:g.spec,opts:g.o.opts,a:g.o.correct,ex:explain(g.spec)})}});
  SGEN.forEach(([b,f])=>{let g=null;for(let t=0;t<80&&!g;t++)g=f(R);
    ITEMS.push({sec:1,kind:'ns',b,c:0,seq:g.s.slice(0,-1).join(', '),ans:String(g.s[g.s.length-1]),ex:g.ex})});
}
const codeOf=seed=>seed.toString(36).toUpperCase();
const seedOf=code=>{const n=parseInt(String(code).trim(),36);return Number.isFinite(n)&&n>0&&n<2**31?n:null};
function formName(){return MODE==='A'?'Form A':'Random form '+codeOf(S.seed||0)}
function activate(mode){
  MODE=mode;try{localStorage.setItem('hrit-active',mode)}catch(e){}
  STORE=mode==='A'?'hrit-form-b-v1':'hrit-random-v1';
  S=load()||{phase:'cover',idx:0,answers:{},elapsed:0};
  if(mode==='A'){buildFormA();SECS=['Matrix Reasoning','Number Series','Verbal & Logical Reasoning','Extended Range'];LIMIT=70*60*1000}
  else{SECS=['Matrix Reasoning','Number Series'];LIMIT=45*60*1000;ITEMS=[];if(S.seed)buildRandom(S.seed)}
  confirmReset=false;confirmSubmit=false;
}

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
let S, lastTick=Date.now(), confirmReset=false, confirmSubmit=false, prefillCode='';
function load(){try{return JSON.parse(localStorage.getItem(STORE))}catch(e){return null}}
function save(){try{localStorage.setItem(STORE,JSON.stringify(S))}catch(e){}}
(function boot(){
  const h=(location.hash||'').slice(1);
  if(/^[A-Za-z0-9]{3,7}$/.test(h)&&seedOf(h)){prefillCode=h.toUpperCase();activate('R');return}
  let m='A';try{m=localStorage.getItem('hrit-active')==='R'?'R':'A'}catch(e){}
  activate(m);
})();
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
function tabs(){
  return `<div class="tabs" role="tablist"><button role="tab" aria-selected="${MODE==='A'}" class="tab ${MODE==='A'?'on':''}" data-mode="A">Form A</button><button role="tab" aria-selected="${MODE==='R'}" class="tab ${MODE==='R'?'on':''}" data-mode="R">Random form</button></div>`;
}
function bindTabs(){app.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{if(b.dataset.mode!==MODE){activate(b.dataset.mode);render();window.scrollTo(0,0)}})}
function renderCoverR(){
  app.innerHTML=`${tabs()}<div class="pad stack" style="gap:22px">
   <div class="formhead"><div class="stack" style="gap:8px"><span class="label">Fluid reasoning battery · Random form</span><h1>Rematch<span class="cursor"></span></h1></div>
   <span class="label mono" style="text-align:right">Ceiling<br><b style="font-size:22px;color:var(--ink)">IQ ${RCEIL}</b></span></div>
   <div class="facts"><div><span class="label">Items</span><b>28</b></div><div><span class="label">Time limit</span><b>45:00</b></div><div><span class="label">Score range</span><b>40–${RCEIL}</b></div></div>
   <p>Every random form is built fresh when you press Begin: 16 matrix puzzles and 12 number series, from very easy to extreme. Nobody has seen these exact puzzles before, including whoever wrote the generator, so it’s a fair way to compare scores.</p>
   <table class="subtests"><tr><th>Section</th><th>What it measures</th><th style="text-align:right">Items</th></tr>
    <tr><td>Matrix Reasoning</td><td>Two puzzles at each of 8 levels, from one changing feature up to five rules at once</td><td class="n">16</td></tr>
    <tr><td>Number Series</td><td>One sequence from each of 12 rule families, easiest to hardest</td><td class="n">12</td></tr></table>
   <div class="stack" style="gap:8px"><label class="label" for="code">Form code (optional)</label>
    <p style="font-size:15px;color:var(--muted)">Leave blank for a brand-new set. To take the same set as a friend, enter the code from their score report.</p>
    <div class="free"><input id="code" maxlength="7" autocomplete="off" spellcheck="false" placeholder="e.g. 1A2B3C" value="${esc(prefillCode)}" style="text-transform:uppercase"></div>
    <p id="codeerr" class="label" style="color:var(--bad)" hidden>That code isn’t valid. Codes are 3 to 7 letters and numbers.</p></div>
   <p class="notice">Item difficulties for random puzzles are set by how many rules each one combines, so scores are estimates. Your Form A result is kept separately.</p>
   <div class="row"><button class="btn" id="go">Begin random form</button><span class="label">The clock starts when you press Begin</span></div>
  </div>`;
  bindTabs();
  document.getElementById('go').onclick=()=>{
    const v=document.getElementById('code').value.trim();
    let seed;
    if(v){seed=/^[A-Za-z0-9]{3,7}$/.test(v)?seedOf(v):null;if(!seed){document.getElementById('codeerr').hidden=false;return}}
    else seed=1+Math.floor(Math.random()*(2**31-2));
    S={phase:'test',idx:0,answers:{},elapsed:0,seed};buildRandom(seed);prefillCode='';save();render();window.scrollTo(0,0)};
}
function renderCover(){
  if(MODE==='R')return renderCoverR();
  const counts=SECS.map((_,k)=>ITEMS.filter(i=>i.sec===k).length);
  app.innerHTML=`${tabs()}<div class="pad stack" style="gap:22px">
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
  bindTabs();
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
  app.innerHTML=`<div class="bar"><div class="bar-in"><span class="label">${formName()} · ${answered}/${ITEMS.length} answered</span><span class="clock" id="clock">${fmt(LIMIT-S.elapsed)}</span></div><div class="bubbles">${bubbles}</div></div>
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
  const site=location.origin+location.pathname;
  const shareUrl=MODE==='R'?site+'#'+codeOf(S.seed):site;
  const shareText=MODE==='R'
    ?`I scored ${R.iq} on the High Range IQ Test (random form ${codeOf(S.seed)}, ${total}/${ITEMS.length} correct). Same puzzles, your turn:`
    :`I scored ${R.iq} on the High Range IQ Test (${total}/${ITEMS.length} correct). Can you beat it?`;
  const xHref='https://x.com/intent/tweet?text='+encodeURIComponent(shareText)+'&url='+encodeURIComponent(shareUrl);
  app.innerHTML=`${tabs()}<div class="pad stack" style="gap:24px">
   <div class="formhead"><div class="stack" style="gap:8px"><span class="label">Score report · ${esc(formName())}</span><h2>High Range IQ Test</h2></div><span class="label mono">${total}/${ITEMS.length} correct</span></div>
   <div class="score"><div class="big mono">${R.iq}</div>
    <div class="stack" style="gap:6px"><span class="label">Estimated full-scale IQ</span><p style="font-size:20px;font-family:var(--f-display);font-weight:600">${band(R.iq)}</p>
    <p class="mono" style="font-size:14.5px">95% range ${lo}–${hi} · percentile ${pctTxt}${R.iq>=115?` · about 1 in ${Math.round(rarer).toLocaleString()}`:''}</p></div></div>
   ${curveSVG(R.iq)}
   <div class="row"><a class="btn xbtn" href="${xHref}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M18.9 1.2h3.7l-8 9.2 9.4 12.4h-7.4l-5.8-7.6-6.6 7.6H.5l8.6-9.8L.1 1.2h7.6l5.2 6.9 6-6.9Zm-1.3 19.4h2L6.5 3.3H4.3l13.3 17.3Z"/></svg>Post on X</a>
    ${MODE==='R'?`<span class="label">Form code <b class="mono" style="color:var(--accent);font-size:15px">${codeOf(S.seed)}</b> · a friend can enter it to take the same puzzles</span>`:''}</div>
   <table class="tbl"><tr><th>Section</th><th style="text-align:right">Correct</th></tr>${rows}</table>
   <p class="notice">Estimate based on item difficulty (mean 100, SD 15), not on a norming sample. Scores from free online tests run several points higher than proctored ones. Retaking the same form inflates the score because you’ve seen the answers.</p>
   ${confirmReset?`<div class="confirm stack" style="gap:10px"><p><b>Erase this result and start over?</b></p><div class="row"><button class="btn" id="rsy">Erase and restart</button><button class="btn ghost" id="rsn">Cancel</button></div></div>`:`<div class="row"><button class="btn ghost" id="reset">Start over</button></div>`}
   <div class="stack" style="gap:6px"><span class="label">Answer review</span><div class="review">${review}</div></div>
  </div>`;
  bindTabs();
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
