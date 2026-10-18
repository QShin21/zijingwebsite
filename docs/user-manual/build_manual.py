"""Build the illustrated PDF and a self-contained HTML manual using bundled Python.

Run source layout renders first as documented in README.md. No production writes.
"""
from pathlib import Path
from html import escape
import base64
import json
import shutil
import sys
import textwrap
import hashlib
from datetime import datetime

from PIL import Image as PILImage, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle, Image, KeepTogether
from reportlab.lib.utils import ImageReader

from manual_content import PAGES

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
FIGS = HERE / 'figures'
OUT = HERE
QA = ROOT / '.data' / 'manual-qa'
FIGS.mkdir(exist_ok=True)
QA.mkdir(parents=True, exist_ok=True)
FONT_DIR = Path('C:/Windows/Fonts')
pdfmetrics.registerFont(TTFont('YaHei', str(FONT_DIR/'msyh.ttc'), subfontIndex=0))
pdfmetrics.registerFont(TTFont('YaHeiBold', str(FONT_DIR/'msyhbd.ttc'), subfontIndex=0))
pdfmetrics.registerFontFamily('YaHei', normal='YaHei', bold='YaHeiBold', italic='YaHei', boldItalic='YaHeiBold')
PURPLE = '#6f2d67'
INK = '#23212a'
MUTED = '#65616c'
BG = '#f7f5f0'
LIGHT = '#f1e8f0'
W,H = 595.276,841.89
M = 44
CW = W-2*M
TITLE = '紫荆网站及竞在紫荆小程序用户使用手册'

ST = {
 'body': ParagraphStyle('body',fontName='YaHei',fontSize=10.2,leading=17.5,textColor=INK,wordWrap='CJK',spaceAfter=9),
 'small': ParagraphStyle('small',fontName='YaHei',fontSize=8.1,leading=13.5,textColor=MUTED,wordWrap='CJK'),
 'table': ParagraphStyle('table',fontName='YaHei',fontSize=9,leading=15,textColor=INK,wordWrap='CJK'),
 'th': ParagraphStyle('th',fontName='YaHeiBold',fontSize=9,leading=15,textColor=PURPLE,wordWrap='CJK'),
 'note': ParagraphStyle('note',fontName='YaHei',fontSize=9.2,leading=15.3,textColor=PURPLE,wordWrap='CJK'),
}

def para(txt,kind='body'):
    return Paragraph(escape(txt).replace('\n','<br/>'),ST[kind])

def flow_diagram(lines,idx):
    """Create a technical operation diagram, with no real or reconstructed user data."""
    dest=FIGS/f'flow-{idx:02}.png'
    im=PILImage.new('RGB',(1500,410),'white')
    d=ImageDraw.Draw(im)
    f=ImageFont.truetype(str(FONT_DIR/'msyh.ttc'),28)
    b=ImageFont.truetype(str(FONT_DIR/'msyhbd.ttc'),32)
    n=len(lines); bw=(1420-(n-1)*38)/n
    for i,line in enumerate(lines):
        x=40+i*(bw+38)
        d.rounded_rectangle((x,55,x+bw,335),radius=18,fill=LIGHT,outline='#d7c5d4',width=2)
        d.ellipse((x+20,77,x+68,125),fill=PURPLE)
        d.text((x+44,101),str(i+1),font=f,fill='white',anchor='mm')
        parts=textwrap.wrap(line,width=max(6,int((bw-32)/30)),break_long_words=True)
        for j,t in enumerate(parts):
            d.text((x+bw/2,183+j*44),t,font=b,fill=INK,anchor='mm')
        if i<n-1:
            d.line((x+bw+7,204,x+bw+31,204),fill=PURPLE,width=4)
            d.polygon([(x+bw+31,204),(x+bw+22,197),(x+bw+22,211)],fill=PURPLE)
    d.text((40,375),'操作示意图  按当前功能和页面入口整理',font=ImageFont.truetype(str(FONT_DIR/'msyh.ttc'),23),fill=MUTED)
    im.save(dest,optimize=True)
    return dest

