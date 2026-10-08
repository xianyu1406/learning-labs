/** Shared Xiangqi 2D board contract: '.' empty; red uppercase; H horse/E elephant.
 * x=0..8, y=0..9 (black top). Scores always red-fixed. Depth is remaining plies.
 */
export const VALUES = {K:0,A:200,E:200,H:400,R:900,C:450,P:100};
export const MATE=100000;
export const emptyBoard=()=>Array.from({length:10},()=>Array(9).fill('.'));
export const board=pieces=>{const b=emptyBoard(),seen=new Set();for(const [x,y,p] of pieces){checkCoordinate(x,y);if(typeof p!=='string'||p.length!==1||!'.KAEHRCPkaehrcp'.includes(p))throw Error('棋子编码无效');const key=x+','+y;if(seen.has(key))throw Error('重复摆放坐标');seen.add(key);b[y][x]=p;}return b};
export const clone=b=>b.map(r=>r.slice());
export const inside=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<9&&y>=0&&y<10;
export const owner=p=>p==='.'?null:p===p.toUpperCase()?'red':'black';
export const opponent=s=>{checkSide(s);return s==='red'?'black':'red'};
export const palace=(x,y,s)=>{checkSide(s);return inside(x,y)&&x>=3&&x<=5&&(s==='red'?y>=7&&y<=9:y>=0&&y<=2)};
export function locateGeneral(b,s){const k=s==='red'?'K':'k';for(let y=0;y<10;y++)for(let x=0;x<9;x++)if(b[y][x]===k)return[x,y];return null}
const cmp=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0};
export function targets(b,x,y){checkCoordinate(x,y);const p=b[y][x];if(p==='.')return[];const s=owner(p),k=p.toUpperCase(),out=[];const add=(nx,ny)=>{if(inside(nx,ny)&&owner(b[ny][nx])!==s)out.push([nx,ny])};
 if(k==='R'||k==='C')for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){let nx=x+dx,ny=y+dy,screen=false;while(inside(nx,ny)){const q=b[ny][nx];if(k==='R'){if(q==='.')out.push([nx,ny]);else{if(owner(q)!==s)out.push([nx,ny]);break}}else if(!screen){if(q==='.')out.push([nx,ny]);else screen=true}else if(q!=='.'){if(owner(q)!==s)out.push([nx,ny]);break}nx+=dx;ny+=dy}}
 else if(k==='H')for(const[dx,dy]of[[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[-1,2],[1,-2],[-1,-2]]){const lx=x+(Math.abs(dx)===2?dx/2:0),ly=y+(Math.abs(dy)===2?dy/2:0);if(inside(lx,ly)&&b[ly][lx]==='.')add(x+dx,y+dy)}
 else if(k==='E')for(const[dx,dy]of[[2,2],[2,-2],[-2,2],[-2,-2]]){const nx=x+dx,ny=y+dy;if(!inside(nx,ny)||(s==='red'?ny<5:ny>4))continue;if(b[y+dy/2][x+dx/2]==='.')add(nx,ny)}
 else if(k==='A')for(const[dx,dy]of[[1,1],[1,-1],[-1,1],[-1,-1]]){if(palace(x+dx,y+dy,s))add(x+dx,y+dy)}
 else if(k==='K'){for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])if(palace(x+dx,y+dy,s))add(x+dx,y+dy);const e=locateGeneral(b,opponent(s));if(e&&e[0]===x){let clear=true;for(let yy=Math.min(y,e[1])+1;yy<Math.max(y,e[1]);yy++)if(b[yy][x]!=='.')clear=false;if(clear)out.push(e)}}
 else if(k==='P'){add(x,y+(s==='red'?-1:1));if(s==='red'?y<=4:y>=5){add(x-1,y);add(x+1,y)}}
 return out.sort(cmp).filter((m,i,a)=>!i||cmp(m,a[i-1])!==0)
}
export function pseudoMoves(b,s){const out=[];for(let y=0;y<10;y++)for(let x=0;x<9;x++)if(owner(b[y][x])===s)for(const[nx,ny]of targets(b,x,y))out.push([x,y,nx,ny]);return out.sort(cmp)}
export function makeMove(b,move){checkMove(b,move);const[x,y,nx,ny]=move;if(b[y][x]==='.')throw Error('起点没有棋子');const c=b[ny][nx];b[ny][nx]=b[y][x];b[y][x]='.';return c}
export function unmakeMove(b,move,c){checkMove(b,move);const[x,y,nx,ny]=move;if(b[y][x]!=='.'||b[ny][nx]==='.'||typeof c!=='string'||c.length!==1||!'.KAEHRCPkaehrcp'.includes(c))throw Error('撤销状态无效');b[y][x]=b[ny][nx];b[ny][nx]=c}
export function inCheck(b,s){const g=locateGeneral(b,s);if(!g)return true;for(let y=0;y<10;y++)for(let x=0;x<9;x++)if(owner(b[y][x])===opponent(s)&&targets(b,x,y).some(m=>cmp(m,g)===0))return true;return false}
export function legalMoves(b,s){if(!locateGeneral(b,s))return[];const out=[];for(const m of pseudoMoves(b,s)){if(b[m[3]][m[2]].toUpperCase()==='K')continue;const c=makeMove(b,m),safe=!inCheck(b,s);unmakeMove(b,m,c);if(safe)out.push(m)}return out}
export function terminalScore(b,s){checkSide(s);if(!locateGeneral(b,'red'))return-MATE;if(!locateGeneral(b,'black'))return MATE;if(!legalMoves(b,s).length)return s==='red'?-MATE:MATE;return null}
export function materialScore(b,values=VALUES){checkBoard(b);checkWeights(values);let v=0;for(const row of b)for(const p of row)if(p!=='.')v+=values[p.toUpperCase()]*(owner(p)==='red'?1:-1);return v}
export function pawnBonus(p,x,y){return p==='P'?Math.max(0,6-y)*10+(y<=4?30:0):p==='p'?-(Math.max(0,y-3)*10+(y>=5?30:0)):0}
export function evaluationParts(b,values=VALUES){const material=materialScore(b,values);let advance=0,river=0;for(let y=0;y<10;y++)for(let x=0;x<9;x++){const p=b[y][x];if(p==='P'){advance+=Math.max(0,6-y)*10;river+=y<=4?30:0}else if(p==='p'){advance-=Math.max(0,y-3)*10;river-=y>=5?30:0}}const position=advance+river,rawTotal=material+position,staticScore=Math.max(-MATE+1,Math.min(MATE-1,rawTotal));return{material,advance,river,position,rawTotal,staticScore,clampDelta:staticScore-rawTotal}}
export function evaluate(b,values=VALUES){return evaluationParts(b,values).staticScore}

