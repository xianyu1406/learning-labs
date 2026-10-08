import * as E from './engine.js';

// Editor boundary: core attack helpers still accept deliberate teaching counterexamples.
export function validatePosition(input,side){
  const errors=[],warnings=[];
  const shape=Array.isArray(input)&&input.length===10&&Array.from(input).every(row=>(Array.isArray(row)||typeof row==='string')&&row.length===9);
  if(!shape)return{errors:['棋盘须为10行，每行9格。'],warnings,board:null,canDisplay:false,canInspect:false,structurallyValid:false,canPlay:false,canSearch:false};
  const board=input.map(row=>typeof row==='string'?[...row]:row.slice());
  const codes=board.every(row=>Array.from(row).every(piece=>typeof piece==='string'&&piece.length===1&&'.KAEHRCPkaehrcp'.includes(piece)));
  if(!codes)errors.push('每格只能是 . 或 K/A/E/H/R/C/P（红方大写，黑方小写）。');
  if(!['red','black'].includes(side))errors.push('行动方须为red或black。');
  if(codes){
    for(const colour of ['red','black']){
      const counts={K:0,A:0,E:0,H:0,R:0,C:0,P:0};
      for(let y=0;y<10;y++)for(let x=0;x<9;x++){
        const piece=board[y][x];if(E.owner(piece)!==colour)continue;
        const kind=piece.toUpperCase();counts[kind]++;
        if(['K','A'].includes(kind)&&!E.palace(x,y,colour))errors.push(`${colour==='red'?'红':'黑'}方${kind==='K'?'将帅':'仕士'}(${x},${y})须在己方九宫。`);
        if(kind==='E'&&(colour==='red'?y<5:y>4))errors.push(`象相(${x},${y})不能在对方半场。`);
      }
      if(counts.K!==1)errors.push(`${colour==='red'?'红':'黑'}方须恰有一个将帅。`);
      for(const kind of ['A','E','H','R','C','P'])if(counts[kind]>(kind==='P'?5:2))errors.push(`${colour==='red'?'红':'黑'}方${kind}超过原库存上限。`);
    }
  }
  const structurallyValid=errors.length===0;
  if(structurallyValid){
    const red=E.inCheck(board,'red'),black=E.inCheck(board,'black');
    if(red&&black)errors.push('双方同时受将（含将帅照面），不能作为正常行棋局面。请添加屏障或调整棋子。');
    else if(E.inCheck(board,E.opponent(side)))errors.push('非行动方正受将；请换成受将的一方行棋，或修改局面。');
    warnings.push('教学构造局面：未证明开局可达性；长将、长捉和重复判罚不在本版范围。');
  }
  return{errors,warnings,board,canDisplay:true,canInspect:codes,structurallyValid,canPlay:errors.length===0,canSearch:errors.length===0};
}
