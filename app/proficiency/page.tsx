'use client';
import { useEffect, useMemo, useState } from 'react';

type ProfRec = { correct: number; wrong: number; level: number };
const PROF_KEY = 'web-proficiency';

export default function ProficiencyPage() {
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('quiz-theme') || 'light';
      document.body.classList.toggle('dark', saved === 'dark');
      const onStorage = (e: StorageEvent) => { if (e.key === 'quiz-theme') document.body.classList.toggle('dark', (e.newValue||'light') === 'dark'); };
      window.addEventListener('storage', onStorage);
      setThemeReady(true);
      return () => window.removeEventListener('storage', onStorage);
    }
  }, []);

  const items = useMemo(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(PROF_KEY) : null;
      const obj: Record<string, ProfRec> = raw ? JSON.parse(raw) : {};
      const arr = Object.entries(obj).map(([k, v]) => ({ key: k, ...v })).sort((a,b) => (b.level - a.level) || (b.correct - a.correct) || (a.key.localeCompare(b.key)));
      return arr;
    } catch { return []; }
  }, [themeReady]);

  function levelDotClass(level: number) {
    if (level >= 4) return 'wb-green';
    if (level === 3) return 'wb-yellow';
    if (level === 2) return 'wb-orange';
    if (level === 1) return 'wb-red';
    return 'wb-blue';
  }

  const stats = useMemo(() => {
    const total = items.length;
    const sumCorrect = items.reduce((s, x) => s + (Number(x.correct) || 0), 0);
    const sumWrong = items.reduce((s, x) => s + (Number(x.wrong) || 0), 0);
    const sumLevel = items.reduce((s, x) => s + (Number(x.level) || 0), 0);
    const avgLevel = total ? (sumLevel / total) : 0;
    const dist = Array.from({ length: 6 }, () => 0);
    items.forEach(x => { const l = Math.max(0, Math.min(5, Number(x.level) || 0)); dist[l] += 1; });
    return { total, sumCorrect, sumWrong, avgLevel, dist };
  }, [items]);

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand"><div className="logo" aria-hidden="true" /><h1>熟练度</h1></div>
        <div className="actions"><button onClick={()=>window.open('/', '_self')}>返回</button></div>
      </div>

      <section className="panel">
        <div className="stat-cards">
          <div className="stat-card"><div className="stat-title">条目</div><div className="stat-value">{stats.total}</div></div>
          <div className="stat-card"><div className="stat-title">正确</div><div className="stat-value">{stats.sumCorrect}</div></div>
          <div className="stat-card"><div className="stat-title">错误</div><div className="stat-value">{stats.sumWrong}</div></div>
          <div className="stat-card"><div className="stat-title">平均熟练度</div><div className="stat-value">{stats.avgLevel.toFixed(2)}</div></div>
        </div>
        <div className="level-bar" title="熟练度分布 0~5">
          {stats.dist.map((n, i) => {
            const pct = stats.total ? (n / stats.total * 100) : 0;
            return <div key={i} className={`level-seg l${i}`} style={{ width: pct + '%' }} title={`Lv${i}: ${n}`} />
          })}
        </div>
        {items.length === 0 ? (
          <div style={{color:'var(--muted)'}}>暂无数据。</div>
        ) : (
          <table className="prof-table" style={{width:'100%', borderCollapse:'separate', borderSpacing:0}}>
            <thead>
              <tr style={{textAlign:'left', color:'var(--muted)'}}>
                <th style={{padding:'8px 6px'}}>类别|位号</th>
                <th style={{padding:'8px 6px'}}>正确</th>
                <th style={{padding:'8px 6px'}}>错误</th>
                <th style={{padding:'8px 6px'}}>熟练度</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.key}>
                  <td style={{padding:'8px 6px', borderTop:'1px solid var(--border)'}}>
                    <span className={`wb-dot ${levelDotClass(it.level)}`} />
                    <span style={{marginLeft:8}}>{it.key}</span>
                  </td>
                  <td style={{padding:'8px 6px', borderTop:'1px solid var(--border)'}}>{it.correct}</td>
                  <td style={{padding:'8px 6px', borderTop:'1px solid var(--border)'}}>{it.wrong}</td>
                  <td style={{padding:'8px 6px', borderTop:'1px solid var(--border)'}}>
                    <div style={{display:'flex', gap:6}}>
                      {Array.from({length:5}).map((_,i)=>(
                        <div key={i} className={'dot' + (i < it.level ? ' active' : '')} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}


