"""参考判题器。可由Pyodide Worker加载；浏览器必须从外部管理超时与终止Worker。
每题目标函数均来自source。不会把solution装入学生的namespace。
CLI默认只检验题库参考答案；实际编辑器调用run_suite(source, exercise)。
"""
import ast
import copy
import json
import pathlib
import traceback
import importlib
import lab
import reprlib

_LAB_KEYS=frozenset(vars(lab))
def restore_lab():
    for key in set(vars(lab))-_LAB_KEYS:
        delattr(lab,key)
    importlib.reload(lab)

_repr=reprlib.Repr()
_repr.maxstring=400
_repr.maxother=400
_repr.maxlist=_repr.maxtuple=12
_repr.maxdict=12
_repr.maxlevel=4

def bounded_repr(value):
    text=_repr.repr(value)
    if len(text)>600: text=text[:600]+'…'
    # Feedback is diagnostic, not a serialization of arbitrary student objects.
    return text+('（缩略/截断展示）' if '...' in text or len(text)>=400 else '')

def matches(actual, expected):
    """Coordinates accept list/tuple; bool and number remain distinct contracts."""
    if isinstance(expected, bool): return type(actual) is bool and actual==expected
    if expected is None: return actual is None
    if isinstance(expected, (int,float)):
        return type(actual) in (int,float) and actual==expected
    if isinstance(expected, str): return type(actual) is str and actual==expected
    if isinstance(expected, (list,tuple)):
        return isinstance(actual,(list,tuple)) and len(actual)==len(expected) and all(matches(a,b) for a,b in zip(actual,expected))
    if isinstance(expected, dict):
        return isinstance(actual,dict) and actual.keys()==expected.keys() and all(matches(actual[k],v) for k,v in expected.items())
    return type(actual) is type(expected) and actual==expected

def normalize(value):
    if isinstance(value,(list,tuple)): return [normalize(v) for v in value]
    if isinstance(value,dict): return {k:normalize(v) for k,v in value.items()}
    return value

def run_suite(source, exercise, include_hidden=False):
    """教学检测，不是安全沙箱。请在可重启的隔离Worker中执行。"""
    tests=[('visible',t) for t in exercise['visible_tests']]
    if include_hidden: tests += [('hidden',t) for t in exercise['hidden_tests']]
    results=[]
    if not tests: raise ValueError("题库没有有效测试，不能判为通过")
    # 只做明显的直接代答拦截，不声称抵抗绕过与反射。
    tree=ast.parse(source, filename='<student>')
    modules={'lab':'lab'}
    imported={}
    forbidden=set(exercise.get('forbidden_calls',[]))|{'lab.evaluation_parts','lab.validate_position'}
    forbidden.update('lab._'+name.split('.')[1] for name in list(forbidden) if name in ('lab.minimax','lab.alphabeta'))
    for node in ast.walk(tree):
        if isinstance(node,ast.Import):
            for alias in node.names:
                if alias.name=='lab': modules[alias.asname or alias.name]='lab'
        if isinstance(node,ast.ImportFrom) and node.module=='lab':
            for alias in node.names:
                name='lab.'+alias.name
                imported[alias.asname or alias.name]=name
                if name in forbidden or alias.name=='*':
                    return {'passed':0,'total':len(tests),'results':[{'name':'脚手架范围','passed':False,'visibility':'visible','error':'本题请自行实现目标逻辑，不可直接导入 '+name}]}
    for node in ast.walk(tree):
        name=None
        if isinstance(node,(ast.Assign,ast.AnnAssign)) and isinstance(node.value,ast.Attribute) and isinstance(node.value.value,ast.Name):
            reference=modules.get(node.value.value.id,node.value.value.id)+'.'+node.value.attr
            if reference in forbidden:
                return {'passed':0,'total':len(tests),'results':[{'name':'脚手架范围','passed':False,'visibility':'visible','error':'本题请自行实现目标逻辑，不可直接绑定 '+reference}]}
        if isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute) and isinstance(node.func.value,ast.Name):
            name=modules.get(node.func.value.id,node.func.value.id)+'.'+node.func.attr
        elif isinstance(node,ast.Call) and isinstance(node.func,ast.Name):
            name=imported.get(node.func.id)
        if name in forbidden:
            return {'passed':0,'total':len(tests),'results':[{'name':'脚手架范围','passed':False,'visibility':'visible','error':'本题请自行实现目标逻辑，不可直接调用 '+name}]}
    for visibility,test in tests:
        ns={}
        try:
            restore_lab()
            exec(compile(source,'<student>','exec'),ns)
            fn=ns.get(exercise['function'])
            assert callable(fn),'未定义目标函数 '+exercise['function']
            if 'assert_code' in test:
                ns['board']=copy.deepcopy(test['fixture_board'])
                exec(test['assert_code'],ns)
                if not exercise.get('mutates_board',False):
                    assert ns['board']==test['fixture_board'],'只读练习修改了输入棋盘'
            else:
                args=copy.deepcopy(test['args'])
                answer=fn(*args)
                assert matches(answer,test['expected']), '输入：'+bounded_repr(test['args'])+'；实际：'+bounded_repr(answer)+'；期望：'+bounded_repr(test['expected'])
                if 'expected_board' in test:
                    assert args[0]==test['expected_board'],'调用后的棋盘状态不符合约定'
                if not exercise.get('mutates_board',False):
                    assert args==test['args'],'只读练习修改了输入参数（包括moves列表）'
            results.append({'name':test['name'] if visibility=='visible' else '隐藏测试','passed':True,'visibility':visibility})
        except Exception as error:
            # 隐藏用例不返回输入与期望答案；异常只截取类型防止泄露用例。
            student_frames=[frame for frame in traceback.extract_tb(error.__traceback__) if frame.filename=='<student>']
            location='第 '+str(student_frames[-1].lineno)+' 行：' if student_frames else ''
            if visibility=='visible':
                try: detail=str(error)
                except Exception: detail='异常信息无法显示；请检查异常的__str__返回文本'
                detail=detail if len(detail)<=1000 else detail[:1000]+'…（错误信息截断）'
                message=location+type(error).__name__+'：'+detail
            else: message=location+type(error).__name__+'：隐藏测试未通过'
            results.append({'name':test['name'] if visibility=='visible' else '隐藏测试','passed':False,'visibility':visibility,'error':message})
        finally:
            restore_lab()
    return {'passed':sum(r['passed'] for r in results),'total':len(results),'results':results}

def main():
    root=pathlib.Path(__file__).parent
    data=json.loads((root/'curriculum.json').read_text())
    summaries=[]
    for e in data['exercises']:
        report=run_suite(e['solution'],e,True)
        summaries.append({'id':e['id'],'title':e['title'],**report})
        assert report['passed']==report['total'],(e['id'],report)
        starter=run_suite(e['starter'],e,True)
        assert starter['passed']==0,(e['id'],'未完成starter不应通过')
    result={'exercises':len(summaries),'passed':sum(s['passed'] for s in summaries),'total':sum(s['total'] for s in summaries),'all_starters_fail':True,'details':summaries}
    (root/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps({k:v for k,v in result.items() if k!='details'},ensure_ascii=False))
if __name__=='__main__': main()
