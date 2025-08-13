'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

type Equip = { tag: string; name: string };
type Valve = { tag: string; name: string; floor?: string };
type Perf = { tag: string; name: string; medium?: string; power_kw?: string; head_m?: string; flow_m3h?: string; speed_rpm?: string; pressure_bar?: string; diameter_m?: string; length_m?: string; volume_m3?: string; rated_current_a?: string };
type Std = { control_tag: string; name: string; tag?: string; unit?: string; standard?: string };

const TAG_BASE_RE = /^([A-Z]+\d+)/;
const normalize = (t?: string) => {
  if (!t) return '';
  let s = String(t).trim().toLowerCase();
  [' ', 'kw', 'rpm', 'r/min', 'm3/h', 'm3h', 'm3', '/h', 'bar', 'mpa', 'm', '（', '）', '(', ')', '：', ':', '，', ','].forEach(k => s = s.replaceAll(k, ''));
  s = s.replaceAll('／','/').replaceAll('～','~').replaceAll('－','-');
  s = s.replaceAll('~','/').replaceAll('-','/');
  return s;
};
const canonicalTag = (tag?: string) => {
  if (!tag) return '';
  const s = String(tag).trim().toUpperCase().replaceAll(' ', '').replaceAll('^','/');
  const m = s.match(TAG_BASE_RE);
  return m ? m[1] : s;
};
const isCorrect = (user?: string, truth?: string, strict = false) => {
  const u = normalize(user), v = normalize(truth);
  if (!v) return true;
  if (strict) return u === v || (!!u && !!v && v.includes(u) && u.length >= v.length);
  return u === v || (!!u && !!v && (u.includes(v) || v.includes(u)));
};

