"""象棋实验室：内置脚手架。所有分数固定红方视角。Python 3，无第三方依赖。
教学规则覆盖日常走子、自将、将帅照面、将死与困毙；不裁定长将长捉、重复或自然限着。
"""
from copy import deepcopy
import math
VALUES = {'K': 0, 'A': 200, 'E': 200, 'H': 400, 'R': 900, 'C': 450, 'P': 100}
MATE = 100000

def _check_coordinate(x, y):
    if type(x) is not int or type(y) is not int or not inside(x,y):
        raise ValueError('坐标须为界内整数：x=0..8，y=0..9')

def _check_board(b):
    if not isinstance(b,list) or len(b)!=10 or any(not isinstance(r,list) or len(r)!=9 for r in b):
        raise ValueError('棋盘须为10×9独立列表')
    if len({id(r) for r in b})!=10:
        raise ValueError('棋盘各行不能共享同一列表')
    if any(type(p) is not str or len(p)!=1 or p not in '.KAEHRCPkaehrcp' for r in b for p in r):
        raise ValueError('棋子编码无效')

def _check_side(side):
    if side not in ('red','black'): raise ValueError('行动方须为red或black')

def _check_depth(depth):
    if type(depth) is not int or not 0<=depth<=6: raise ValueError('深度须为0–6的整数')

def _check_move(b, move):
    if not isinstance(move,(list,tuple)) or len(move)!=4: raise ValueError('着法须为四个坐标')
    x,y,nx,ny=move
    _check_coordinate(x,y);_check_coordinate(nx,ny)
    if (x,y)==(nx,ny): raise ValueError('起终点须不同')
    _check_board(b)

def _check_weights():
    if any(k not in VALUES or type(VALUES[k]) not in (int,float) or not 0<=VALUES[k]<=10000 for k in 'KAEHRCP') or VALUES['K']!=0:
        raise ValueError('七种权重须为0–10000有限数，将帅权重须为0')

def empty_board():
    return [['.'] * 9 for _ in range(10)]

def board(pieces):
    b = empty_board()
    seen=set()
    for x, y, p in pieces:
        _check_coordinate(x,y)
        if type(p) is not str or len(p)!=1 or p not in ".KAEHRCPkaehrcp": raise ValueError("棋子编码无效")
        if (x,y) in seen: raise ValueError("重复摆放坐标")
        seen.add((x,y))
        b[y][x] = p
    return b

def inside(x, y):
    return type(x) is int and type(y) is int and 0 <= x < 9 and 0 <= y < 10

def owner(piece):
    if piece == '.': return None
    return 'red' if piece.isupper() else 'black'

def opponent(side):
    _check_side(side)
    return 'black' if side == 'red' else 'red'

def locate_general(b, side):
    target = 'K' if side == 'red' else 'k'
    for y, row in enumerate(b):
        for x, p in enumerate(row):
            if p == target: return (x, y)
    return None

def palace(x, y, side):
    _check_side(side)
    return inside(x,y) and 3 <= x <= 5 and (7 <= y <= 9 if side == 'red' else 0 <= y <= 2)

