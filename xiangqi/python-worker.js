// Each request gets a fresh Worker; the page owns load/execution deadlines.
// Restartable teaching runtime, not a security sandbox for hostile code.
const STDOUT_LIMIT=16000,MESSAGE_LIMIT=1200,FEEDBACK_LIMIT=12000;
const clip=(value,limit)=>{const text=String(value??'');if(limit<=0)return '';const marker='…（信息截断）';return text.length>limit?(text.slice(0,Math.max(0,limit-marker.length))+marker).slice(0,limit):text};
onmessage=async({data})=>{
 let output='',stdoutTruncated=false,feedbackTruncated=false,stage='loading';
 const append=line=>{const text=String(line)+'\n',remaining=STDOUT_LIMIT-output.length;output+=text.slice(0,Math.max(0,remaining));if(text.length>remaining)stdoutTruncated=true;};
 try{
  postMessage({phase:'loading'});importScripts('./vendor/pyodide.js');
  const runtime=await loadPyodide({indexURL:new URL('./vendor/',self.location.href).href,stdout:append,stderr:append});
  for(const name of ['lab.py','judge.py']){const response=await fetch('./'+name);if(!response.ok)throw Error('无法读取 Python 教学模块 '+name);runtime.FS.writeFile('/home/pyodide/'+name,await response.text());}
  runtime.globals.set('_request_json',JSON.stringify({source:data.code,exercise:data.exercise,hidden:!!data.hidden}));
  stage='execution';postMessage({phase:'running'});
  const raw=await runtime.runPythonAsync(`
import json, judge
_request = json.loads(_request_json)
json.dumps(judge.run_suite(_request['source'], _request['exercise'], _request['hidden']), ensure_ascii=False)
`);
  const report=JSON.parse(raw);let remaining=FEEDBACK_LIMIT;
  const tests=report.results.map(test=>{
   const text=String(test.error||''),limit=Math.min(MESSAGE_LIMIT,remaining),message=clip(text,limit);remaining=Math.max(0,remaining-message.length);
   if(message!==text)feedbackTruncated=true;
   return{name:clip(test.name,120),ok:test.passed,message,visibility:test.visibility};
  });
  postMessage({phase:'done',result:{passed:report.passed,total:report.total,tests,stdout:output,stdoutTruncated,feedbackTruncated}});
 }catch(error){postMessage({phase:'done',stage,error:clip(error.message||error,3000)});}
};
