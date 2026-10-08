import * as E from './engine.js';
import {validatePosition} from './position.js';
export const MAX_HISTORY=64;
const assert=(condition,message)=>{if(!condition)throw Error(message);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const keys=(value,allowed)=>{assert(value!==null&&typeof value==='object'&&!Array.isArray(value),'实验记录须为对象');for(const key of Object.keys(value))assert(allowed.includes(key),'实验记录包含未知字段 '+key);};
const square=value=>Array.isArray(value)&&value.length===2&&value.every(Number.isInteger)&&E.inside(...value);

export function createSession(board,side,fixture='lesson'){
  const result=validatePosition(board,side);assert(result.canSearch,result.errors.join(' '));
  return{board:E.clone(result.board),side,initial:E.clone(result.board),initialSide:side,fixture,history:[]};
}
export function validateSession(input,{fixtureIds=[]}={}){
  keys(input,['board','side','initial','initialSide','fixture','history']);
  assert(['lesson','custom',...fixtureIds].includes(input.fixture),'未知实验局面');
  const initial=validatePosition(input.initial,input.initialSide),current=validatePosition(input.board,input.side);
  assert(initial.canSearch,'实验初始局面无效：'+initial.errors.join(' '));
  // A manual turn switch may be an inspect-only state; it cannot enter search/play.
  assert(current.structurallyValid,'实验棋盘无效：'+current.errors.join(' '));
  assert(Array.isArray(input.history)&&input.history.length<=MAX_HISTORY,'实验历史最多64步');
  const board=E.clone(initial.board);let side=input.initialSide;const history=[];
  for(const record of input.history){
    keys(record,['kind','sideBefore','selectionBefore',...(record?.kind==='move'?['move','captured']:[])]);
    assert(['move','side'].includes(record.kind)&&record.sideBefore===side,'实验历史行动方不连续');
    assert(record.selectionBefore===null||square(record.selectionBefore),'历史选中坐标无效');
    if(record.kind==='move'){
      assert(validatePosition(board,side).canPlay,'无效局面不能保存为合法着法历史');
      assert(Array.isArray(record.move)&&record.move.length===4&&record.move.every(Number.isInteger)&&E.legalMoves(board,side).some(move=>same(move,record.move)),'历史含非法着法');
      assert(record.captured===board[record.move[3]][record.move[2]],'历史被吃棋子不匹配');
      E.makeMove(board,record.move);
    }
    side=E.opponent(side);history.push(structuredClone(record));
  }
  assert(side===input.side&&same(board,current.board),'历史不能还原当前棋盘或行动方');
  return{board:current.board,side,initial:initial.board,initialSide:input.initialSide,fixture:input.fixture,history};
}
function room(session){assert(session.history.length<MAX_HISTORY,'最多记录64步；请先撤销或重置再继续。');}
export function playMove(session,move,selectionBefore=null){
  room(session);assert(validatePosition(session.board,session.side).canPlay,'当前局面不能正常走子，请检查行棋方或摆棋修改。');
  assert(E.legalMoves(session.board,session.side).some(value=>same(value,move)),'不是当前方的合法着法');
  const next=structuredClone(session),captured=E.makeMove(next.board,move);
  next.history.push({kind:'move',move:move.slice(),captured,sideBefore:next.side,selectionBefore});next.side=E.opponent(next.side);return next;
}
export function switchSide(session,selectionBefore=null){room(session);const next=structuredClone(session);next.history.push({kind:'side',sideBefore:next.side,selectionBefore});next.side=E.opponent(next.side);return next;}
export function undo(session){
  assert(session.history.length,'尚无可撤销的操作');const next=structuredClone(session),record=next.history.pop();
  if(record.kind==='move')E.unmakeMove(next.board,record.move,record.captured);
  next.side=record.sideBefore;return{session:next,record,selection:record.selectionBefore};
}
export function reset(session){return createSession(session.initial,session.initialSide,session.fixture);}
export function simulate(session,move,values=E.VALUES){
  assert(validatePosition(session.board,session.side).canPlay,'当前局面不能试走，请检查行棋方或摆棋修改。');
  assert(E.legalMoves(session.board,session.side).some(value=>same(value,move)),'不是当前方的合法着法');
  const scratch=E.clone(session.board),captured=E.makeMove(scratch,move),afterSide=E.opponent(session.side);
  let result;
  try{result={move:move.slice(),captured,beforeScore:E.evaluate(session.board,values),afterScore:E.evaluate(scratch,values),afterBoard:E.clone(scratch),afterSide,terminal:E.terminalScore(scratch,afterSide),restored:true};}
  finally{E.unmakeMove(scratch,move,captured);assert(same(scratch,session.board),'模拟未完整还原棋盘');}
  return result;
}