def web_diagram(title,idx):
    dest=FIGS/f'web-{idx:02}.png'
    im=PILImage.new('RGB',(1500,610),'white');d=ImageDraw.Draw(im)
    f=ImageFont.truetype(str(FONT_DIR/'msyh.ttc'),28)
    b=ImageFont.truetype(str(FONT_DIR/'msyhbd.ttc'),35)
    small=ImageFont.truetype(str(FONT_DIR/'msyh.ttc'),24)
    d.rounded_rectangle((26,22,1474,566),radius=15,fill=BG,outline='#d7c5d4',width=2)
    d.text((58,47),'紫荆网站  /  示例游戏社群',font=small,fill=PURPLE)
    d.text((58,94),title.removeprefix('在网站'),font=b,fill=INK)
    d.rounded_rectangle((58,158,970,530),radius=10,fill='white')
    if '风采' in title:
        fields=[('标题  必填','填写这次共同经历的标题'),('精彩记录  选填','补充活动经过或想分享的瞬间'),('活动照片与视频','照片最多 6 张  视频或链接二选一')]
        action='提交审核'
        tips=['① 确认目标社群','② 标题必填  其余按需','③ 预览选中的照片或视频','④ 提交后查看我的投稿']
    else:
        fields=[('类型','选择社群活动或社群通知'),('标题与内容  必填','填写活动或通知的实际安排'),('活动报名配置','活动按需启用问卷并配置开放时间')]
        action='发布社群活动'
        tips=['① 选择活动或通知','② 写清标题和内容','③ 活动可配置报名问卷','④ 发布后查看原详情']
    for j,(label,hint) in enumerate(fields):
        yy=178+j*85
        d.text((84,yy),label,font=small,fill=INK)
        d.rounded_rectangle((84,yy+33,934,yy+73),radius=6,fill='#faf8fa',outline='#d7c5d4')
        d.text((100,yy+37),hint,font=small,fill=MUTED)
    d.rounded_rectangle((84,457,404,510),radius=7,fill=PURPLE)
    d.text((244,483),action,font=f,fill='white',anchor='mm')
    for j,t in enumerate(tips):d.text((1004,204+j*76),t,font=f,fill=PURPLE)
    d.text((30,578),'网页操作示意  按当前字段简化展示  非线上截图  全部示例内容',font=small,fill=MUTED)
    im.save(dest,optimize=True);return dest

