"""
加工学 中間試験 カンペ生成スクリプト
A4 両面（2ページ）/ 豆粒フォント / 図・表込み
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle
import math, os

W, H = A4  # 210x297mm
MARGIN = 6 * mm
COL_GAP = 4 * mm
# 3段組
NUM_COLS = 3
col_w = (W - 2 * MARGIN - (NUM_COLS - 1) * COL_GAP) / NUM_COLS

FONT_TITLE  = 6.5
FONT_H2     = 5.8
FONT_BODY   = 4.8
FONT_SMALL  = 4.2
LEADING     = 5.8

BLACK  = colors.black
NAVY   = colors.Color(0.05, 0.18, 0.38)
TEAL   = colors.Color(0.18, 0.65, 0.58)
AMBER  = colors.Color(0.92, 0.65, 0.18)
RED    = colors.Color(0.80, 0.15, 0.18)
LGRAY  = colors.Color(0.85, 0.85, 0.85)
LLBLUE = colors.Color(0.88, 0.93, 0.97)

def c_font(c, size, bold=False, jp=False):
    if jp:
        try:
            c.setFont("HeiseiKakuGo-W5", size)
            return
        except:
            pass
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)

def draw_rect(c, x, y, w, h, fill=None, stroke=BLACK, lw=0.3):
    c.setLineWidth(lw)
    if fill:
        c.setFillColor(fill)
        c.rect(x, y, w, h, fill=1, stroke=0)
    c.setStrokeColor(stroke)
    c.rect(x, y, w, h, fill=0, stroke=1)

def section_header(c, x, y, w, text, bg=NAVY):
    bh = FONT_TITLE + 2.4 * mm
    c.setFillColor(bg)
    c.rect(x, y - bh + 1.2*mm, w, bh, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", FONT_TITLE)
    c.drawString(x + 1.2*mm, y - bh + 2.2*mm, text)
    return y - bh - 0.6*mm

def sub_header(c, x, y, w, text, bg=TEAL):
    bh = FONT_H2 + 1.6*mm
    c.setFillColor(bg)
    c.rect(x, y - bh + 0.8*mm, w, bh, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", FONT_H2)
    c.drawString(x + 0.8*mm, y - bh + 1.5*mm, text)
    return y - bh - 0.4*mm

def body_line(c, x, y, text, size=FONT_BODY, color=BLACK, indent=0):
    c.setFillColor(color)
    c.setFont("Helvetica", size)
    c.drawString(x + indent, y, text)
    return y - LEADING

def bold_line(c, x, y, text, size=FONT_BODY, color=BLACK, indent=0):
    c.setFillColor(color)
    c.setFont("Helvetica-Bold", size)
    c.drawString(x + indent, y, text)
    return y - LEADING

def bullet(c, x, y, text, size=FONT_BODY, color=BLACK, indent=2.4*mm):
    c.setFillColor(TEAL)
    c.setFont("Helvetica-Bold", size)
    c.drawString(x + indent - 1.8*mm, y, "·")
    c.setFillColor(color)
    c.setFont("Helvetica", size)
    c.drawString(x + indent, y, text)
    return y - LEADING

def key_val(c, x, y, key, val, size=FONT_BODY, indent=2.4*mm):
    kw = c.stringWidth(key, "Helvetica-Bold", size)
    c.setFillColor(AMBER)
    c.setFont("Helvetica-Bold", size)
    c.drawString(x + indent, y, key)
    c.setFillColor(BLACK)
    c.setFont("Helvetica", size)
    c.drawString(x + indent + kw + 1*mm, y, val)
    return y - LEADING

def draw_table(c, x, y, data, col_widths, row_height=4.5*mm, header_bg=LLBLUE):
    """Simple table renderer"""
    total_w = sum(col_widths)
    nrows = len(data)
    table_h = nrows * row_height
    ty = y
    for ri, row in enumerate(data):
        bg = header_bg if ri == 0 else (colors.Color(0.97,0.97,0.97) if ri%2==0 else colors.white)
        c.setFillColor(bg)
        c.rect(x, ty - row_height, total_w, row_height, fill=1, stroke=0)
        c.setStrokeColor(LGRAY)
        c.setLineWidth(0.2)
        c.rect(x, ty - row_height, total_w, row_height, fill=0, stroke=1)
        cx = x
        for ci, cell in enumerate(row):
            c.setStrokeColor(LGRAY)
            c.line(cx, ty, cx, ty - row_height)
            font = "Helvetica-Bold" if ri == 0 else "Helvetica"
            sz = FONT_SMALL
            c.setFillColor(NAVY if ri == 0 else BLACK)
            c.setFont(font, sz)
            # clip text
            max_w = col_widths[ci] - 1*mm
            txt = str(cell)
            while c.stringWidth(txt, font, sz) > max_w and len(txt) > 1:
                txt = txt[:-1]
            c.drawString(cx + 0.6*mm, ty - row_height + 1.2*mm, txt)
            cx += col_widths[ci]
        ty -= row_height
    c.setStrokeColor(NAVY)
    c.setLineWidth(0.4)
    c.rect(x, ty, total_w, table_h, fill=0, stroke=1)
    return ty - 1*mm

def draw_box(c, x, y, w, text_lines, title=None, bg=LLBLUE, size=FONT_SMALL):
    line_h = size + 1.4*mm
    total_h = line_h * len(text_lines) + (line_h if title else 0) + 1.6*mm
    c.setFillColor(bg)
    c.rect(x, y - total_h, w, total_h, fill=1, stroke=0)
    c.setStrokeColor(TEAL)
    c.setLineWidth(0.4)
    c.rect(x, y - total_h, w, total_h, fill=0, stroke=1)
    cy = y - 1*mm
    if title:
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", size)
        c.drawString(x + 1*mm, cy - size, title)
        cy -= line_h
    for line in text_lines:
        c.setFillColor(BLACK)
        c.setFont("Helvetica", size)
        c.drawString(x + 1.2*mm, cy - size, line)
        cy -= line_h
    return y - total_h - 0.8*mm

def draw_formula_box(c, x, y, w, formulas):
    """formulasは(label, formula)のリスト"""
    line_h = FONT_BODY + 1.6*mm
    total_h = line_h * len(formulas) + 2*mm
    c.setFillColor(colors.Color(0.95, 0.98, 0.95))
    c.rect(x, y - total_h, w, total_h, fill=1, stroke=0)
    c.setStrokeColor(colors.Color(0.3,0.7,0.3))
    c.setLineWidth(0.5)
    c.rect(x, y - total_h, w, total_h, fill=0, stroke=1)
    cy = y - 1.2*mm
    for label, formula in formulas:
        lw = c.stringWidth(label, "Helvetica-Bold", FONT_SMALL)
        c.setFillColor(RED)
        c.setFont("Helvetica-Bold", FONT_SMALL)
        c.drawString(x + 1*mm, cy - FONT_SMALL, label)
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", FONT_BODY)
        c.drawString(x + 1*mm + lw + 1.5*mm, cy - FONT_BODY, formula)
        cy -= line_h
    return y - total_h - 0.8*mm

def col_x(col_idx):
    return MARGIN + col_idx * (col_w + COL_GAP)

# ============================================================
# PAGE 1  (表) ： 鋳造 ＋ 塑性加工
# ============================================================
def draw_page1(c):
    c.setPageSize(A4)
    y_top = H - MARGIN

    # ── 超タイトルバー ──
    c.setFillColor(colors.Color(0.05,0.12,0.28))
    c.rect(0, H - 6.5*mm, W, 6.5*mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 6)
    c.drawCentredString(W/2, H - 4.8*mm,
        "加工学 中間試験 カンペ ｜ 表面：鋳造 / 塑性加工基礎    ※持込可 手書き参照用")

    y_start = H - 7.5*mm

    # ─────────────── 列0：鋳造 上半分 ───────────────
    cx0 = col_x(0)
    y0 = y_start

    y0 = section_header(c, cx0, y0, col_w, "1. 鋳造 (Casting)")

    # 概要
    y0 = sub_header(c, cx0, y0, col_w, "概要・特徴")
    y0 = bullet(c, cx0, y0, "溶融金属を鋳型に流込み凝固→製品")
    y0 = bullet(c, cx0, y0, "複雑形状OK / 中空形状得意")
    y0 = bullet(c, cx0, y0, "表面粗さ△ 精度△ 作業環境×")
    y0 = bullet(c, cx0, y0, "融点が低い材料: 金型使用可・省エネ・溶解容易")
    y0 -= 0.4*mm

    # 鋳型構造図（ASCII 風）
    y0 = sub_header(c, cx0, y0, col_w, "鋳型各部名称")
    # 簡易断面図
    bx, bw, bh_box = cx0 + 0.5*mm, col_w - 1*mm, 14*mm
    draw_rect(c, bx, y0 - bh_box, bw, bh_box, fill=colors.Color(0.95,0.95,0.88), stroke=NAVY)
    # 上型
    c.setFillColor(colors.Color(0.78,0.88,0.95))
    c.rect(bx+1*mm, y0-6*mm, bw-2*mm, 4*mm, fill=1, stroke=0)
    c.setFillColor(NAVY); c.setFont("Helvetica-Bold",3.8)
    c.drawCentredString(bx+bw/2, y0-4.4*mm, "上型(upper mold)")
    # 下型
    c.setFillColor(colors.Color(0.78,0.88,0.95))
    c.rect(bx+1*mm, y0-12.5*mm, bw-2*mm, 4*mm, fill=1, stroke=0)
    c.setFillColor(NAVY); c.setFont("Helvetica-Bold",3.8)
    c.drawCentredString(bx+bw/2, y0-10.8*mm, "下型(lower mold)")
    # 湯口
    c.setFillColor(colors.Color(0.95,0.75,0.5))
    c.rect(bx+bw*0.65, y0-8*mm, 3*mm, 8*mm, fill=1, stroke=0)
    c.setFillColor(RED); c.setFont("Helvetica",3.5)
    c.drawString(bx+bw*0.65+0.2*mm, y0-1.5*mm, "湯口")
    c.drawString(bx+bw*0.65+0.2*mm, y0-3*mm, "sprue")
    # 押湯
    c.setFillColor(colors.Color(0.95,0.75,0.5))
    c.rect(bx+bw*0.15, y0-6*mm, 3*mm, 6*mm, fill=1, stroke=0)
    c.setFillColor(RED); c.setFont("Helvetica",3.5)
    c.drawString(bx+bw*0.15, y0-0.8*mm, "押湯")
    c.drawString(bx+bw*0.15, y0-2.3*mm, "riser")
    # 湯道
    c.setFillColor(colors.Color(0.95,0.75,0.5))
    c.rect(bx+bw*0.15+3*mm, y0-9*mm, bw*0.50-3*mm, 2*mm, fill=1, stroke=0)
    c.setFillColor(RED); c.setFont("Helvetica",3.5)
    c.drawString(bx+bw*0.35, y0-8.2*mm, "湯道/runner")
    # 堰
    c.setFillColor(RED); c.setFont("Helvetica",3.5)
    c.drawString(bx+bw*0.55, y0-9.8*mm, "堰(gate)")
    # キャビティ
    c.setFillColor(colors.Color(0.65,0.82,0.65))
    c.rect(bx+bw*0.25, y0-12*mm, bw*0.3, 3*mm, fill=1, stroke=0)
    c.setFillColor(BLACK); c.setFont("Helvetica",3.5)
    c.drawCentredString(bx+bw*0.4, y0-10.8*mm, "鋳物")
    # 分割線
    c.setStrokeColor(RED); c.setLineWidth(0.5)
    c.setDash([1,1])
    c.line(bx, y0-8*mm, bx+bw, y0-8*mm)
    c.setDash([])
    c.setFillColor(RED); c.setFont("Helvetica-Bold",3.5)
    c.drawString(bx+bw-8*mm, y0-7.4*mm, "← 分割面")
    y0 -= bh_box + 0.6*mm

    y0 = sub_header(c, cx0, y0, col_w, "各種鋳造法比較")
    casting_data = [
        ["鋳造法","砂再利", "円管","精度","速度","特徴"],
        ["生砂型",  "◎",    "×",  "△",  "△",  "汎用・安価"],
        ["V プロセス","◎",  "×",  "○",  "△",  "砂再利用◎"],
        ["ロストワックス","×","×","◎","×","耐熱超合金・精密"],
        ["有機自硬","△",  "×",  "○",  "△",  "砂型強度◎"],
        ["遠心鋳造","×",  "◎",  "○",  "○",  "円管専用"],
        ["ダイカスト","×", "×",  "◎",  "◎",  "高圧・量産"],
        ["フルモールド","○","×", "○",  "○",  "3Dプリンタ可"],
    ]
    cws = [col_w*0.30, col_w*0.10, col_w*0.10, col_w*0.10, col_w*0.10, col_w*0.30]
    y0 = draw_table(c, cx0, y0, casting_data, cws, row_height=4.2*mm)

    y0 = sub_header(c, cx0, y0, col_w, "引け巣 (Shrinkage)")
    y0 = bullet(c, cx0, y0, "発生: 溶湯温度低下→外周凝固→内部溶湯不足→空洞")
    y0 = bullet(c, cx0, y0, "対策: 押湯(riser)取付け・肉厚均一化")
    y0 = bullet(c, cx0, y0, "内部検査: 超音波探傷試験 (切削不要!)")
    y0 -= 0.4*mm

    y0 = sub_header(c, cx0, y0, col_w, "鋳造設計のポイント")
    y0 = key_val(c, cx0, y0, "抜き勾配:", "砂型から模型を取外しやすくするため")
    y0 = key_val(c, cx0, y0, "角のR(丸み):", "ひずみや割れを防ぐため")
    y0 = key_val(c, cx0, y0, "見切り面:", "最も広い断面積の位置")
    y0 = key_val(c, cx0, y0, "アンダーカット:", "避ける（型が外れない）")
    y0 -= 0.4*mm

    y0 = sub_header(c, cx0, y0, col_w, "鋳造品の検査")
    y0 = bullet(c, cx0, y0, "強度: 同一溶湯で試験片を別鋳造→試験")
    y0 = bullet(c, cx0, y0, "化学成分: 溶湯から直接分析 (製品不要)")
    y0 = bullet(c, cx0, y0, "内部欠陥 (非破壊): 超音波/放射線/渦流探傷")
    y0 = bullet(c, cx0, y0, "表面欠陥 (非破壊): 浸透/磁粉探傷試験")

    y0 = sub_header(c, cx0, y0, col_w, "非破壊検査まとめ")
    ndt_data = [
        ["方法","対象","原理"],
        ["超音波","内部","音波反射"],
        ["放射線","内部","X線透過"],
        ["渦流探傷","表面近傍","電磁誘導"],
        ["浸透探傷","表面","毛細管現象"],
        ["磁粉探傷","表面","磁束漏洩"],
        ["目視","表面","−"],
    ]
    cws2 = [col_w*0.38, col_w*0.28, col_w*0.34]
    y0 = draw_table(c, cx0, y0, ndt_data, cws2, row_height=4.0*mm)

    # ─────────────── 列1：鋳造 下 + 塑性加工 上 ───────────────
    cx1 = col_x(1)
    y1 = y_start

    y1 = section_header(c, cx1, y1, col_w, "2. 塑性加工 (Plastic Forming)")

    y1 = sub_header(c, cx1, y1, col_w, "概要・特徴")
    y1 = bullet(c, cx1, y1, "固体のまま塑性変形で成形")
    y1 = bullet(c, cx1, y1, "材料の無駄が少ない (歩留まり◎)")
    y1 = bullet(c, cx1, y1, "加工時間が短い・量産に適する")
    y1 = bullet(c, cx1, y1, "加工により強度が向上(加工硬化)")
    y1 -= 0.6*mm

    y1 = sub_header(c, cx1, y1, col_w, "熱間 vs 冷間加工")
    hotcold_data = [
        ["特性","熱間","冷間"],
        ["大きな変形",  "◎",  "×"],
        ["寸法精度",    "△",  "◎"],
        ["加工による強化","×","◎"],
        ["連続加工",    "◎",  "×"],
        ["表面スケール","あり","なし"],
        ["スプリングバック","小","大"],
    ]
    cws3 = [col_w*0.48, col_w*0.26, col_w*0.26]
    y1 = draw_table(c, cx1, y1, hotcold_data, cws3, row_height=4.2*mm)

    y1 = sub_header(c, cx1, y1, col_w, "材料特性要件")
    mat_data = [
        ["特性","被加工材","金型"],
        ["塑性変形量",  "大◎",  "−"],
        ["加工硬化",    "小◎",  "−"],
        ["耐摩耗性",    "−",    "大◎"],
        ["耐熱性",      "−",    "高◎"],
        ["耐食性",      "−",    "高◎"],
    ]
    cws4 = [col_w*0.44, col_w*0.28, col_w*0.28]
    y1 = draw_table(c, cx1, y1, mat_data, cws4, row_height=4.2*mm)

    y1 = sub_header(c, cx1, y1, col_w, "圧延 (Rolling)")
    # 簡易圧延図
    bx1, bh1 = cx1 + 0.5*mm, 13*mm
    bw1 = col_w - 1*mm
    draw_rect(c, bx1, y1 - bh1, bw1, bh1, fill=colors.Color(0.95,0.98,0.95), stroke=TEAL, lw=0.4)
    # 上ロール
    c.setFillColor(colors.Color(0.6,0.7,0.8))
    c.circle(bx1 + bw1*0.35, y1 - 3.5*mm, 2.5*mm, fill=1, stroke=1)
    c.circle(bx1 + bw1*0.65, y1 - 3.5*mm, 2.5*mm, fill=1, stroke=1)
    # 下ロール
    c.circle(bx1 + bw1*0.35, y1 - 9.5*mm, 2.5*mm, fill=1, stroke=1)
    c.circle(bx1 + bw1*0.65, y1 - 9.5*mm, 2.5*mm, fill=1, stroke=1)
    # 材料
    c.setFillColor(colors.Color(0.9,0.75,0.5))
    c.rect(bx1+1*mm, y1-8.5*mm, bw1*0.25, 5*mm, fill=1, stroke=0)  # 入口
    c.rect(bx1+bw1*0.72, y1-8*mm, bw1*0.25, 4*mm, fill=1, stroke=0)  # 出口
    # 矢印・ラベル
    c.setFillColor(BLACK); c.setFont("Helvetica-Bold", 3.5)
    c.drawString(bx1+2*mm, y1-7.2*mm, "入口 v0,t0")
    c.drawString(bx1+bw1*0.73, y1-6.8*mm, "出口 v1,t1")
    c.setFillColor(RED); c.setFont("Helvetica-Bold", 4)
    c.drawCentredString(bx1+bw1/2, y1-12.2*mm, "v0·t0 = v1·t1  →  v1>v0 (体積保存)")
    y1 -= bh1 + 0.8*mm

    y1 = bullet(c, cx1, y1, "バックアップロール: ワークロールのたわみ防止")
    y1 = bullet(c, cx1, y1, "圧延で板・レール・管が製作可能")
    y1 -= 0.4*mm

    y1 = sub_header(c, cx1, y1, col_w, "押出し vs 引き抜き")
    extdraw_data = [
        ["特性","押出し(Extrusion)","引抜(Drawing)"],
        ["寸法精度",    "△",   "◎"],
        ["変形量",      "大◎", "小"],
        ["加工温度",    "熱間◎","冷間◎"],
        ["加工による強化","−","◎"],
    ]
    cws5 = [col_w*0.36, col_w*0.32, col_w*0.32]
    y1 = draw_table(c, cx1, y1, extdraw_data, cws5, row_height=4.2*mm)

    y1 = sub_header(c, cx1, y1, col_w, "曲げ加工 / スプリングバック")
    y1 = bullet(c, cx1, y1, "弾性回復で角度が戻る → スプリングバック")
    y1 = bullet(c, cx1, y1, "縦弾性係数E大 → スプリングバック大")
    y1 = bullet(c, cx1, y1, "対策: 過曲げ / 底押し(ストライキング)")
    y1 -= 0.4*mm

    # スプリングバック図
    bx2, bh2, bw2 = cx1+0.5*mm, 9*mm, col_w-1*mm
    draw_rect(c, bx2, y1-bh2, bw2, bh2, fill=LLBLUE, stroke=TEAL, lw=0.3)
    # L字形状
    c.setStrokeColor(colors.Color(0.3,0.5,0.8)); c.setLineWidth(1.2)
    c.line(bx2+2*mm, y1-7*mm, bx2+2*mm, y1-2*mm)   # 縦
    c.line(bx2+2*mm, y1-7*mm, bx2+9*mm, y1-7*mm)   # 横 (目標)
    c.setStrokeColor(RED); c.setLineWidth(0.8)
    # 戻り方向
    import math as _math
    c.line(bx2+2*mm, y1-2*mm,
           bx2+2*mm + 6*mm*_math.sin(0.2), y1-2*mm - 6*mm*(1-_math.cos(0.2)))
    c.setFillColor(RED); c.setFont("Helvetica", 3.5)
    c.drawString(bx2+3.5*mm, y1-1.5*mm, "← スプリングバック(赤=実際)")
    c.setFillColor(colors.Color(0.3,0.5,0.8))
    c.drawString(bx2+10*mm, y1-6.5*mm, "青=目標形状")
    y1 -= bh2 + 0.8*mm

    y1 = sub_header(c, cx1, y1, col_w, "ファインブランキング")
    y1 = bullet(c, cx1, y1, "端面が綺麗・寸法精度◎")
    y1 = bullet(c, cx1, y1, "端面に逃げ力と反力を同時に加える")
    y1 = bullet(c, cx1, y1, "切断部に材料の横移動を拘束する圧力付加")
    y1 -= 0.4*mm

    y1 = sub_header(c, cx1, y1, col_w, "深絞り (Deep Drawing)")
    y1 = bullet(c, cx1, y1, "板→カップ形状 / ブランクホルダで拘束")
    y1 = bullet(c, cx1, y1, "限界絞り比 (LDR) = ブランク径/パンチ径")
    y1 = bullet(c, cx1, y1, "シワ→BH圧力↑、割れ→BH圧力↓")

    # ─────────────── 列2：塑性加工 計算 ───────────────
    cx2 = col_x(2)
    y2 = y_start

    y2 = section_header(c, cx2, y2, col_w, "塑性加工 計算・解析")

    y2 = sub_header(c, cx2, y2, col_w, "ひずみ計算")
    y2 = draw_formula_box(c, cx2, y2, col_w, [
        ("公称ひずみ:", "e = DL/L0  (DL=L-L0)"),
        ("真ひずみ:",   "E = ln(L/L0) = ln(1+e)"),
        ("例:L0=100, L=105",  "→e=0.05  E=ln1.05=0.0488"),
    ])

    y2 = sub_header(c, cx2, y2, col_w, "せん断加工荷重 P")
    y2 = draw_formula_box(c, cx2, y2, col_w, [
        ("P =", "ts x L x t"),
        ("ts=せん断抵抗","L=切断線長, t=板厚"),
        ("円形d=100mm,t=5mm","ts=300MPa →"),
        ("P = 300 x (p x100) x5","= 471,239 N ≒ 471 kN"),
    ])
    y2 = bullet(c, cx2, y2, "単位注意: MPa=N/mm2、長さはmm")
    y2 -= 0.4*mm

    y2 = sub_header(c, cx2, y2, col_w, "圧延の体積保存")
    y2 = draw_formula_box(c, cx2, y2, col_w, [
        ("V0l0 = V1l1", "(入口断面積x速度=出口)"),
        ("t0·w0·v0 =", "t1·w1·v1"),
        ("板幅不変なら:","t0·v0 = t1·v1"),
        ("→ v1 > v0", "(出口速度 > 入口速度)"),
    ])
    y2 -= 0.4*mm

    y2 = sub_header(c, cx2, y2, col_w, "降伏条件")
    y2 = draw_formula_box(c, cx2, y2, col_w, [
        ("Tresca:", "s1 - s3 = Y  (最大-最小=降伏応力)"),
        ("Von Mises:", "(s1-s2)^2+(s2-s3)^2+(s3-s1)^2=2Y^2"),
        ("2軸応力なら:","s1^2-s1s2+s2^2 = Y^2"),
    ])
    y2 = bullet(c, cx2, y2, "シミュレーション: Von Mises降伏条件を多用")
    y2 -= 0.4*mm

    y2 = sub_header(c, cx2, y2, col_w, "プレス加工まとめ")
    press_data = [
        ["加工","特徴","主な用途"],
        ["せん断","P=ts·L·t","板の抜き・切断"],
        ["曲げ","スプリングバック","ブラケット等"],
        ["深絞り","LDR=D/d","カップ形状"],
        ["ファインブランキング","端面精度◎","精密部品"],
        ["バルジ成形","内圧で膨らませ","管・中空品"],
    ]
    cws6 = [col_w*0.28, col_w*0.36, col_w*0.36]
    y2 = draw_table(c, cx2, y2, press_data, cws6, row_height=4.0*mm)

    y2 = sub_header(c, cx2, y2, col_w, "FCC / BCC と加工性")
    y2 = bullet(c, cx2, y2, "FCC (Al,Cu,Ni): 延性高い→冷間加工向き")
    y2 = bullet(c, cx2, y2, "BCC (Fe): 延性中→熱間・冷間両用")
    y2 = bullet(c, cx2, y2, "HCP (Ti,Mg): 延性低い→加工困難")
    y2 -= 0.4*mm

    y2 = sub_header(c, cx2, y2, col_w, "Near Net Shape / Net Shape")
    y2 = bullet(c, cx2, y2, "Near Net Shape: ほぼ完成形で素材を作る")
    y2 = bullet(c, cx2, y2, "Net Shape: 後加工不要で完成形を製作")
    y2 = bullet(c, cx2, y2, "塑性加工・鋳造は Near/Net Shape に有利")
    y2 -= 0.4*mm

    y2 = sub_header(c, cx2, y2, col_w, "AM (Additive Manufacturing)")
    y2 = bullet(c, cx2, y2, "付加製造 / 3Dプリンタ")
    y2 = bullet(c, cx2, y2, "複雑形状・少量生産に適する")
    y2 = bullet(c, cx2, y2, "粉末床溶融結合(PBF)/ 指向性エネルギー堆積")
    y2 = bullet(c, cx2, y2, "鋳型(砂型)もAM成形可能")

    y2 = sub_header(c, cx2, y2, col_w, "加工法の選び方 早見")
    choose_data = [
        ["要求","最適加工法"],
        ["複雑な中空形状","鋳造"],
        ["高精度・高強度","冷間塑性加工"],
        ["大変形・低精度","熱間押出し"],
        ["円管",          "遠心鋳造/押出し"],
        ["精密板打抜き",  "ファインブランキング"],
        ["耐熱複雑部品",  "ロストワックス鋳造"],
    ]
    cws7 = [col_w*0.44, col_w*0.56]
    y2 = draw_table(c, cx2, y2, choose_data, cws7, row_height=4.0*mm)

    c.showPage()

# ============================================================
# PAGE 2  (裏) ： 接合（溶接）
# ============================================================
def draw_page2(c):
    c.setPageSize(A4)

    c.setFillColor(colors.Color(0.05,0.12,0.28))
    c.rect(0, H - 6.5*mm, W, 6.5*mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 6)
    c.drawCentredString(W/2, H - 4.8*mm,
        "加工学 中間試験 カンペ ｜ 裏面：接合（溶接）/ 補足    ※持込可 手書き参照用")

    y_start = H - 7.5*mm

    # ─────────────── 列0：接合概要 ───────────────
    cx0 = col_x(0)
    y0 = y_start

    y0 = section_header(c, cx0, y0, col_w, "3. 接合 (Joining / Welding)")

    y0 = sub_header(c, cx0, y0, col_w, "接合の分類")
    y0 = bold_line(c, cx0, y0, "A) 機械的接合 (Mechanical Bonding)")
    y0 = bullet(c, cx0, y0, "ボルト・ナット・リベット・プレスばめ")
    y0 = bullet(c, cx0, y0, "分解・再組立 可能")
    y0 = bold_line(c, cx0, y0, "B) 化学的接合 (Chemical Bonding)")
    y0 = bullet(c, cx0, y0, "接着剤 → 化学反応で結合")
    y0 = bullet(c, cx0, y0, "異種材料でも接合可")
    y0 = bold_line(c, cx0, y0, "C) 冶金的接合 (Metallurgical Bonding)")
    y0 = bullet(c, cx0, y0, "溶接(welding): 加熱→溶融→凝固")
    y0 = bullet(c, cx0, y0, "ろう付け(brazing): 母材融点以下で接合材を溶融")
    y0 -= 0.6*mm

    y0 = sub_header(c, cx0, y0, col_w, "溶接全体像")
    weld_overview = [
        ["分類","方式","主な溶接法"],
        ["融接","溶融→凝固","アーク・ガス・レーザ・EB"],
        ["圧接","圧力+熱","スポット・FSW・抵抗"],
        ["ろう付","毛管現象","はんだ付け・ブレージング"],
    ]
    cws_ov = [col_w*0.2, col_w*0.26, col_w*0.54]
    y0 = draw_table(c, cx0, y0, weld_overview, cws_ov, row_height=4.5*mm)

    y0 = sub_header(c, cx0, y0, col_w, "アーク溶接の種類比較")
    arc_data = [
        ["溶接法","保護ガス","電極","用途"],
        ["MAG","Ar+CO2(80%)","消耗","炭素鋼・鉄鋼"],
        ["MIG","Ar","消耗","Al・Cu等非鉄"],
        ["TIG","Ar","W非消耗","薄板・SUS"],
        ["プラズマ","Ar","W非消耗","精密・切断"],
        ["被覆アーク","フラックス","消耗","屋外・補修"],
        ["サブマージ","フラックス","消耗","厚板・造船"],
    ]
    cws_arc = [col_w*0.25, col_w*0.28, col_w*0.18, col_w*0.29]
    y0 = draw_table(c, cx0, y0, arc_data, cws_arc, row_height=4.2*mm)
    y0 = bullet(c, cx0, y0, "品質: MIG > MAG（Arのみ↑、CO2混入↓）")
    y0 = bullet(c, cx0, y0, "アーク温度: 5000〜6000°C")
    y0 -= 0.4*mm

    y0 = sub_header(c, cx0, y0, col_w, "各溶接法の特徴詳細")
    y0 = key_val(c, cx0, y0, "MAG:", "ガスAr+CO2 保護. 炭素鋼向け. スパッタ△")
    y0 = key_val(c, cx0, y0, "MIG:", "ガスArのみ. 非鉄金属(Al,Cu)向け. 品質◎")
    y0 = key_val(c, cx0, y0, "TIG:", "タングステン非消耗電極. 別にフィラー. 薄板・SUS")
    y0 = key_val(c, cx0, y0, "レーザー:", "HAZ最小・精密・高速. 熱影響小")
    y0 = key_val(c, cx0, y0, "電子ビーム:", "真空中. エネルギー密度最大. 精密")
    y0 = key_val(c, cx0, y0, "ガス溶接:", "可燃ガス+O2. 低熱量. 薄板・補修")
    y0 = key_val(c, cx0, y0, "スポット溶接:", "重ね継手. 自動車ボディ等. 圧接")
    y0 = key_val(c, cx0, y0, "エレクトロスラグ:", "厚肉縦向き連続溶接")
    y0 = key_val(c, cx0, y0, "FSW:", "摩擦攪拌溶接. 固体状態(融点以下). Al◎")

    # ─────────────── 列1：溶接詳細 ───────────────
    cx1 = col_x(1)
    y1 = y_start

    y1 = section_header(c, cx1, y1, col_w, "溶接部の構造と欠陥")

    y1 = sub_header(c, cx1, y1, col_w, "溶接部断面")
    # 溶接断面図
    bx1, bh1, bw1 = cx1+0.5*mm, 20*mm, col_w-1*mm
    draw_rect(c, bx1, y1-bh1, bw1, bh1, fill=colors.Color(0.96,0.96,0.90), stroke=NAVY, lw=0.4)
    # 母材
    c.setFillColor(colors.Color(0.7,0.8,0.9))
    c.rect(bx1+1*mm, y1-bh1+1*mm, bw1*0.38-1*mm, bh1-5*mm, fill=1, stroke=0)  # 左母材
    c.rect(bx1+bw1*0.62, y1-bh1+1*mm, bw1*0.38-1*mm, bh1-5*mm, fill=1, stroke=0)  # 右母材
    # 溶接金属
    c.setFillColor(colors.Color(0.95,0.7,0.5))
    c.beginPath()
    cx_m = bx1 + bw1/2
    c.moveTo(cx_m - 5*mm, y1-4*mm)
    c.curveTo(cx_m-5*mm, y1-2*mm, cx_m+5*mm, y1-2*mm, cx_m+5*mm, y1-4*mm)
    c.lineTo(cx_m+4*mm, y1-bh1+2*mm)
    c.lineTo(cx_m-4*mm, y1-bh1+2*mm)
    c.closePath()
    c.fill()
    # ラベル
    c.setFillColor(BLACK); c.setFont("Helvetica-Bold",3.5)
    c.drawString(bx1+2*mm, y1-bh1+3*mm, "母材(Base metal)")
    c.drawString(bx1+bw1*0.62+0.5*mm, y1-bh1+3*mm, "母材")
    c.drawCentredString(cx_m, y1-6*mm, "溶接金属")
    # HAZ
    c.setFillColor(colors.Color(0.95,0.85,0.6))
    c.rect(bx1+bw1*0.38-1*mm, y1-bh1+1*mm, 2.5*mm, bh1-5*mm, fill=1, stroke=0)
    c.rect(bx1+bw1*0.62-1.5*mm, y1-bh1+1*mm, 2.5*mm, bh1-5*mm, fill=1, stroke=0)
    c.setFillColor(AMBER); c.setFont("Helvetica-Bold",3.5)
    c.drawString(bx1+bw1*0.38, y1-1.5*mm, "HAZ")
    c.drawString(bx1+bw1*0.62-2*mm, y1-1.5*mm, "HAZ")
    c.setFillColor(BLACK); c.setFont("Helvetica",3.5)
    c.drawString(bx1+bw1*0.38-0.5*mm, y1-3*mm, "熱影響部")
    y1 -= bh1 + 0.8*mm

    y1 = sub_header(c, cx1, y1, col_w, "HAZ (熱影響部)")
    y1 = bullet(c, cx1, y1, "Heat Affected Zone")
    y1 = bullet(c, cx1, y1, "溶接熱で組織変化した母材部分")
    y1 = bullet(c, cx1, y1, "強度↓・靭性↓・硬さ変化")
    y1 = bullet(c, cx1, y1, "FSWはHAZ最小 (固体状態のため)")
    y1 -= 0.4*mm

    y1 = sub_header(c, cx1, y1, col_w, "溶接欠陥")
    defect_data = [
        ["欠陥名","原因","対策"],
        ["アンダーカット","電流過大","電流↓・速度↓"],
        ["ブローホール","ガス残留","ガス管理・乾燥"],
        ["割れ(高温)","急冷・不純物","予熱・成分管理"],
        ["溶込み不足","電流不足","電流↑・開先角度↑"],
        ["オーバーラップ","電流過小","電流↑・角度調整"],
    ]
    cws_d = [col_w*0.30, col_w*0.35, col_w*0.35]
    y1 = draw_table(c, cx1, y1, defect_data, cws_d, row_height=4.0*mm)

    y1 = sub_header(c, cx1, y1, col_w, "溶接変形・残留応力")
    y1 = bullet(c, cx1, y1, "加熱→膨張→冷却→収縮→変形")
    y1 = bullet(c, cx1, y1, "拘束↑ → 残留応力↑ 変形↓")
    y1 = bullet(c, cx1, y1, "拘束↓ → 残留応力↓ 変形↑")
    y1 = bullet(c, cx1, y1, "焼なまし(応力除去焼鈍)で残留応力低減")
    y1 -= 0.4*mm

    y1 = sub_header(c, cx1, y1, col_w, "FSW (摩擦攪拌溶接)")
    # FSW図
    bx2, bh2, bw2 = cx1+0.5*mm, 14*mm, col_w-1*mm
    draw_rect(c, bx2, y1-bh2, bw2, bh2, fill=LLBLUE, stroke=TEAL, lw=0.4)
    # ツール
    c.setFillColor(colors.Color(0.5,0.5,0.6))
    c.rect(bx2+bw2*0.4, y1-1*mm, bw2*0.2, 3*mm, fill=1, stroke=0)
    c.setFillColor(colors.Color(0.4,0.4,0.55))
    c.rect(bx2+bw2*0.44, y1-5*mm, bw2*0.12, 5*mm, fill=1, stroke=0)
    # 回転矢印
    c.setStrokeColor(RED); c.setLineWidth(0.6)
    c.arc(bx2+bw2*0.47, y1+1*mm, bx2+bw2*0.55, y1+4*mm, 45, 270)
    c.setFillColor(RED); c.setFont("Helvetica-Bold",3.5)
    c.drawString(bx2+bw2*0.57, y1+1*mm, "回転")
    # 接合部
    c.setFillColor(colors.Color(0.7,0.85,0.7))
    c.rect(bx2+1*mm, y1-bh2+2*mm, bw2-2*mm, bh2-6*mm, fill=1, stroke=0)
    c.setFillColor(colors.Color(0.95,0.8,0.5))
    c.rect(bx2+bw2*0.46, y1-bh2+2*mm, bw2*0.08, bh2-6*mm, fill=1, stroke=0)
    c.setFillColor(BLACK); c.setFont("Helvetica",3.5)
    c.drawString(bx2+2*mm, y1-bh2+3*mm, "Al板")
    c.drawCentredString(bx2+bw2/2, y1-bh2+1*mm, "← 進行方向")
    y1 -= bh2 + 0.8*mm

    y1 = bullet(c, cx1, y1, "ピン付きツール回転→摩擦熱→軟化→攪拌接合")
    y1 = bullet(c, cx1, y1, "固体状態(融点以下)→溶接欠陥少・HAZ小")
    y1 = bullet(c, cx1, y1, "主にAlやMg合金(航空・自動車)")
    y1 = bullet(c, cx1, y1, "3パス(3回) → 溶融溶接と同等強度")
    y1 -= 0.4*mm

    y1 = sub_header(c, cx1, y1, col_w, "溶接継手の種類")
    y1 = key_val(c, cx1, y1, "突合せ継手:", "板端面同士を合わせる (最も一般的)")
    y1 = key_val(c, cx1, y1, "重ね継手:", "板を重ねる (スポット溶接多用)")
    y1 = key_val(c, cx1, y1, "T継手:",    "T字型 (フィレット溶接)")
    y1 = key_val(c, cx1, y1, "へり継手:", "板のへりを合わせる")

    # ─────────────── 列2：補足・公式集 ───────────────
    cx2 = col_x(2)
    y2 = y_start

    y2 = section_header(c, cx2, y2, col_w, "補足・重要公式集")

    y2 = sub_header(c, cx2, y2, col_w, "重要用語 英語対応")
    terms_data = [
        ["日本語","英語"],
        ["鋳造","Casting"],
        ["溶融","Melting"],
        ["凝固","Solidification"],
        ["塑性加工","Plastic Forming"],
        ["圧延","Rolling"],
        ["押出し","Extrusion"],
        ["引き抜き","Drawing"],
        ["せん断","Shearing"],
        ["深絞り","Deep Drawing"],
        ["スプリングバック","Springback"],
        ["接合","Joining"],
        ["溶接","Welding"],
        ["ろう付け","Brazing"],
        ["熱影響部","HAZ"],
        ["引け巣","Shrinkage cavity"],
        ["非破壊検査","NDT"],
        ["超音波探傷","UT (Ultrasonic)"],
        ["浸透探傷","PT (Penetrant)"],
        ["渦流探傷","ECT"],
    ]
    cws_t = [col_w*0.50, col_w*0.50]
    y2 = draw_table(c, cx2, y2, terms_data, cws_t, row_height=3.8*mm)

    y2 = sub_header(c, cx2, y2, col_w, "全公式まとめ")
    y2 = draw_formula_box(c, cx2, y2, col_w, [
        ("公称ひずみ e","= DL/L0"),
        ("真ひずみ E","= ln(L/L0)"),
        ("相互関係","E = ln(1+e)"),
        ("せん断荷重 P","= ts x L x t"),
        ("体積保存 (圧延)","t0w0v0 = t1w1v1"),
        ("Tresca降伏","s1-s3 = Y"),
        ("Von Mises","(s1-s2)^2+(s2-s3)^2+(s3-s1)^2=2Y^2"),
        ("2軸Mises","s1^2-s1s2+s2^2 = Y^2"),
        ("限界絞り比 LDR","= D0/Dp  (D0:ブランク径)"),
    ])

    y2 = sub_header(c, cx2, y2, col_w, "確認問題の急所")
    y2 = draw_box(c, cx2, y2, col_w, [
        "砂型が使えるのは: 表面張力が小さい(隙間通過)",
        "融点が低い利点: 金型可・省エネ・溶解容易",
        "引け巣内部検査→超音波探傷(表面削らずOK)",
        "抜き勾配の目的→模型を砂型から外すため",
        "Rの目的→ひずみ・割れ防止",
        "見切り面→最も広い断面積",
        "圧延出口速度 > 入口速度 (体積保存)",
        "BAロールの役割→ワークロールのたわみ防止",
        "引抜き特徴→高寸法精度・冷間加工",
        "押出し特徴→大変形可・熱間",
        "スプリングバック→E大の材料ほど大",
        "MAG保護ガス→Ar+CO2  MIG→Arのみ",
        "TIG→タングステン非消耗電極",
        "FSW→固体状態接合→HAZ最小",
        "MIG品質 > MAG品質",
    ], size=FONT_SMALL)

    y2 = sub_header(c, cx2, y2, col_w, "計算練習問題と答え")
    y2 = draw_box(c, cx2, y2, col_w, [
        "Q1: t=5mm,d=100mm円,ts=300MPa →P?",
        "  P=300×(π×100)×5 = 471,239N≒471kN",
        "Q2: L0=100mm,L=105mm",
        "  公称ひずみ: e=(105-100)/100 = 0.05",
        "  真ひずみ: E=ln(105/100)=ln1.05≈0.0488",
        "Q3: 入口t=10mm,v=1m/s 出口t=5mm→v?",
        "  10×1 = 5×v → v=2m/s",
    ], size=FONT_SMALL)

    c.showPage()

# ============================================================
# Main
# ============================================================
out_dir = os.path.dirname(os.path.abspath(__file__))
out_path = os.path.join(out_dir, "kakougaku_cheatsheet.pdf")

c = canvas.Canvas(out_path, pagesize=A4)
draw_page1(c)
draw_page2(c)
c.save()
print(f"Generated: {out_path}")
