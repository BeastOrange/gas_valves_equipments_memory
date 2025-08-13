'use client';
import { useEffect, useMemo, useState } from 'react';

type Equip = { tag: string; name: string };
type Valve = { tag: string; name: string; floor?: string };
type Perf = { tag: string; name: string };
type Std = { control_tag: string; name: string };

type ProfRec = { correct: number; wrong: number; level: number };

const PROF_KEY = 'web-proficiency';

export default function WrongbookPage() {
  const [eq, setEq] = useState<Record<string, Equip>>({});
  const [va, setVa] = useState<Record<string, Valve>>({});
  const [pf, setPf] = useState<Record<string, Perf>>({});
  const [std, setStd] = useState<Record<string, Std>>({});

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
          rows.forEach((r:any)=>{ const t=(r.tag||'').trim(); const n=(r.name||'').trim(); if(t&&n) m[t]={tag:t,name:n}; });
          setEq(m);
        }
        if (vaRes.ok) {
          const rows = parse(await vaRes.text()); const m: Record<string, Valve> = {};
          rows.forEach((r:any)=>{ const t=(r.tag||'').trim(); const n=(r.name||'').trim(); if(t&&n) m[t]={tag:t,name:n}; });
          setVa(m);
        }
        if (pfRes.ok) {
          const rows = parse(await pfRes.text()); const m: Record<string, Perf> = {};
          rows.forEach((r:any)=>{ const t=(r.tag||'').trim(); const n=(r.name||'').trim(); if(t&&n) m[t]={tag:t,name:n}; });
          setPf(m);
        }
        if (stdRes.ok) {
          const rows = parse(await stdRes.text()); const m: Record<string, Std> = {};
          rows.forEach((r:any)=>{ const ct=(r.control_tag||'').trim(); const n=(r.name||'').trim(); if(ct) m[ct]={control_tag:ct,name:n}; });
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
            {items.map(it => (
              <div key={it.category+it.tag} style={{display:'flex',alignItems:'center',gap:10,border:'1px solid var(--border)',borderRadius:10,padding:'10px 12px'}}>
                <span className={`wb-dot wb-${it.sev}`} />
                <strong>{it.tag}</strong>
                <span style={{color:'var(--muted)'}}>{it.name}</span>
                <span style={{marginLeft:'auto',color:'var(--muted)'}}>错 {it.wrong}</span>
                <span className="badge">{it.category}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}