def prepare_images():
    records=[]
    for idx,p in enumerate(PAGES):
        if p['image']:
            suite,name=p['image']; src=ROOT/f'.data/manual-{suite}'/f'{name}-light-390-viewport.png'
            if not src.is_file(): raise FileNotFoundError(src)
            dst=FIGS/f'{name}.png'; shutil.copyfile(src,dst)
            p['figure']=dst
            p['caption']='源码界面映射示例  合成数据  页面首屏'
            records.append({'file':dst.name,'kind':'source-layout-mapping','suite':suite,'fixture':name,
                            'source':'miniprogram/src','synthetic':True,'nativeDeviceEvidence':False})
        elif p['diagram']:
            dst=(web_diagram(p['title'],idx) if p['title'] in ['在网站分享社群风采','发布社群活动与通知']
                 else flow_diagram(p['diagram'],idx))
            p['figure']=dst;p['caption']='操作示意图  依照当前入口与流程整理'
            records.append({'file':dst.name,'kind':'operation-diagram','synthetic':True})
    (HERE/'figures.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    return records

class Sheet:
    def __init__(self,c,num,title,tag='使用手册'):
        self.c=c;self.num=num;self.y=H-120;self.title=title
        c.setFillColor(colors.HexColor(BG));c.rect(0,0,W,H,fill=1,stroke=0)
        c.setFillColor(colors.HexColor(PURPLE));c.setFont('YaHeiBold',8.5)
        c.drawString(M,H-36,'竞在紫荆  /  网站与小程序')
        c.setFont('YaHei',8);c.drawRightString(W-M,H-36,tag)
        c.setFillColor(colors.HexColor(INK));c.setFont('YaHeiBold',21)
        c.drawString(M,H-82,title)
        c.setFillColor(colors.HexColor(MUTED));c.setFont('YaHei',8)
        c.drawString(M,25,'2026 年 10 月 18 日  /  小程序 0.5.1')
        c.drawRightString(W-M,25,f'{num:02d}')
        c.bookmarkPage(f'p{num}'); c.addOutlineEntry(title,f'p{num}',level=0,closed=False)

    def draw(self,obj,x=None,width=None):
        x=M if x is None else x;width=CW if width is None else width
        ww,hh=obj.wrap(width,1000)
        if self.y-hh<51: raise ValueError(f'Page {self.num} overflow: {self.title}; y={self.y}, height={hh}')
        obj.drawOn(self.c,x,self.y-hh);self.y-=hh
        return hh

    def text(self,t,kind='body',width=None,x=None,gap=8):
        self.draw(para(t,kind),x,width);self.y-=gap

    def table(self,rows,width=None,x=None):
        width=width or CW
        cells=[[para(str(t),'th' if i==0 else 'table') for t in row] for i,row in enumerate(rows)]
        n=len(rows[0]); widths=[width/n]*n
        if n==2: widths=[width*.36,width*.64]
        tbl=Table(cells,colWidths=widths,hAlign='LEFT')
        tbl.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor(LIGHT)),
                                ('BACKGROUND',(0,1),(-1,-1),colors.white),
                                ('VALIGN',(0,0),(-1,-1),'TOP'),
                                ('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),
                                ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),
                                ('LINEBELOW',(0,0),(-1,-1),.4,colors.HexColor('#e4dfe2'))]))
        self.draw(tbl,x,width);self.y-=12

    def note(self,t):
        p=para('操作提醒  '+t,'note');ww,hh=p.wrap(CW-24,1000)
        if self.y-hh-22<51: raise ValueError(f'Note overflow on {self.num} ({self.y} - {hh})')
        self.c.setFillColor(colors.HexColor(LIGHT));self.c.roundRect(M,self.y-hh-18,CW,hh+18,5,fill=1,stroke=0)
        p.drawOn(self.c,M+12,self.y-hh-8);self.y-=hh+30

def draw_steps(sheet,p,width=None,x=None,font='body'):
    for i,(label,body) in enumerate(p['steps'],1):
        html=f'<b>{i:02d}  {escape(label)}</b><br/>{escape(body)}'
        obj=Paragraph(html,ST[font]);sheet.draw(obj,x,width);sheet.y-=11