function checkSide(s){if(!['red','black'].includes(s))throw Error('行动方须为red或black');}
function checkCoordinate(x,y){if(!Number.isInteger(x)||!Number.isInteger(y)||!inside(x,y))throw Error('坐标须为界内整数：x=0..8，y=0..9');}
function checkBoard(b){if(!Array.isArray(b)||b.length!==10||b.some(r=>!Array.isArray(r)||r.length!==9)||new Set(b).size!==10)throw Error('棋盘须为10×9独立数组');for(let y=0;y<10;y++)for(let x=0;x<9;x++){const p=b[y]?.[x];if(typeof p!=='string'||p.length!==1||!'.KAEHRCPkaehrcp'.includes(p))throw Error('棋子编码无效或缺失格');}}
function checkMove(b,m){if(!Array.isArray(m)||m.length!==4)throw Error('着法须为四个坐标');checkCoordinate(m[0],m[1]);checkCoordinate(m[2],m[3]);if(m[0]===m[2]&&m[1]===m[3])throw Error('起终点须不同');checkBoard(b);}
function checkWeights(v){if(!v||typeof v!=='object'||Object.keys(VALUES).some(k=>typeof v[k]!=='number'||!Number.isFinite(v[k])||v[k]<0||v[k]>10000)||v.K!==0)throw Error('七种权重须为0–10000有限数，将帅权重须为0');}
export function search(input,side,depth,{prune=true,values=VALUES,order='lex',maxNodes=60000}={}){
 if(!Number.isInteger(depth)||depth<0||depth>6)throw Error('深度须为 0–6 的整数');
 if(!['red','black'].includes(side))throw Error('行动方无效');
 checkBoard(input);checkWeights(values);
 if(typeof prune!=='boolean')throw Error('prune须为布尔值');
 if(!['lex','capture'].includes(order))throw Error('同分排序须为lex或capture');
 if(!Number.isInteger(maxNodes)||maxNodes<1||maxNodes>60000)throw Error('节点预算须为1–60000整数');
 const b=clone(input),nodes=[],events=[];let skipped=0;
 const sortMoves=ms=>order==='capture'?ms.sort((a,c)=>((values[b[c[3]][c[2]].toUpperCase()]||0)-(values[b[a[3]][a[2]].toUpperCase()]||0))||cmp(a,c)):ms;
 function visit(s,d,parent,move,alpha,beta){
  const alpha0=alpha,beta0=beta;
  if(nodes.length>=maxNodes)throw Error('搜索节点超过教学上限，请降低深度');
  const id=nodes.length,n={id,parent,move,side:s,depth:d,board:clone(b),children:[],bestChild:null,score:null,alpha,beta,skipped:[]};
  nodes.push(n);if(parent!==null)nodes[parent].children.push(id);events.push({type:'enter',id});
  const t=terminalScore(b,s);
  if(t!==null||d===0){n.score=t??evaluate(b,values);n.reason=t!==null?'terminal':'evaluation';n.bound='exact';events.push({type:'return',id,score:n.score,bound:n.bound});return n.score}
  const ms=sortMoves(legalMoves(b,s));let best=s==='red'?-Infinity:Infinity;
  for(let i=0;i<ms.length;i++){
   const m=ms[i],c=makeMove(b,m);let score;
   try{score=visit(opponent(s),d-1,id,m,alpha,beta)}finally{unmakeMove(b,m,c)}
   if(s==='red'?score>best:score<best){best=score;n.bestChild=n.children.at(-1)}
   if(s==='red')alpha=Math.max(alpha,best);else beta=Math.min(beta,best);
   n.alpha=alpha;n.beta=beta;
   if(prune&&alpha>=beta&&i<ms.length-1){n.skipped=ms.slice(i+1);skipped+=n.skipped.length;events.push({type:'prune',id,alpha,beta,moves:n.skipped});break}
  }
  n.score=best;n.bound=!prune?'exact':best<=alpha0?'upper':best>=beta0?'lower':'exact';events.push({type:'return',id,score:best,bound:n.bound});return best;
 }
 const score=visit(side,depth,null,null,-Infinity,Infinity),principalNodes=[0],line=[];
 let node=nodes[0];
 while(node.bestChild!==null){
  const child=nodes[node.bestChild];
  if(node.bound!=='exact'||child.bound!=='exact')throw Error('主要变化线出现未核实的剪枝界，结果不展示。');
  line.push(child.move.slice());principalNodes.push(child.id);node=child;
 }
 return{score,bestMove:line[0]??null,line,principalNodes,nodes,events,visited:nodes.length,prunedMoves:skipped,depth,side,algorithm:prune?'alphabeta':'minimax'};
}
export const moveText=m=>m?`(${m[0]},${m[1]}) → (${m[2]},${m[3]})`:'无着法';
