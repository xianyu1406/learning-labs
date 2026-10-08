import {validateSession} from './lab-session.js';
// The same contract validates browser restore, imports, and our own exports.
export const MAX_RECORD_BYTES=16_000_000;
export const MAX_CODE_CHARS=100_000;
const owns=(object,key)=>Object.hasOwn(object,key);
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const check=(condition,message)=>{if(!condition)throw Error(message);};
function keys(object,allowed,name){check(record(object),name+'须为对象');for(const key of Object.keys(object))check(allowed.includes(key),name+'包含未知字段 '+key);}
function integer(value,min,max,name){check(Number.isInteger(value)&&value>=min&&value<=max,name+'须为 '+min+'–'+max+' 的整数');return value;}
function date(value,name){check(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value,name+'须为有效日期');return value;}

export function createState(values){return{labs:{},codes:{},passed:[],mistakes:{},hints:{},predictions:{},reflections:{},transfers:{},settings:{depth:2,algo:'alphabeta',order:'lex',values:{...values}},diagnosed:false};}

function validateState(input,exercises,values,options={}){
  keys(input,['labs','codes','passed','mistakes','hints','predictions','reflections','transfers','settings','diagnosed','diagnostic','lastSeen','lastExercise'],'学习记录');
  const state=createState(values),byId=new Map(exercises.map(exercise=>[exercise.id,exercise]));
  function exerciseId(id,name){check(typeof id==='string'&&byId.has(id),name+'含未知练习 '+String(id));return id;}
  function exerciseMap(field,validate){
    if(!owns(input,field))return;
    check(record(input[field]),field+'须为对象');
    for(const [id,value] of Object.entries(input[field]))state[field][exerciseId(id,field)]=validate(value,id);
  }
  exerciseMap('labs',(value,id)=>{
    const session=validateSession(value,options);
    const source=session.fixture==='lesson'?byId.get(id).lab:options.fixtures?.find(fixture=>fixture.id===session.fixture);
    if(source){
      const board=source.board.map(row=>typeof row==='string'?row.split(''):row.slice()),side=source.side??source.sideToMove;
      if(session.initialSide!==side||JSON.stringify(session.initial)!==JSON.stringify(board))session.fixture='custom';
    }
    return session;
  });
  exerciseMap('codes',value=>{check(typeof value==='string'&&value.length<=MAX_CODE_CHARS,'代码须为不超过100000字符的文本');return value;});
  if(owns(input,'passed')){
    check(Array.isArray(input.passed)&&input.passed.length<=exercises.length,'通过记录须为练习ID数组');
    state.passed=[...new Set(input.passed.map(id=>exerciseId(id,'通过记录')))];
  }
  exerciseMap('hints',(value,id)=>integer(value,0,byId.get(id).hints.length,'提示层级'));
  exerciseMap('predictions',(value,id)=>{keys(value,['choice'],'预测记录');return{choice:integer(value.choice,0,byId.get(id).prediction.choices.length-1,'预测选项')};});
  exerciseMap('mistakes',value=>{keys(value,['message','at'],'复习记录');check(typeof value.message==='string'&&value.message.length<=500,'复习消息须为不超过500字符的文本');return{message:value.message,at:date(value.at,'复习时间')};});
  exerciseMap('reflections',value=>{check(typeof value==='string'&&value.length<=4000,'解释须为不超过4000字符的文本');return value;});
  if(owns(input,'transfers')){
    check(record(input.transfers),'迁移记录须为对象');
    const tasks=new Map((options.transfers||[]).map(task=>[task.id,task]));
    for(const [id,value] of Object.entries(input.transfers)){
      check(tasks.has(id),'迁移记录含未知任务 '+id);keys(value,['code','explanation','hints','answerViewed','lastCheck'],'迁移作答');
      const answer={code:tasks.get(id).starter,explanation:'',hints:0,answerViewed:false};
      for(const field of ['code','explanation'])if(owns(value,field)){check(typeof value[field]==='string'&&value[field].length<=(field==='code'?MAX_CODE_CHARS:4000),'迁移'+field+'长度或类型无效');answer[field]=value[field];}
      if(owns(value,'hints'))answer.hints=integer(value.hints,0,tasks.get(id).hints.length,'迁移提示层级');
      if(owns(value,'answerViewed')){check(typeof value.answerViewed==='boolean','查看迁移答案记录须为布尔值');answer.answerViewed=value.answerViewed;}
      if(owns(value,'lastCheck')){const result=value.lastCheck;keys(result,['source','passed','total','at'],'迁移自查');check(typeof result.source==='string'&&result.source.length<=MAX_CODE_CHARS,'自查代码无效');const total=integer(result.total,1,100,'自查用例数');answer.lastCheck={source:result.source,passed:integer(result.passed,0,total,'自查通过数'),total,at:date(result.at,'自查时间')};}
      state.transfers[id]=answer;
    }
  }
  if(owns(input,'settings')){
    const settings=input.settings;keys(settings,['depth','algo','order','values'],'实验设置');
    if(owns(settings,'depth'))state.settings.depth=integer(settings.depth,0,3,'搜索深度');
    if(owns(settings,'algo')){check(['minimax','alphabeta'].includes(settings.algo),'搜索算法无效');state.settings.algo=settings.algo;}
    if(owns(settings,'order')){check(['lex','capture'].includes(settings.order),'走法顺序无效');state.settings.order=settings.order;}
    if(owns(settings,'values')){
      keys(settings.values,Object.keys(values),'棋子价值');
      for(const [piece,value] of Object.entries(settings.values)){
        check(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=10000,'棋子价值须为0–10000的有限数字');
        check(piece!=='K'||value===0,'将帅的静态价值固定为0');state.settings.values[piece]=value;
      }
    }
  }
  if(owns(input,'diagnosed')){check(typeof input.diagnosed==='boolean','诊断状态须为布尔值');state.diagnosed=input.diagnosed;}
  if(owns(input,'diagnostic')){
    const diagnostic=input.diagnostic;keys(diagnostic,['answers','suggestedUnit','at'],'诊断记录');
    check(Array.isArray(diagnostic.answers)&&diagnostic.answers.length===4,'诊断须有4个答案');
    check(exercises.some(exercise=>exercise.unit_id===diagnostic.suggestedUnit),'诊断建议单元无效');
    state.diagnostic={answers:diagnostic.answers.map(value=>integer(value,0,2,'诊断选项')),suggestedUnit:diagnostic.suggestedUnit,at:date(diagnostic.at,'诊断时间')};
  }
  if(owns(input,'lastSeen'))state.lastSeen=date(input.lastSeen,'首次访问时间');
  if(owns(input,'lastExercise'))state.lastExercise=exerciseId(input.lastExercise,'最后练习');
  return state;
}