def build_pdf():
    pdf=OUT/'紫荆网站及小程序用户使用手册.pdf'
    c=canvas.Canvas(str(pdf),pagesize=(W,H),pageCompression=1)
    c.setTitle(TITLE);c.setAuthor('紫荆网站文档');c.setSubject('网站 1.1.0 与竞在紫荆小程序 0.5.1 的图文操作手册')
    c.setFillColor(colors.HexColor(BG));c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFont('YaHeiBold',12);c.setFillColor(colors.HexColor(PURPLE));c.drawString(52,H-80,'竞在紫荆')
    c.setFillColor(colors.HexColor(INK));c.setFont('YaHeiBold',32)
    c.drawString(52,H-170,'紫荆网站及小程序')
    c.drawString(52,H-218,'用户使用手册')
    c.setFont('YaHei',12);c.setFillColor(colors.HexColor(MUTED));c.drawString(54,H-263,'浏览  报名  申请  投稿  管理')
    # Cover is an operation overview, avoiding simulated real product screenshots.
    cover=flow_diagram(['注册与登录','参与活动社群','管理本人记录','处理授权工作'],99)
    c.drawImage(ImageReader(str(cover)),44,310,width=CW,height=139,mask='auto')
    t=para('面向普通用户、活动负责人和内容管理人员。按任务提供入口、分步操作、结果核对和异常处理，配有最新版源码界面映射及操作示意图。')
    _,hh=t.wrap(CW-20,150);t.drawOn(c,54,237-hh)
    c.setFillColor(colors.HexColor(PURPLE));c.setFont('YaHeiBold',11)
    c.drawString(54,133,'小程序 0.5.1  /  文档基线 2026 年 10 月 18 日')
    c.setFont('YaHei',9);c.drawString(54,109,'网站入口  https://home.thuzijing.top')
    c.setFillColor(colors.HexColor(MUTED));c.setFont('YaHei',8)
    c.drawString(54,61,'图内示例不代表真实活动、报名或个人信息')
    c.bookmarkPage('p1');c.addOutlineEntry('封面','p1',0,False);c.showPage()

    # Version page before table of contents, followed by task pages.
    sequence=[(PAGES[0],2),('toc',3)]+[(p,i+3) for i,p in enumerate(PAGES[1:],1)]
    for p,num in sequence:
        if p=='toc':
            s=Sheet(c,num,'按任务查阅','目录')
            s.text('点击 PDF 目录条目或书签可跳转。管理入口按当前权限出现；操作前先看每页的适用读者。')
            start=s.y-20
            for col,(lo,hi,heading) in enumerate([(0,18,'上手与个人事务'),(18,len(PAGES),'管理与查阅')]):
                x=M+col*(CW/2+10);right=x+CW/2-14
                c.setFont('YaHeiBold',11);c.setFillColor(colors.HexColor(PURPLE));c.drawString(x,start,heading)
                for row,idx in enumerate(range(lo,hi)):
                    item=PAGES[idx];pn=2 if idx==0 else idx+3;y=start-34-row*25
                    c.setFont('YaHei',9);c.setFillColor(colors.HexColor(INK));c.drawString(x,y,item['title'])
                    c.setFillColor(colors.HexColor(PURPLE));c.drawRightString(right,y,str(pn))
                    c.linkAbsolute(item['title'],f'p{pn}',Rect=(x,y-5,right,y+13),thickness=0)
            c.showPage();continue
        s=Sheet(c,num,p['title'],p['audience']);s.text(p['intro'])
        if p.get('image'):
            # Screenshots retain their original source label and show the first viewport only.
            # Right column is for concise reading cues; full steps follow at normal body size.
            im=PILImage.open(p['figure']);iw=196;ih=iw*im.height/im.width
            top=s.y
            c.drawImage(ImageReader(str(p['figure'])),M,top-ih,width=iw,height=ih,mask='auto')
            c.setStrokeColor(colors.HexColor('#ded5dc'));c.rect(M,top-ih,iw,ih,fill=0,stroke=1)
            s.y=top
            for j,(label,body) in enumerate(p['steps'],1):
                s.text(f'{j:02d}  {label}',kind='note',x=M+214,width=CW-214,gap=5)
                s.text(body,x=M+214,width=CW-214,gap=11)
            s.y=min(s.y,top-ih)-9
            s.text(p['caption'],kind='small',gap=11)
        else:
            draw_steps(s,p)
            if p['table']:s.table(p['table'])
            if p.get('figure'):
                im=PILImage.open(p['figure']);ih=CW*im.height/im.width
                s.draw(Image(str(p['figure']),width=CW,height=ih));s.y-=12
        if p['note']:s.note(p['note'])
        if p['links']:
            label='常用入口  '+'  /  '.join(label for _,label in p['links'])
            # Accessible explicit URLs, with live PDF links beneath the page content.
            s.text(label,kind='small',gap=3)
            for path,label in p['links']:
                url='https://home.thuzijing.top'+path
                s.text(url,kind='small',gap=2)
                c.linkURL(url,rect=(M,s.y+2,W-M,s.y+16),relative=0,thickness=0)
        c.showPage()
    c.save();return pdf