export default function Page() {
  const [theme, setTheme] = useState<string>('light');
  const [category, setCategory] = useState('设备');
  const [limit, setLimit] = useState('');
  const [eq, setEq] = useState<Record<string, Equip>>({});
  const [va, setVa] = useState<Record<string, Valve>>({});
  const [pf, setPf] = useState<Record<string, Perf>>({});
  const [std, setStd] = useState<Record<string, Std>>({}); // 工艺指标
  const [list, setList] = useState<[string, string][]>([]);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [exam, setExam] = useState(false);
  const [showDonate, setShowDonate] = useState(false);
  const [profTick, setProfTick] = useState(0); // 用于触发重渲染

  useEffect(() => {
    // 仅在客户端访问 localStorage，避免 SSR 报错
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('quiz-theme') || 'light';
      setTheme(saved);
      document.body.classList.toggle('dark', saved === 'dark');
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.body.classList.toggle('dark', theme === 'dark');
      window.localStorage.setItem('quiz-theme', theme);
    }
  }, [theme]);

  const perfLabels = {
    name: '名称', medium: '介质', power_kw: '功率(kW)', head_m: '扬程(m)', flow_m3h: '流量(m3/h)', speed_rpm: '转速(rpm)', pressure_bar: '压力(bar)', diameter_m: '直径(m)', length_m: '长度(m)', volume_m3: '容积(m3)', rated_current_a: '额定电流(A)'
  } as const;
  const stdLabels: Record<string,string> = {
    name: '设备名称及控制项目',
    tag: '设备位号',
    control_tag: '项目控制位号',
    unit: '单位',
    standard: '控制指标',
  };

  const cur = useMemo(() => list[idx] || null, [list, idx]);

  // 本地熟练度存储（localStorage）
  const PROF_KEY = 'web-proficiency';
  type ProfRec = { correct: number; wrong: number; level: number };
  function getProf(category: string, tag: string): ProfRec {
    if (typeof window === 'undefined') return { correct: 0, wrong: 0, level: 0 };
    try {
      const raw = window.localStorage.getItem(PROF_KEY);
      const obj: Record<string, ProfRec> = raw ? JSON.parse(raw) : {};
      const rec = obj[`${category}|${tag}`] || { correct: 0, wrong: 0, level: 0 };
      const level = Math.min(5, Math.max(0, Number(rec.level) || 0));
      return { correct: Number(rec.correct) || 0, wrong: Number(rec.wrong) || 0, level };
    } catch { return { correct: 0, wrong: 0, level: 0 }; }
  }
  function setProf(category: string, tag: string, isOk: boolean) {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(PROF_KEY);
      const obj: Record<string, ProfRec> = raw ? JSON.parse(raw) : {};
      const key = `${category}|${tag}`;
      const rec = obj[key] || { correct: 0, wrong: 0, level: 0 };
      if (isOk) {
        rec.correct = (rec.correct || 0) + 1;
        rec.level = Math.min(5, (rec.level || 0) + 1);
      } else {
        rec.wrong = (rec.wrong || 0) + 1;
        rec.level = Math.max(0, (rec.level || 0) - 1);
      }
      obj[key] = rec;
      window.localStorage.setItem(PROF_KEY, JSON.stringify(obj));
      setProfTick(x => x + 1);
    } catch {}
  }

  function setPerfFields(c: string, t: string) {
    if (c === '设备') return ['name'];
    if (c === '阀门') return va[t]?.floor ? ['name','floor'] : ['name'];
    if (c === '工艺指标') return ['name','tag','control_tag','unit','standard'].filter(k => (std[t] as any)?.[k]);
    const p = pf[t];
    const cand = ['name','medium','power_kw','head_m','flow_m3h','speed_rpm','pressure_bar','diameter_m','length_m','volume_m3','rated_current_a'] as const;
    return cand.filter(k => (p as any)?.[k]);
  }

  async function parseCsv(file: File) {
    const text = await file.text();
    const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(x => x.trim().length > 0);
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const cols = line.split(',');
      const row: Record<string, string> = {};
      headers.forEach((h, i) => row[h] = (cols[i] || '').trim());
      return row;
    });
  }

  function sampleByRatio(items: [string, string][], ratio: number) {
    const k = Math.max(1, Math.ceil(items.length * ratio));
    const copy = items.slice();
    copy.sort(() => Math.random() - 0.5);
    return copy.slice(0, k);
  }

  function start() {
    const items: [string, string][] = [];
    const eqItems = Object.keys(eq).map(t => ['设备', t] as [string,string]);
    const vaItems = Object.keys(va).map(t => ['阀门', t] as [string,string]);
    const pfItems = Object.keys(pf).map(t => ['性能参数', t] as [string,string]);
    const stdItems = Object.keys(std).map(t => ['工艺指标', t] as [string,string]);

    if (exam) {
      const R = 0.33; // 固定占比 33%
      if (category === '设备') items.push(...sampleByRatio(eqItems, R));
      else if (category === '阀门') items.push(...sampleByRatio(vaItems, R));
      else if (category === '性能参数') items.push(...sampleByRatio(pfItems, R));
      else if (category === '工艺指标') items.push(...sampleByRatio(stdItems, R));
      else {
        items.push(...sampleByRatio(eqItems, R));
        items.push(...sampleByRatio(vaItems, R));
        items.push(...sampleByRatio(pfItems, R));
        items.push(...sampleByRatio(stdItems, R));
      }
    } else {
      if (category === '设备') items.push(...eqItems);
      else if (category === '阀门') items.push(...vaItems);
      else if (category === '性能参数') items.push(...pfItems);
      else if (category === '工艺指标') items.push(...stdItems);
      else { items.push(...eqItems, ...vaItems, ...pfItems, ...stdItems); }
    }
    if (items.length === 0) { alert('请先导入 CSV 数据'); return; }
    items.sort(() => Math.random() - 0.5);
    const lim = parseInt(limit || '0', 10);
    setList(Number.isFinite(lim) && lim > 0 ? items.slice(0, lim) : items);
    setIdx(0); setCorrect(0); setAnswer(null); setOk(null);
    setTimeout(() => nameRef.current?.focus(), 50);
  }

  // 首次挂载：自动加载 public/data 下的三张 CSV
  useEffect(() => {
    async function boot() {
      try {
        const [eqRes, vaRes, pfRes] = await Promise.all([
          fetch('/data/equipment.csv'),
          fetch('/data/valves.csv'),
          fetch('/data/performance.csv'),
        ]);
        const texts = await Promise.all([eqRes.text(), vaRes.text(), pfRes.text()]);
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
        // 设备
        const eqRows = parse(texts[0]);
        const eqMap: Record<string, Equip> = {};
        eqRows.forEach((r:any) => { const tag = canonicalTag(r.tag); const name = (r.name||'').trim(); if(tag && name) eqMap[tag] = { tag, name }; });
        setEq(eqMap);
        // 阀门
        const vaRows = parse(texts[1]);
        const vaMap: Record<string, Valve> = {};
        vaRows.forEach((r:any) => { const tag = canonicalTag(r.tag); const name = (r.name||'').trim(); const floor = (r.floor||'').trim(); if(tag && name) vaMap[tag] = { tag, name, floor }; });
        setVa(vaMap);
        // 性能
        const pfRows = parse(texts[2]);
        const pfMap: Record<string, Perf> = {};
        pfRows.forEach((r:any) => {
          const tag = canonicalTag(r.tag); const name = (r.name||'').trim(); if(!tag || !name) return;
          const p: Perf = { tag, name, medium:r.medium?.trim(), power_kw:r.power_kw?.trim(), head_m:r.head_m?.trim(), flow_m3h:r.flow_m3h?.trim(), speed_rpm:r.speed_rpm?.trim(), pressure_bar:r.pressure_bar?.trim(), diameter_m:r.diameter_m?.trim(), length_m:r.length_m?.trim(), volume_m3:r.volume_m3?.trim(), rated_current_a:r.rated_current_a?.trim() };
          if (pfMap[tag]) {
            const prev = pfMap[tag];
            (Object.keys(p) as (keyof Perf)[]).forEach(k => { if(k==='tag'||k==='name') return; const nv=p[k]; const ov=(prev as any)[k]; if(!nv) return; if(!ov) (prev as any)[k]=nv; else if (!normalize(String(ov)).includes(normalize(String(nv)))) (prev as any)[k]=String(ov)+'/'+String(nv); });
          } else { pfMap[tag] = p; }
        });
        setPf(pfMap);

        // 工艺指标 standard.csv
        try {
          const stdRes = await fetch('/data/standard.csv');
          if (stdRes.ok) {
            const stdTxt = await stdRes.text();
            const stdRows = parse(stdTxt);
            const stdMap: Record<string, Std> = {};
            stdRows.forEach((r:any) => {
              const key = (r.control_tag || '').trim();
              if (!key) return;
              stdMap[key] = {
                control_tag: key,
                name: (r.name||'').trim(),
                tag: (r.tag||'').trim(),
                unit: (r.unit||'').trim(),
                standard: (r.standard||'').trim(),
              };
            });
            setStd(stdMap);
          }
        } catch {}
      } catch (e) {
        // 忽略加载失败
      }
    }
    boot();
  }, []);

  function buildTruth(c: string, t: string) {
    if (c === '设备') { const e = eq[t]; return e ? { name: e.name } : null; }
    if (c === '阀门') { const v = va[t]; if (!v) return null; const o: any = { name: v.name }; if (v.floor) o.floor = v.floor; return o; }
    if (c === '工艺指标') { const s = std[t]; if (!s) return null; const o: any = { name: s.name }; if (s.tag) o.tag = s.tag; if (s.control_tag) o.control_tag = s.control_tag; if (s.unit) o.unit = s.unit; if (s.standard) o.standard = s.standard; return o; }
    const p = pf[t]; if (!p) return null; const o: any = {}; Object.keys(perfLabels).forEach(k => { const v = (p as any)[k]; if (v) o[k] = v; }); return o;
  }

  function submit(shortcut?: '1' | '2') {
    if (!cur) return;
    const [c, t] = cur;
    const truth = buildTruth(c, t);
    if (!truth) { alert('数据缺失'); return; }
    const form = document.getElementById('quizForm') as HTMLFormElement;
    const fd = new FormData(form);
    const get = (k: string) => String(fd.get(k) || '');
    const clearInputs = () => {
      if (!form) return;
      const inputs = Array.from(form.querySelectorAll('input')) as HTMLInputElement[];
      inputs.forEach(i => { i.value = ''; });
    };
    if (shortcut === '1' || shortcut === '2') {
      const okNow = shortcut === '1';
      showAnswer(truth, okNow);
      setProf(c, t, okNow);
      clearInputs();
      // 短暂停留 600ms 再进入下一题
      setTimeout(() => next(okNow), 600);
      return;
    }
    let okAll = isCorrect(get('name'), (truth as any).name, true);
    if (okAll && (truth as any).floor !== undefined) okAll = okAll && isCorrect(get('floor'), (truth as any).floor, true);
    Object.keys(truth).forEach(k => { if (k === 'name' || k === 'floor') return; okAll = okAll && isCorrect(get(k), (truth as any)[k], false); });
    showAnswer(truth, okAll);
    setProf(c, t, okAll);
    clearInputs();
    setTimeout(() => next(okAll), 600);
  }

  function onNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const v = e.currentTarget.value.trim();
    if (v === '1') {
      e.preventDefault();
      submit('1');
      e.currentTarget.value = '';
    } else if (v === '2') {
      e.preventDefault();
      submit('2');
      e.currentTarget.value = '';
    }
  }

  function showAnswer(truth: Record<string, string>, ok: boolean) {
    const lines = ['位号：' + (cur?.[1] || '-')];
    Object.entries(truth).forEach(([k, v]) => lines.push(`${(perfLabels as any)[k] || k}：${v}`));
    setAnswer(lines.join('\n'));
    setOk(ok);
  }

  function next(ok: boolean) {
    setCorrect(c => c + (ok ? 1 : 0));
    setAnswer(null); setOk(null);
    setIdx(i => i + 1);
    setTimeout(() => nameRef.current?.focus(), 50);
  }

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <div className="logo" aria-hidden="true" />
          <div>
            <h1>位号记忆练习</h1>
            <p className="subtitle">Designed by Satori🍊. Powered by Vercel.</p>
          </div>
        </div>
        <div className="actions">
          <button onClick={() => window.open('/wrongbook', '_blank')}>错题本</button>
          <button onClick={() => setShowDonate(true)}>支持作者</button>
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>切换主题</button>
        </div>
      </div>

      <section className="panel">
        <div className="controls">
          <div className="control">
            <label>类别</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option>设备</option>
              <option>阀门</option>
              <option>性能参数</option>
              <option>工艺指标</option>
              <option>混合</option>
            </select>
          </div>
          <div className="control">
            <label>题数（留空=全部）</label>
            <input value={limit} onChange={e => setLimit(e.target.value)} placeholder="" />
          </div>
          <div className="control">
            <label className="checkbox"><input type="checkbox" checked={exam} onChange={e=>setExam(e.target.checked)} /> 考试模式</label>
          </div>
        </div>
        <div className="panel-actions">
          <button onClick={start}>开始</button>
        </div>

        {/* 已移除导入 CSV 区（默认从 /public/data 自动加载） */}
        <div className="hint">快捷键：1 + Enter（知道/判对），2 + Enter（不知道/判错），其他输入直接 Enter 提交</div>
      </section>

      {showDonate && (
        <div className="modal-overlay" onClick={() => setShowDonate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>请我喝杯咖啡☕️</h3>
            <img src="/money.jpg" alt="支持作者" style={{ maxWidth: '100%', borderRadius: 8 }} />
            <div style={{ marginTop: 12, textAlign: 'right' }}><button onClick={() => setShowDonate(false)}>关闭</button></div>
          </div>
        </div>
      )}

      <section className="panel" id="quiz" style={{ display: list.length ? 'block' : 'none' }}>
        <div className="progressbar" aria-hidden>
          <div id="progressfill" style={{ width: `${Math.round((idx)/Math.max(1,list.length)*100)}%` }} />
        </div>
          <div className="row">
            <div id="progress" className="progress-text">{Math.min(idx + 1, Math.max(1, list.length))}/{list.length}</div>
            <div className="tagline">
              <span id="catbadge" className="badge">{cur?.[0] || '-'}</span>
              <span id="tag">位号：{cur?.[1] || '-'}</span>
            </div>
            <div id="proficiency" className="dots" title="熟练度">
              {Array.from({ length: 5 }).map((_, i) => {
                const rec = cur ? getProf(cur[0], cur[1]) : { level: 0, correct:0, wrong:0 } as any;
                const active = i < (rec.level || 0);
                return <div key={i} className={'dot' + (active ? ' active' : '')} />
              })}
            </div>
          </div>

        <form id="quizForm" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="row">
            <label>
              {(cur?.[0] === '工艺指标') ? stdLabels['name'] : '名称'}
            </label>
            <input name="name" ref={nameRef} onKeyDown={onNameKeyDown} />
          </div>
          {useMemo(() => {
            if (!cur) return null;
            const f = setPerfFields(cur[0], cur[1]);
            const needFloor = f.includes('floor');
            return (
              <>
                {needFloor && (
                  <div className="row" id="floor-row">
                    <label>楼层</label>
                    <input name="floor" />
                  </div>
                )}
                <div id="perf-fields" className="perf field-grid">
                  {f.filter(k => k !== 'name' && k !== 'floor').map(k => (
                    <div className="row" key={k}>
                      <label>{cur?.[0] === '工艺指标' ? (stdLabels as any)[k] || k : (perfLabels as any)[k] || k}</label>
                      <input name={k} />
                    </div>
                  ))}
                </div>
              </>
            );
          }, [cur])}
          <div className="row">
            <button type="submit">提交/下一题</button>
          </div>
        </form>
        {answer && (
          <pre id="answer" className={"answer" + (ok ? ' correct' : '')}>{answer}</pre>
        )}
        <div className="stat-chip">正确：{correct}</div>
      </section>
      <script dangerouslySetInnerHTML={{__html:`document.addEventListener('keydown',e=>{if(e.key==='Enter'){const v=(document.querySelector('input[name=\'name\']') as HTMLInputElement)?.value?.trim(); if(v==='1'){document.querySelector('button[type=submit]')?.setAttribute('data-sc','1');} else if(v==='2'){document.querySelector('button[type=submit]')?.setAttribute('data-sc','2');}}});`}} />
    </div>
  );
}