def targets(b, x, y):
    """伪合法目标；包含对敌将的攻击，仅检查棋子走法，不检查自身将军。"""
    _check_coordinate(x,y)
    p = b[y][x]
    if p == '.': return []
    side, kind = owner(p), p.upper()
    out = []
    def add(nx, ny):
        if inside(nx, ny) and owner(b[ny][nx]) != side: out.append((nx, ny))
    if kind in 'RC':
        for dx, dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            nx, ny, screen = x + dx, y + dy, False
            while inside(nx, ny):
                q = b[ny][nx]
                if kind == 'R':
                    if q == '.': out.append((nx, ny))
                    else:
                        if owner(q) != side: out.append((nx, ny))
                        break
                elif not screen:
                    if q == '.': out.append((nx, ny))
                    else: screen = True
                elif q != '.':
                    if owner(q) != side: out.append((nx, ny))
                    break
                nx, ny = nx + dx, ny + dy
    elif kind == 'H':
        for dx,dy in [(2,1),(2,-1),(-2,1),(-2,-1),(1,2),(-1,2),(1,-2),(-1,-2)]:
            lx = x + (dx//2 if abs(dx)==2 else 0)
            ly = y + (dy//2 if abs(dy)==2 else 0)
            if inside(lx,ly) and b[ly][lx] == '.': add(x+dx,y+dy)
    elif kind == 'E':
        for dx,dy in [(2,2),(2,-2),(-2,2),(-2,-2)]:
            nx,ny=x+dx,y+dy
            if not inside(nx,ny): continue
            if (side=='red' and ny<5) or (side=='black' and ny>4): continue
            if b[y+dy//2][x+dx//2]=='.': add(nx,ny)
    elif kind == 'A':
        for dx,dy in [(1,1),(1,-1),(-1,1),(-1,-1)]:
            if palace(x+dx,y+dy,side): add(x+dx,y+dy)
    elif kind == 'K':
        for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            if palace(x+dx,y+dy,side): add(x+dx,y+dy)
        enemy=locate_general(b,opponent(side))
        if enemy and enemy[0]==x:
            ey=enemy[1]
            if all(b[yy][x]=='.' for yy in range(min(y,ey)+1,max(y,ey))): out.append(enemy)
    elif kind == 'P':
        add(x,y-1 if side=='red' else y+1)
        if (side=='red' and y<=4) or (side=='black' and y>=5):
            add(x-1,y); add(x+1,y)
    return sorted(set(out))

def pseudo_moves(b, side):
    return sorted((x,y,nx,ny) for y in range(10) for x in range(9)
                  if owner(b[y][x])==side for nx,ny in targets(b,x,y))

def make_move(b, move):
    _check_move(b,move)
    x,y,nx,ny=move
    if b[y][x]==".": raise ValueError("起点没有棋子")
    captured=b[ny][nx]
    b[ny][nx],b[y][x]=b[y][x],'.'
    return captured

def unmake_move(b, move, captured):
    _check_move(b,move)
    x,y,nx,ny=move
    if b[y][x]!="." or b[ny][nx]=="." or type(captured) is not str or len(captured)!=1 or captured not in ".KAEHRCPkaehrcp": raise ValueError("撤销状态无效")
    b[y][x],b[ny][nx]=b[ny][nx],captured

def in_check(b, side):
    king=locate_general(b,side)
    if king is None: return True
    enemy=opponent(side)
    for y in range(10):
        for x in range(9):
            if owner(b[y][x])==enemy and king in targets(b,x,y): return True
    return False

def legal_moves(b, side):
    if locate_general(b,side) is None: return []
    result=[]
    for move in pseudo_moves(b,side):
        if b[move[3]][move[2]].upper()=='K': continue  # 实战在将死处终止，不走“吃将”
        captured=make_move(b,move)
        try:
            safe=not in_check(b,side)
        finally:
            unmake_move(b,move,captured)
        if safe: result.append(move)
    return result

def terminal_score(b, side):
    _check_side(side)
    if locate_general(b,'red') is None: return -MATE
    if locate_general(b,'black') is None: return MATE
    if not legal_moves(b,side): return -MATE if side=='red' else MATE
    return None

def material_score(b):
    _check_board(b);_check_weights()
    return sum(VALUES[p.upper()]*(1 if p.isupper() else -1)
               for row in b for p in row if p!='.')

def pawn_bonus(p, x, y):
    if p=='P': return max(0,6-y)*10+(30 if y<=4 else 0)
    if p=='p': return -(max(0,y-3)*10+(30 if y>=5 else 0))
    return 0

def evaluation_parts(b):
    material=material_score(b)
    advance=river=0
    for y in range(10):
        for x in range(9):
            p=b[y][x]
            if p=='P':
                advance+=max(0,6-y)*10
                river+=30 if y<=4 else 0
            elif p=='p':
                advance-=max(0,y-3)*10
                river-=30 if y>=5 else 0
    position=advance+river
    raw_total=material+position
    static_score=max(-MATE+1,min(MATE-1,raw_total))
    return {'material':material,'advance':advance,'river':river,'position':position,
            'rawTotal':raw_total,'staticScore':static_score,'clampDelta':static_score-raw_total}

def evaluate(b):
    return evaluation_parts(b)['staticScore']

def leaf_score(b, side, depth):
    _check_side(side);_check_depth(depth)
    terminal=terminal_score(b,side)
    if terminal is not None: return terminal
    return evaluate(b) if depth==0 else None

def _minimax(b, side, depth):
    leaf=leaf_score(b,side,depth)
    if leaf is not None: return leaf
    best=-float('inf') if side=='red' else float('inf')
    for move in legal_moves(b,side):
        captured=make_move(b,move)
        try:
            score=_minimax(b,opponent(side),depth-1)
        finally:
            unmake_move(b,move,captured)
        best=max(best,score) if side=='red' else min(best,score)
    return best

def _alphabeta(b, side, depth, alpha=-float('inf'), beta=float('inf')):
    leaf=leaf_score(b,side,depth)
    if leaf is not None: return leaf
    best=-float('inf') if side=='red' else float('inf')
    for move in legal_moves(b,side):
        captured=make_move(b,move)
        try:
            score=_alphabeta(b,opponent(side),depth-1,alpha,beta)
        finally:
            unmake_move(b,move,captured)
        if side=='red': best=max(best,score); alpha=max(alpha,best)
        else: best=min(best,score); beta=min(beta,best)
        if alpha>=beta: break
    return best


def minimax(b, side, depth):
    _check_board(b);_check_side(side);_check_depth(depth);_check_weights()
    return _minimax(b,side,depth)

def alphabeta(b, side, depth, alpha=-float('inf'), beta=float('inf')):
    _check_board(b);_check_side(side);_check_depth(depth);_check_weights()
    if type(alpha) not in (int,float) or type(beta) not in (int,float) or math.isnan(alpha) or math.isnan(beta) or alpha>=beta:
        raise ValueError('搜索窗口须为数值且alpha<beta')
    return _alphabeta(b,side,depth,alpha,beta)

def best_move(b, side, depth):
    """depth=0无最佳步；depth>=1同分取坐标字典序最小。"""
    _check_board(b);_check_side(side);_check_depth(depth);_check_weights()
    if depth==0 or terminal_score(b,side) is not None: return None
    moves=legal_moves(b,side)
    if not moves: return None
    best=moves[0]; value=-float('inf') if side=='red' else float('inf')
    for move in moves:
        captured=make_move(b,move)
        try:
            score=_alphabeta(b,opponent(side),depth-1)
        finally:
            unmake_move(b,move,captured)
        if (side=='red' and score>value) or (side=='black' and score<value): best,value=move,score
    return best


def validate_position(input_board, side):
    """Editor/input boundary; deliberate attack counterexamples still use core helpers."""
    errors=[]
    warnings=[]
    shape=isinstance(input_board,list) and len(input_board)==10 and all(
        isinstance(row,(list,str)) and len(row)==9 for row in input_board)
    if not shape:
        return {'errors':['棋盘须为10行，每行9格。'],'warnings':warnings,'board':None,
                'canDisplay':False,'canInspect':False,'structurallyValid':False,
                'canPlay':False,'canSearch':False}
    b=[list(row) for row in input_board]
    codes=all(isinstance(piece,str) and len(piece)==1 and piece in '.KAEHRCPkaehrcp'
              for row in b for piece in row)
    if not codes: errors.append('每格只能是 . 或 K/A/E/H/R/C/P（红方大写，黑方小写）。')
    if side not in ('red','black'): errors.append('行动方须为red或black。')
    if codes:
        for colour in ('red','black'):
            counts={kind:0 for kind in 'KAEHRCP'}
            for y in range(10):
                for x in range(9):
                    piece=b[y][x]
                    if owner(piece)!=colour: continue
                    kind=piece.upper()
                    counts[kind]+=1
                    if kind in ('K','A') and not palace(x,y,colour):
                        errors.append(f"{'红' if colour=='red' else '黑'}方{'将帅' if kind=='K' else '仕士'}({x},{y})须在己方九宫。")
                    if kind=='E' and (y<5 if colour=='red' else y>4):
                        errors.append(f'象相({x},{y})不能在对方半场。')
            if counts['K']!=1: errors.append(f"{'红' if colour=='red' else '黑'}方须恰有一个将帅。")
            for kind in 'AEHRCP':
                if counts[kind]>(5 if kind=='P' else 2):
                    errors.append(f"{'红' if colour=='red' else '黑'}方{kind}超过原库存上限。")
    structural=not errors
    if structural:
        red=in_check(b,'red')
        black=in_check(b,'black')
        if red and black:
            errors.append('双方同时受将（含将帅照面），不能作为正常行棋局面。请添加屏障或调整棋子。')
        elif in_check(b,opponent(side)):
            errors.append('非行动方正受将；请换成受将的一方行棋，或修改局面。')
        warnings.append('教学构造局面：未证明开局可达性；长将、长捉和重复判罚不在本版范围。')
    return {'errors':errors,'warnings':warnings,'board':b,'canDisplay':True,'canInspect':codes,
            'structurallyValid':structural,'canPlay':not errors,'canSearch':not errors}