def build_html():
    def image_tag(path,alt):
        data=base64.b64encode(path.read_bytes()).decode()
        return f'<img src="data:image/png;base64,{data}" alt="{escape(alt)}">'
    nav=[];sections=[]
    for idx,p in enumerate(PAGES):
        pn=2 if idx==0 else idx+3
        nav.append(f'<a href="#s{idx}">{escape(p["title"])}<span>{pn}</span></a>')
        steps=''.join(f'<li><h3>{escape(t)}</h3><p>{escape(b)}</p></li>' for t,b in p['steps'])
        figure=''
        if p.get('figure'):
            cls='phone' if p.get('image') else 'flow'
            figure=f'<figure class="{cls}">{image_tag(p["figure"],p["caption"]+" "+p["title"])}<figcaption>{escape(p["caption"])}</figcaption></figure>'
        table=''
        if p['table']:
            rows=[]
            for i,row in enumerate(p['table']):
                tag='th' if i==0 else 'td';rows.append('<tr>'+''.join(f'<{tag}>{escape(str(x))}</{tag}>' for x in row)+'</tr>')
            table='<div class="scroll"><table>'+''.join(rows)+'</table></div>'
        links=''.join(f'<a href="https://home.thuzijing.top{path}">{escape(label)}</a> ' for path,label in p['links'])
        note=f'<aside><strong>操作提醒</strong> {escape(p["note"])}</aside>' if p['note'] else ''
        sections.append(f'<section id="s{idx}"><div class="eyebrow">{escape(p["audience"])} · PDF 第 {pn} 页</div><h2>{escape(p["title"])}</h2><p class="intro">{escape(p["intro"])}</p><div class="reading {"illustrated" if p.get("image") else ""}">{figure if p.get("image") else ""}<ol>{steps}</ol></div>{table}{figure if not p.get("image") else ""}{note}<p class="links">{links}</p><a class="top" href="#contents">返回目录 ↑</a></section>')
    html='''<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>紫荆网站及小程序用户使用手册</title><style>
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f7f5f0;color:#23212a;font:16px/1.9 "Microsoft YaHei",sans-serif}header,main,nav{max-width:1060px;margin:auto;padding:44px 34px}header{padding-top:70px}header h1{font-size:40px;line-height:1.45;margin:14px 0}header p{max-width:760px}.eyebrow{font-size:13px;color:#6f2d67;letter-spacing:1px}nav{background:white;border-radius:16px;padding:28px 34px;columns:2;column-gap:44px}nav h2{column-span:all}nav a{display:flex;justify-content:space-between;gap:15px;margin:0 0 5px;break-inside:avoid}a{color:#6f2d67;text-decoration:none}a:hover{text-decoration:underline}a:focus-visible{outline:3px solid #6f2d67;outline-offset:4px}section{scroll-margin-top:20px;padding:38px 0 48px;border-bottom:1px solid #ddd5dc}h2{font-size:28px;line-height:1.5;margin:10px 0 22px}h3{font-size:17px;margin:0 0 5px}p{margin:0 0 16px}ol{padding-left:25px;margin-top:0}li{padding-left:4px;margin-bottom:18px}figure{margin:10px 0 24px}figure img{display:block;max-width:100%;height:auto}.illustrated{display:grid;grid-template-columns:minmax(240px,350px) 1fr;gap:36px}.phone{margin:0}.phone img{width:100%;border:1px solid #ddd5dc}.flow img{width:100%}figcaption{font-size:12px;color:#65616c;line-height:1.7;margin-top:7px}aside{background:#f1e8f0;color:#6f2d67;padding:18px 22px;border-radius:9px;margin:20px 0}.links{font-size:14px}.links a{margin-right:16px}.top{font-size:13px}.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;margin:12px 0 24px;font-size:14px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #e4dfe2;padding:11px 14px}th{background:#f1e8f0;color:#6f2d67}td{background:white}.hint{color:#65616c;font-size:14px}@media(max-width:740px){header,main,nav{padding:28px 20px}header h1{font-size:30px}nav{columns:1;margin:0 12px}.illustrated{display:block}.phone{max-width:390px;margin:20px auto}h2{font-size:24px}}@media print{body{background:white}nav{columns:2}.top{display:none}section{break-before:page}.phone{max-width:240px}a{color:inherit}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style></head><body><header><div class="eyebrow">竞在紫荆  /  图文使用手册</div><h1>紫荆网站及小程序<br>用户使用手册</h1><p>浏览、报名、申请、投稿与授权管理。适用小程序 0.5.1，网站文档基线截至 2026 年 10 月 18 日。</p><p class="hint">本文件可离线双击打开，图片已内嵌。Ctrl+F 可搜索；目录可跳转。图中全部为合成示例，源码界面映射不代表微信原生或真机截图。</p><p><a href="https://home.thuzijing.top">打开紫荆网站</a></p></header><nav id="contents" aria-label="手册目录"><h2>按任务查阅</h2>'''+''.join(nav)+'</nav><main>'+''.join(sections)+'</main></body></html>'
    dest=OUT/'紫荆网站及小程序用户使用手册.html';dest.write_text(html,encoding='utf-8',newline='\n');return dest