export function parseRecord(raw,exercises,values,{backup=false,...options}={}){
  check(typeof raw==='string','记录须为JSON文本');
  check(new TextEncoder().encode(raw).byteLength<=MAX_RECORD_BYTES,'记录超过16 MB');
  let envelope;try{envelope=JSON.parse(raw);}catch{throw Error('记录不是有效JSON');}
  keys(envelope,['version','app','exportedAt','data'],'记录文件');
  check(envelope.version===1,'记录版本不受支持');
  if(backup||owns(envelope,'app'))check(envelope.app==='xiangqi-lab','不是本实验室的备份');
  if(owns(envelope,'exportedAt'))date(envelope.exportedAt,'导出时间');
  const state=validateState(envelope.data,exercises,values,options);
  return{state,fields:Object.keys(envelope.data),settingsFields:Object.keys(envelope.data.settings||{}),weightFields:Object.keys(envelope.data.settings?.values||{}),transferFields:Object.fromEntries(Object.entries(envelope.data.transfers||{}).map(([id,value])=>[id,Object.keys(value)]))};
}

export function mergeRecord(current,incoming,exercises,values,options={}){
  const next=validateState(current,exercises,values,options),source=incoming.state;
  for(const field of incoming.fields){
    if(['labs','codes','mistakes','predictions','reflections'].includes(field))next[field]={...next[field],...source[field]};
    else if(field==='transfers'){
      for(const [id,answer] of Object.entries(source.transfers)){
        const task=(options.transfers||[]).find(t=>t.id===id),previous=next.transfers[id]||{code:task.starter,explanation:'',hints:0,answerViewed:false},merged={...previous};
        for(const key of incoming.transferFields[id])merged[key]=key==='hints'?Math.max(previous.hints,answer.hints):key==='answerViewed'?(previous.answerViewed||answer.answerViewed):answer[key];
        next.transfers[id]=merged;
      }
    }
    else if(field==='passed')next.passed=[...new Set([...next.passed,...source.passed])];
    else if(field==='hints'){for(const [id,level] of Object.entries(source.hints))next.hints[id]=Math.max(next.hints[id]||0,level);}
    else if(field==='settings'){
      for(const key of incoming.settingsFields)if(key!=='values')next.settings[key]=source.settings[key];
      for(const piece of incoming.weightFields)next.settings.values[piece]=source.settings.values[piece];
    }else next[field]=source[field];
  }
  return validateState(next,exercises,values,options);
}

export function encodeRecord(state,exercises,values,{backup=false,...options}={}){
  const envelope={version:1,...(backup?{app:'xiangqi-lab',exportedAt:new Date().toISOString()}:{}),data:validateState(state,exercises,values,options)};
  const raw=JSON.stringify(envelope,null,backup?2:undefined);
  check(new TextEncoder().encode(raw).byteLength<=MAX_RECORD_BYTES,'记录超过16 MB');
  return raw;
}
