'use client';
import { useEffect, useMemo, useState } from 'react';

type Equip = { tag: string; name: string };
type Valve = { tag: string; name: string; floor?: string };
type Perf = { tag: string; name: string; medium?: string; power_kw?: string; head_m?: string; flow_m3h?: string; speed_rpm?: string; pressure_bar?: string; diameter_m?: string; length_m?: string; volume_m3?: string; rated_current_a?: string };
type Std = { control_tag: string; name: string; tag?: string; unit?: string; standard?: string };

type ProfRec = { correct: number; wrong: number; level: number };

const PROF_KEY = 'web-proficiency';
const TAG_BASE_RE = /^([A-Z]+\d+)/;
const canonicalTag = (tag?: string) => {
  if (!tag) return '';
  const s = String(tag).trim().toUpperCase().replaceAll(' ', '').replaceAll('^','/');
  const m = s.match(TAG_BASE_RE);
  return m ? m[1] : s;
};

export default function WrongbookPage() {
  const [eq, setEq] = useState<Record<string, Equip>>({});
  const [va, setVa] = useState<Record<string, Valve>>({});
  const [pf, setPf] = useState<Record<string, Perf>>({});
  const [std, setStd] = useState<Record<string, Std>>({});

  // 跟随主页面的深浅色主题
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('quiz-theme') || 'light';
      document.body.classList.toggle('dark', saved === 'dark');
      const onStorage = (e: StorageEvent) => {
        if (e.key === 'quiz-theme') {
          document.body.classList.toggle('dark', (e.newValue || 'light') === 'dark');
        }
      };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }
  }, []);

  useEffect(() => {
    async function boot() {
      const parse = (text: string) => {
        const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(x => x.trim().length > 0);
        const headers = lines[0].split(',').map(h => h.trim());
        return lines.slice(1).map(line => {
          const cols = line.split(',');
          const row: Record<string, string> = {};
          headers.forEach((h, i) => row[h] = (cols[i] || '').trim());
          return row;
        });
      };

      try {
        const [eqRes, vaRes, pfRes, stdRes] = await Promise.all([
          fetch('/data/equipment.csv'),
          fetch('/data/valves.csv'),
          fetch('/data/performance.csv'),
          fetch('/data/standard.csv'),
        ]);
        if (eqRes.ok) {
          const rows = parse(await eqRes.text()); const m: Record<string, Equip> = {};
          rows.forEach((r:any)=>{ const t=canonicalTag(r.tag||''); const n=(r.name||'').trim(); if(t&&n) m[t]={tag:t,name:n}; });
          setEq(m);
        }
        if (vaRes.ok) {
          const rows = parse(await vaRes.text()); const m: Record<string, Valve> = {};
          rows.forEach((r:any)=>{ const t=canonicalTag(r.tag||''); const n=(r.name||'').trim(); const f=(r.floor||'').trim(); if(t&&n) m[t]={tag:t,name:n,floor:f}; });
          setVa(m);
        }
        if (pfRes.ok) {
          const rows = parse(await pfRes.text()); const m: Record<string, Perf> = {};
          rows.forEach((r:any)=>{ const t=canonicalTag(r.tag||''); const n=(r.name||'').trim(); if(!t||!n) return; m[t]={
            tag:t, name:n, medium:r.medium?.trim(), power_kw:r.power_kw?.trim(), head_m:r.head_m?.trim(), flow_m3h:r.flow_m3h?.trim(), speed_rpm:r.speed_rpm?.trim(), pressure_bar:r.pressure_bar?.trim(), diameter_m:r.diameter_m?.trim(), length_m:r.length_m?.trim(), volume_m3:r.volume_m3?.trim(), rated_current_a:r.rated_current_a?.trim()
          }; });
          setPf(m);
        }
        if (stdRes.ok) {
          const rows = parse(await stdRes.text()); const m: Record<string, Std> = {};
          rows.forEach((r:any)=>{ const ct=(r.control_tag||'').trim(); if(!ct) return; m[ct]={control_tag:ct,name:(r.name||'').trim(), tag:(r.tag||'').trim(), unit:(r.unit||'').trim(), standard:(r.standard||'').trim()}; });
          setStd(m);
        }
      } catch {}
    }
    boot();
  }, []);

  function severity(count: number) {
    if (count >= 8) return 'red';
    if (count >= 5) return 'orange';
    if (count >= 3) return 'yellow';
    if (count >= 1) return 'green';
    return 'blue';
  }

  const items = useMemo(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(PROF_KEY) : null;
      const obj: Record<string, ProfRec> = raw ? JSON.parse(raw) : {};
      const arr = Object.entries(obj).map(([k, rec]) => {
        const [category, tag] = k.split('|');
        let name = '';
        if (category === '设备') name = eq[tag]?.name || '';
        else if (category === '阀门') name = va[tag]?.name || '';
        else if (category === '性能参数') name = pf[tag]?.name || '';
        else if (category === '工艺指标') name = std[tag]?.name || '';
        const wrong = Number(rec.wrong) || 0;
        return { category, tag, name, wrong, sev: severity(wrong) };
      }).filter(it => it.wrong > 0); // 只保留确有错误的题目
      const order = { red:5, orange:4, yellow:3, green:2, blue:1 } as Record<string,number>;
      arr.sort((a,b) => (order[b.sev]-order[a.sev]) || (b.wrong - a.wrong) || a.category.localeCompare(b.category) || a.tag.localeCompare(b.tag));
      return arr;
    } catch { return []; }
  }, [eq,va,pf,std]);

  function buildTruth(category: string, tag: string) {
    if (category === '设备') { const e = eq[tag]; return e ? { name: e.name } : null; }
    if (category === '阀门') { const v = va[tag]; if (!v) return null; const o:any = { name: v.name }; if (v.floor) o.floor = v.floor; return o; }
    if (category === '工艺指标') { const s = std[tag]; if (!s) return null; const o:any = { name: s.name }; if (s.tag) o.tag = s.tag; if (s.control_tag) o.control_tag = s.control_tag; if (s.unit) o.unit = s.unit; if (s.standard) o.standard = s.standard; return o; }
    const p = pf[tag]; if (!p) return null; const o:any = {};
    const labels = ['name','medium','power_kw','head_m','flow_m3h','speed_rpm','pressure_bar','diameter_m','length_m','volume_m3','rated_current_a'] as const;
    labels.forEach(k => { const v = (p as any)[k]; if (v) o[k] = v; });
    return o;
  }

  const perfLabels = {
    name: '名称', medium: '介质', power_kw: '功率(kW)', head_m: '扬程(m)', flow_m3h: '流量(m3/h)', speed_rpm: '转速(rpm)', pressure_bar: '压力(bar)', diameter_m: '直径(m)', length_m: '长度(m)', volume_m3: '容积(m3)', rated_current_a: '额定电流(A)'
  } as const;
  const stdLabels: Record<string,string> = { name:'设备名称及控制项目', tag:'设备位号', control_tag:'项目控制位号', unit:'单位', standard:'控制指标' };

  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand"><div className="logo" aria-hidden="true" /><h1>错题本</h1></div>
        <div className="actions"><button onClick={()=>window.open('/', '_self')}>返回</button></div>
      </div>

      <section className="panel">
        {items.length === 0 ? (
          <div style={{color:'var(--muted)'}}>暂无记录。请先在练习页答题。</div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(2, minmax(280px,1fr))',gap:12}}>
            {items.map(it => {
              const key = it.category + '|' + it.tag;
              const opened = openKey === key;
              const truth = opened ? buildTruth(it.category, it.tag) : null;
              const lines: string[] = [];
              if (truth) {
                lines.push('位号：' + it.tag);
                Object.entries(truth as Record<string,string>).forEach(([k,v]) => {
                  const label = (perfLabels as any)[k] || (stdLabels as any)[k] || k;
                  lines.push(`${label}：${v}`);
                });
              }
              return (
                <div key={key} style={{border:'1px solid var(--border)',borderRadius:10,padding:'10px 12px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}} onClick={()=>setOpenKey(opened?null:key)}>
                    <span className={`wb-dot wb-${it.sev}`} />
                    <strong>{it.tag}</strong>
                    <span style={{color:'var(--muted)'}}>{it.name}</span>
                    <span style={{marginLeft:'auto',color:'var(--muted)'}}>错 {it.wrong}</span>
                    <span className="badge">{it.category}</span>
                  </div>
                  {opened && truth && (
                    <pre className="answer" style={{marginTop:8}}>{lines.join('\n')}</pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}