def build_markdown():
    parts=['# '+TITLE,'','适用小程序 0.5.1；文档日期 2026 年 10 月 18 日。','']
    for p in PAGES:
        parts.extend(['## '+p['title'],'','适用读者：'+p['audience'],'',p['intro'],''])
        for i,(label,body) in enumerate(p['steps'],1):parts.extend([f'{i}. **{label}** {body}',''])
        if p['table']:
            parts+=['| '+' | '.join(p['table'][0])+' |','| '+' | '.join(['---']*len(p['table'][0]))+' |']
            parts+=['| '+' | '.join(row)+' |' for row in p['table'][1:]]
            parts+=['']
        if p.get('figure'):parts.extend([f'![{p["caption"]}](figures/{p["figure"].name})',''])
        if p['note']:parts.extend(['> 操作提醒：'+p['note'],''])
        for path,label in p['links']:parts.append(f'[{label}](https://home.thuzijing.top{path})')
        parts.append('')
    (HERE/'用户使用手册.md').write_text('\n'.join(parts).rstrip()+'\n',encoding='utf-8',newline='\n')

if __name__=='__main__':
    images=prepare_images()
    pdf=build_pdf();web=build_html();build_markdown()
    import pymupdf
    doc=pymupdf.open(pdf)
    expected=len(PAGES)+2
    if len(doc)!=expected: raise ValueError(f'{len(doc)} pages expected {expected}')
    for i,p in enumerate(doc):
        p.get_pixmap(matrix=pymupdf.Matrix(1.25,1.25),alpha=False).save(QA/f'page-{i+1:02}.png')
    counts={'pages':len(doc),'chapters':len(PAGES),'figures':len(images)+1,
            'sourceLayoutFigures':sum(x['kind']=='source-layout-mapping' for x in images),
            'operationDiagrams':sum(x['kind']=='operation-diagram' for x in images)+1,
            'pdfBytes':pdf.stat().st_size,'htmlBytes':web.stat().st_size,
            'textCharacters':sum(len(p.get_text()) for p in doc),
            'sourceBaseline':'a07d8c1','miniappVersion':'0.5.1','manualDate':'2026-10-18',
            'nativeScreenshots':False,'realUserData':False}
    (QA/'build-summary.json').write_text(json.dumps(counts,indent=2,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps(counts,ensure_ascii=False))
