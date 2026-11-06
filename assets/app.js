/* Vanilla JavaScript. All research data and media are local to this folder. */
(() => {
  'use strict';
  const D = window.FAMILY_DATA;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = v => String(v).toLocaleLowerCase('ru').replaceAll('ё','е');
  const people = new Map(D.people.map(p => [p.id,p]));
  const sources = new Map(D.artifacts.map(a => [a.id,a]));
  const claims = new Map(D.claims.map(c => [c.claim_id,c]));
  const parentRels = D.relations.filter(r => r.relationship_type === 'parent-of');
  const siblingRels = D.relations.filter(r => r.relationship_type !== 'parent-of');
  // These two sibling pairs are explicitly named in the original family account.
  // The register also records their same two parents as separate parent edges.
  [['P-0001','P-0002'],['P-0016','P-0026']].forEach(([a,b])=>{
    if(!siblingRels.some(r=>[r.person_a_id,r.person_b_id].includes(a)&&[r.person_a_id,r.person_b_id].includes(b)))
      siblingRels.push({person_a_id:a,person_b_id:b,relationship_type:'sibling-of'});
  });
  const parents = id => parentRels.filter(r => r.person_b_id === id).map(r => r.person_a_id);
  const children = id => parentRels.filter(r => r.person_a_id === id).map(r => r.person_b_id);
  const siblings = id => siblingRels.filter(r => [r.person_a_id,r.person_b_id].includes(id)).map(r => r.person_a_id === id ? r.person_b_id : r.person_a_id);
  const state = {view:'tree',selected:'P-0026',root:'P-0001',depth:5,sideBranches:true,mode:'diagram',query:'',branch:'all',peopleFilter:'all',peopleQuery:'',archiveFilter:'all',profileTab:'facts',zoom:1,x:0,y:0};
  let layout = [], graphWidth = 0, graphHeight = 0, drag = null, moved = false, scanZoom = 1, activeArtifact = null;
  const pointers = new Map();
  const fullName = p => `${p.surname ? p.surname+' ' : ''}${p.given}`;
  const initials = p => (p.given.split(' ').filter(Boolean).slice(0,2).map(x=>x[0]).join('') || p.surname[0] || '?');
  const avatar = (p, cls='') => `<span class="avatar ${cls}">${p.photo ? `<img src="${esc(p.photo)}" alt="" loading="lazy">` : esc(initials(p))}</span>`;
  const sourceLinks = ids => `<span class="source-links">${[...new Set(ids)].map(id=>`<button class="source-link" data-artifact="${esc(id)}" title="${esc(sources.get(id)?.title||id)}">${esc(id)} ↗</button>`).join('')}</span>`;
  const badge = p => `<span class="badge ${p.candidate?'candidate':''}">${p.tag==='Есть военные документы'?'<i class="dot document"></i>':''}${esc(p.tag)}</span>`;
  const matching = (p,q) => norm([p.label,p.role,p.places,p.dates,...p.facts.map(f=>f.value)].join(' ')).includes(norm(q));
  const personButton = (id, extra='') => {const p=people.get(id);return `<button class="relative-button ${extra}" data-person="${id}">${avatar(p)}<span>${esc(fullName(p))}</span><span aria-hidden="true">↗</span></button>`;};
  const claimStatus = {hypothesis:'Гипотеза','single-source':'Одна цепочка источников',unresolved:'Вопрос не разрешён',corroborated:'Есть независимое подтверждение','strongly-corroborated':'Сильное подтверждение',contradicted:'Опровергнуто'};
  const origin = {family:'По сведениям семьи',memorial:'Мемориальная публикация; первичный документ не найден',hypothesis:'Предположение; не установлено',conflict:'Расхождение или открытый вопрос'};
  function toast(text) { const t=$('#toast');t.textContent=text;t.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('visible'),3000); }

  function renderSidebar() {
    const list=D.people.filter(p=>(state.branch==='all'||p.branch===state.branch)&&matching(p,state.query));
    $('#sidebar-count').textContent=list.length;
    $('#sidebar-list').innerHTML=list.length?list.map(p=>`<button class="sidebar-person ${p.id===state.selected?'active':''}" data-person="${p.id}" aria-pressed="${p.id===state.selected}">${avatar(p)}<span><span class="person-label">${esc(p.surname||p.given)}${p.surname?'<br>'+esc(p.given):''}</span><span class="person-sub">${esc(p.shortDates)}</span></span></button>`).join(''):'<p class="no-data">По этому запросу никого не найдено.</p>';
  }
  function profileMarkup(p, modal=false) {
    const related=[['Родители',parents(p.id)],['Дети',children(p.id)],['Братья и сёстры',siblings(p.id)]];
    const docs=[...(p.photoSource?[p.photoSource]:[]),...p.documents];
    const photo= p.photo?`<img src="${esc(p.photo)}" alt="Семейный портрет: ${esc(fullName(p))}">`:`<div class="cover-initial" aria-label="Фотография не найдена">${esc(initials(p))}</div>`;
    return `<div class="profile-cover">${photo}${p.photo?`<button data-artifact="${p.photoSource}">Открыть портрет ↗</button>`:''}</div><div class="profile-body"><div class="profile-kicker"><span>${p.candidate?'Архивный кандидат':'Карточка человека'}</span><span>${p.id}</span></div><h2 class="profile-name" ${modal?'id="person-dialog-title"':''}>${esc(p.surname||p.given)}${p.surname?`<small>${esc(p.given)}</small>`:''}</h2>${p.birthSurname?`<p class="birth-surname">До брака — ${esc(p.birthSurname)}, по семейной схеме</p>`:''}<p class="profile-dates">${esc(p.dates)}</p>${badge(p)}<p class="profile-role">${esc(p.role)}</p><button class="button secondary" data-focus="${p.id}">Показать на древе ↗</button><div class="profile-pane"  id="${modal?'modal':'desk'}-pane-facts" ><p class="notice ${p.candidate?'candidate':''}">${esc(p.identityNote)}</p>${p.facts.length?p.facts.map(f=>`<article class="profile-fact"><h4>${esc(f.label)}</h4>${origin[f.kind]?`<span class="fact-origin">${origin[f.kind]}</span>`:''}<p>${esc(f.value)}</p>${sourceLinks(f.sources)}</article>`).join(''):'<p class="no-data">Даты жизни, биографические подробности и фотография пока не найдены. Известные родственные связи приведены ниже.</p>'}${p.id==='P-0022'?'<p class="notice">Запись Петрова 1895 года рождения сохранена отдельно. Она пока не доказывает биографию этого человека.</p>'+personButton('P-0032'):''}${p.id==='P-0032'?'<p class="no-data">Портрет семейного Василия Петрова не присвоен этому кандидату.</p>'+personButton('P-0022'):''}<details class="claims-details"><summary>Все утверждения реестра · ${p.claims.length}</summary>${p.claims.map(id=>{const c=claims.get(id);return `<div class="claim-item"><b>${esc(id)} · ${esc(claimStatus[c.status]||c.status)}</b><p>${esc(c.claim_text)}</p><small>${esc(c.rationale)}</small>${sourceLinks(c.artifact_ids.split(';').filter(Boolean))}</div>`;}).join('')}</details></div><div class="profile-pane"  id="${modal?'modal':'desk'}-pane-family" ><p class="no-data">Связи перечислены по семейным сведениям. Супружество не выведено автоматически из общего ребёнка.</p>${related.map(([label,ids])=>ids.length?`<div class="relative-group"><h4>${label}</h4>${ids.map(id=>personButton(id)).join('')}</div>`:'').join('')}${related.every(([,ids])=>!ids.length)?'<p class="notice">Установленных связей с семейным древом пока нет.</p>':''}${p.id==='P-0017'?'<p class="notice">Отец Алексея Емельян Иванович назван прямо в военном донесении. Остальные связи требуют актов.</p>'+sourceLinks(['A-0010']):''}</div><div class="profile-pane"  id="${modal?'modal':'desk'}-pane-docs" >${docs.length?[...new Set(docs)].map(id=>{const a=sources.get(id);return `<button class="profile-doc" data-artifact="${id}">${a.image?`<img src="${esc(a.thumb||a.file)}" alt="" loading="lazy">`:'<span class="doc-icon" aria-hidden="true">▤</span>'}<span>${esc(a.title)}<small>${id} · ${esc(a.repository_or_archive)}</small></span></button>`;}).join(''):'<p class="no-data">Именные документы и фотография пока не найдены.</p>'}<button class="profile-doc" data-artifact="A-0001"><span class="doc-icon" aria-hidden="true">▤</span><span>Исходная семейная схема<small>Сведения пользователя · A-0001</small></span></button>${D.extras.filter(x=>x.person===p.id).map(x=>`<button class="profile-doc" data-extra="${esc(x.file)}"><span class="doc-icon" aria-hidden="true">⊞</span><span>${esc(x.title)}<small>Фрагмент для чтения; оригинал сохранён</small></span></button>`).join('')}</div></div>`;
  }
  function renderProfile() {
    const p=people.get(state.selected);
    $('#profile-host').innerHTML=profileMarkup(p);
    if($('#person-dialog').open)$('#mobile-profile-host').innerHTML=profileMarkup(p,true);
    $$('.tree-node').forEach(n=>{n.classList.toggle('active',n.dataset.person===p.id);n.setAttribute('aria-pressed',String(n.dataset.person===p.id));});
  }
  function selectPerson(id,forceModal=false,fromHash=false) {
    if(!people.has(id))return;
    state.selected=id;state.profileTab='facts';renderSidebar();renderProfile();
    if(true){
      $('#mobile-profile-host').innerHTML=profileMarkup(people.get(id),true);
      if(!$('#person-dialog').open)$('#person-dialog').showModal();
    }else $('#desktop-profile').scrollTop=0;
    if(!fromHash)history.replaceState(null,'',`#${state.view}/person/${id}`);
  }
  function switchProfileTab(tab,host) {
    state.profileTab=tab;
    $$('.profile-tabs button',host).forEach(b=>{const selected=b.dataset.profileTab===tab;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;});
    $$('.profile-pane',host).forEach(p=>p.hidden=!p.id.endsWith(`-${tab}`));
  }

  function buildLayout() {
    const nodes=new Map();let cursor=0;
    function walk(id,depth) {
      if(nodes.has(id))return nodes.get(id);
      const node={id,depth,x:depth*350+50,y:0,sibling:false};nodes.set(id,node);
      const pp=depth<state.depth?parents(id):[];
      if(pp.length){const ns=pp.map(x=>walk(x,depth+1));node.y=ns.reduce((s,x)=>s+x.y,0)/ns.length;}
      else{node.y=cursor*210+65;cursor++;}
      return node;
    }
    walk(state.root,0);
    // Sibling links stand alone: no parent relationship is invented for side branches.
    if(state.sideBranches)[...nodes.values()].forEach(base=>siblings(base.id).forEach(id=>{
      if(!nodes.has(id))nodes.set(id,{id,depth:base.depth,x:base.x,y:base.y+200,sibling:true,anchor:base.id});
    }));
    // Include every connected relative, including descendants of side branches.
    // Only explicit research relationships are used; candidates remain separate.
    let expanded=true;
    while(expanded){
      expanded=false;
      for(const r of [...parentRels,...siblingRels]){
        const a=nodes.get(r.person_a_id),b=nodes.get(r.person_b_id);
        if(Boolean(a)===Boolean(b))continue;
        const id=a?r.person_b_id:r.person_a_id,p=people.get(id);
        if(!p||p.candidate)continue;
        const anchor=a||b,depth=r.relationship_type==='parent-of'?anchor.depth+(a?-1:1):anchor.depth;
        nodes.set(id,{id,depth,x:depth*350+50,y:anchor.y+200,sibling:r.relationship_type!=='parent-of',anchor:anchor.id});
        expanded=true;
      }
    }
    const minDepth=Math.min(...[...nodes.values()].map(n=>n.depth));
    nodes.forEach(n=>{n.depth-=minDepth;n.x=n.depth*350+50;});
    const columns=new Map();nodes.forEach(n=>{if(!columns.has(n.depth))columns.set(n.depth,[]);columns.get(n.depth).push(n);});
    columns.forEach(col=>{col.sort((a,b)=>a.y-b.y);for(let i=1;i<col.length;i++)col[i].y=Math.max(col[i].y,col[i-1].y+200);});
    layout=[...nodes.values()];graphWidth=Math.max(...layout.map(n=>n.x))+330;graphHeight=Math.max(...layout.map(n=>n.y))+230;
    $('#chart-world').style.width=`${graphWidth}px`;$('#chart-world').style.height=`${graphHeight}px`;
    const svg=$('#chart-lines');svg.setAttribute('width',graphWidth);svg.setAttribute('height',graphHeight);
    svg.innerHTML=parentRels.filter(r=>nodes.has(r.person_a_id)&&nodes.has(r.person_b_id)).map(r=>{
      const a=nodes.get(r.person_a_id),b=nodes.get(r.person_b_id);const x1=b.x+280,x2=a.x,y1=b.y+80,y2=a.y+80;return `<path d="M${x1},${y1} C${x1+32},${y1} ${x2-32},${y2} ${x2},${y2}"/>`;
    }).join('')+siblingRels.filter(r=>nodes.has(r.person_a_id)&&nodes.has(r.person_b_id)).map(r=>{
      const a=nodes.get(r.person_a_id),b=nodes.get(r.person_b_id);return `<path class="sibling" d="M${a.x},${a.y+80} C${a.x-28},${a.y+80} ${b.x-28},${b.y+80} ${b.x},${b.y+80}"/>`;
    }).join('');
    $('#chart-nodes').innerHTML=layout.map(n=>{const p=people.get(n.id);return `<button class="tree-node ${n.sibling?'node-sibling':''} ${p.id===state.selected?'active':''}" data-person="${p.id}" style="left:${n.x}px;top:${n.y}px" aria-pressed="${p.id===state.selected}" aria-label="${esc(fullName(p))}. ${esc(p.shortDates)}${n.sibling?'. Боковая ветвь':''}">${avatar(p)}<span><span class="node-name">${esc(p.surname||p.given)}${p.surname?`<span class="node-first">${esc(p.given)}</span>`:''}</span><span class="node-date">${esc(p.shortDates)}</span></span>${['P-0005','P-0026'].includes(p.id)?'<span class="node-indicator" title="Есть военные документы"></span>':''}</button>`;}).join('');
    $('#chart-caption').textContent=`${fullName(people.get(state.root))} → предки${state.sideBranches?' и боковые ветви':''} · ${layout.length} человек`;
    $('#chart-empty').hidden=true;
    renderTreeList();setMode(state.mode,false);defaultTreeView();
  }
  function renderTreeList(){
    const generations=['Исходный человек и братья / сёстры','Родители и их братья / сёстры','Деды, бабушки и их братья / сёстры','Прадеды и прабабушки','Ранние известные поколения','Предки'];
    $('#chart-list').innerHTML=[...new Set(layout.map(n=>n.depth))].sort().map(depth=>`<h3>${generations[depth]||'Предки'}</h3>${layout.filter(n=>n.depth===depth).map(n=>personButton(n.id,n.id===state.selected?'active':'')).join('')}`).join('');
  }
  function transform(){ $('#chart-world').style.transform=`translate(${state.x}px,${state.y}px) scale(${state.zoom})`;$('#zoom-value').textContent=Math.round(state.zoom*100)+'%'; }
  function fitTree(){
    if(state.mode==='list')return;
    const v=$('#chart-viewport');if(!v.clientWidth||!v.clientHeight)return;
    state.zoom=Math.min(1,(v.clientWidth-25)/graphWidth,(v.clientHeight-65)/graphHeight);
    state.x=(v.clientWidth-graphWidth*state.zoom)/2;state.y=40+(v.clientHeight-40-graphHeight*state.zoom)/2;transform();
  }
  function defaultTreeView(){
    const v=$('#chart-viewport'),root=layout.find(n=>n.id==='P-0001');
    if(!root||!v.clientWidth||!v.clientHeight)return;
    state.zoom=.5;state.x=24-root.x*state.zoom;state.y=v.clientHeight/2-(root.y+80)*state.zoom;transform();
  }
  function centerPerson(id){
    const n=layout.find(n=>n.id===id),v=$('#chart-viewport');if(!n)return;
    state.x=v.clientWidth/2-(n.x+140)*state.zoom;state.y=v.clientHeight/2-(n.y+80)*state.zoom;transform();
  }
  function zoomBy(factor,cx,cy){const v=$('#chart-viewport');cx??=v.clientWidth/2;cy??=v.clientHeight/2;const z=Math.min(2,Math.max(.2,state.zoom*factor));state.x=cx-(cx-state.x)*z/state.zoom;state.y=cy-(cy-state.y)*z/state.zoom;state.zoom=z;transform();}
  function setMode(){state.mode='diagram';$('#chart-viewport').hidden=false;$('#chart-list').hidden=true;}
  function focusRoot(id){
    if($('#person-dialog').open)$('#person-dialog').close();
    state.root='P-0001';state.depth=5;state.sideBranches=true;
    navigate('tree',false);buildLayout();
    const node=$(`.tree-node[data-person="${id}"]`);
    if(node){centerPerson(id);node.classList.add('active');node.focus({preventScroll:true});toast('Человек показан в центре схемы.');}
    else toast('Кандидат пока не имеет установленных связей с семейным древом.');
  }

  function renderPeople(){
    const list=D.people.filter(p=>matching(p,state.peopleQuery)&&(state.peopleFilter==='all'||state.peopleFilter==='photo'&&p.photo||state.peopleFilter==='document'&&['P-0005','P-0026'].includes(p.id)||state.peopleFilter==='candidate'&&p.candidate));
    $('#people-count').textContent=`Показано: ${list.length}`;
    $('#people-grid').innerHTML=list.length?list.map(p=>`<button class="person-card" data-person="${p.id}">${avatar(p)}<h3>${esc(p.surname||p.given)}${p.surname?`<small>${esc(p.given)}</small>`:''}</h3><span class="dates">${esc(p.shortDates)}</span><span class="person-role">${esc(p.role)}</span>${badge(p)}</button>`).join(''):'<p class="empty-state">Ничего не найдено. Попробуйте другое имя или снимите фильтр.</p>';
  }
  const eventTitles=[
    ['1906','Рождение Сергея Фёдоровича','Год 1906 указан в наградных листах. Место — село 1-е Лебяжье — названо семьёй.'],
    ['1924','Рождение Алексея Емельяновича','В донесении — 1924 год. Названия места рождения в источниках различаются: Черешни, Черешки, Черешково.'],
    ['1941','Служба Сергея Фёдоровича','В наградном листе указаны служба с 1941 года и Лебяжьевский РВК.'],
    ['1941','Призыв Василия Петрова · кандидат','Рядовой, призван Лебяжьевским РВК в 1941 году; указан Островинский сельсовет. Связь с семьёй не установлена.'],
    ['1942','Пропал без вести · кандидат Петров','В строке напечатан август 1942 года и внесена поправка «12-42». Учёт — декабрь 1942 года. Это не точная дата гибели.'],
    ['18.11.1943','Бой под Керчью','В наградном листе описаны обнаружение неприятельского орудия и передача сведений для огня батареи.'],
    ['04.12.1943','Медаль «За отвагу»','Приказ №020/н по 227-й Таманской стрелковой дивизии. Представление к Славе III степени не стало награждением этим орденом.'],
    ['15.06.1944','Гибель Алексея Семёнова','850-й стрелковый полк 277-й дивизии. Первичное захоронение — Бураки Витебской области. Книга памяти даёт 16 июня; расхождение не устранено.'],
    ['19.01.1945','Медаль «За отвагу»','Другое наградное решение: приказ №9/н по 4-му Украинскому фронту. Не повторная карточка награды 1943 года.'],
    ['10.1945','Демобилизация по семейным сведениям','Октябрь 1945 года указан семьёй и мемориальной страницей. Первичный документ о демобилизации не найден.']
  ];
  function renderTimeline(){const filter='all';const birthCandidate=(filter==='all'||filter==='P-0032')?`<article class="timeline-event candidate"><div class="timeline-date">1895</div><div class="timeline-content"><span class="badge candidate">Кандидат · вне семейной цепочки</span><h3>Рождение Василия Петрова · кандидат</h3><p>Год указан в послевоенном списке. Дата 28 января и Островное — сведения мемориальной страницы, не проверенные по метрике.</p><button class="text-button" data-person="P-0032">Василий Ефимович Петров ↗</button><div style="margin-top:10px">${sourceLinks(['A-0017','A-0008'])}</div></div></article>`:'';$('#timeline').innerHTML=birthCandidate+D.events.map((e,i)=>({e,i})).filter(({e})=>filter==='all'||e.person_id===filter).map(({e,i})=>{const p=people.get(e.person_id),[date,title,body]=eventTitles[i];return `<article class="timeline-event ${p.candidate?'candidate':''}"><div class="timeline-date">${date}</div><div class="timeline-content">${p.candidate?'<span class="badge candidate">Кандидат · вне семейной цепочки</span>':''}<h3>${title}</h3><p>${body}</p><button class="text-button" data-person="${p.id}">${esc(fullName(p))} ↗</button><div style="margin-top:10px">${sourceLinks(e.artifact_ids.split(';'))}</div></div></article>`;}).join('');}
  function renderArchive(){
    const list=D.artifacts.filter(a=>state.archiveFilter==='all'||a.category===state.archiveFilter);
    $('#archive-grid').innerHTML=list.map(a=>`<article class="archive-card"><button class="archive-preview" data-artifact="${a.id}" aria-label="Открыть: ${esc(a.title)}">${a.image?`<img src="${esc(a.thumb||a.file)}" alt="${esc(a.title)}" loading="lazy">`:`<span class="archive-placeholder" aria-hidden="true">▤<small>${esc(a.file.split('.').pop().toUpperCase())}</small></span>`}</button><div class="archive-card-body"><p class="eyebrow">${a.id} · ${a.category==='scan'?'Военный документ':a.category==='photo'?'Фотография':'Источник'}</p><h3>${esc(a.title)}</h3><p>${esc(a.archival_reference||a.repository_or_archive)}</p><button class="text-button" data-artifact="${a.id}">Открыть ${a.image?'изображение':'источник'} ↗</button></div></article>`).join('');
  }
  function setScanZoom(){const img=$('#scan-stage img');if(img){img.style.width='100%';img.style.height='100%';}}
  function renderFilePreview(a){
    const stage=$('#scan-stage'),p=window.FILE_PREVIEWS?.[a.id];
    stage.classList.remove('text-stage');
    $('#pdf-navigation').hidden=true;
    if(a.image){stage.innerHTML=`<img src="${esc(a.file)}" alt="${esc(a.title)}">`;return;}
    if(p?.kind==='pages'){
      activeArtifact.previewPage=p.initialPage||0;
      $('#pdf-navigation').hidden=false;$('#pdf-page').max=p.pages.length;
      showPdfPage(activeArtifact.previewPage);return;
    }
    stage.classList.add('text-stage');
    if(p?.kind==='document')stage.innerHTML=`<article class="file-content">${p.blocks.map(b=>b.type==='table'?`<div class="file-table"><table><tbody>${b.rows.map(row=>`<tr>${row.map(cell=>`<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:`<p>${esc(b.text)}</p>`).join('')}</article>`;
    else if(p?.text)stage.innerHTML=`<article class="file-content"><p class="preview-label">${esc(p.label||'Сохранённое содержимое')}</p><pre>${esc(p.text)}</pre></article>`;
    else stage.innerHTML='<p class="notice">Не удалось подготовить просмотр. Оригинал доступен для скачивания.</p>';
  }
  function showPdfPage(index){
    const p=window.FILE_PREVIEWS?.[activeArtifact?.id];if(!p?.pages)return;
    const n=Math.min(p.pages.length-1,Math.max(0,Math.trunc(Number(index)||0)));activeArtifact.previewPage=n;
    $('#scan-stage').innerHTML=`<img src="${esc(p.pages[n])}" alt="${esc(activeArtifact.title)}, страница ${n+1}" decoding="async">`;
    $('#pdf-page').value=n+1;$('#pdf-total').textContent=`из ${p.pages.length}`;
    $('#pdf-previous').disabled=n===0;$('#pdf-next').disabled=n===p.pages.length-1;
  }
  function openArtifact(id){
    const a=sources.get(id);if(!a)return;activeArtifact=a;scanZoom=1;
    $('#document-id').textContent=`${a.id} · ${a.category==='scan'?'Военный документ':a.category==='photo'?'Фотография':'Источник'}`;
    $('#document-title').textContent=a.title;
    $('#document-meta').textContent=[a.repository_or_archive,a.archival_reference].filter(Boolean).join(' · ');
    $('#document-actions').innerHTML=`${a.file?`<a class="button" href="${esc(a.file)}" download aria-label="Скачать оригинал файла">Скачать ↓</a>`:''}${a.url?`<a class="button secondary" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">Первоисточник ↗</a>`:''}`;
    renderFilePreview(a);
    let note= a.category==='photo' ? (['A-0018','A-0019','A-0020'].includes(a.id)?'Портрет с подписанной мемориальной страницы. Не является независимым доказательством личности или родства.':'Портрет предоставлен семьёй. Подпись основана на семейных сведениях; лицо не использовалось для отождествления записей.') : a.summary;
    $('#document-notes').innerHTML=`<p>${esc(note)}</p>${a.people.length?`<div class="inline-links">${a.people.map(id=>`<button class="text-button" data-doc-person="${id}">${esc(fullName(people.get(id)))} ↗</button>`).join('')}</div>`:''}<p class="quiet">${esc(a.reliability_notes||'Копии и индексы одной записи не считаются независимыми подтверждениями.')}</p><details><summary>Происхождение и контрольная сумма</summary><p>${esc([a.repository_or_archive,a.archival_reference].filter(Boolean).join(" · "))}</p><p>Группа источников: ${esc(a.independence_group)}</p><p>SHA-256: <code>${esc(a.sha256||'См. исходный реестр')}</code></p><p>${esc(a.access_notes.replace(/\\/g,'/'))}</p></details>`;
    if(!$('#document-dialog').open)$('#document-dialog').showModal();
    $('#document-dialog').scrollTop=0;requestAnimationFrame(()=>{setScanZoom(1);$('#scan-stage').scrollTo(0,0);});
  }
  function openExtra(file){
    const x=D.extras.find(x=>x.file===file);if(!x)return;
    const a={id:'ФРАГМЕНТ',title:x.title,file:x.file,image:true,category:'scan',repository_or_archive:'Производное изображение из скачанного документа',archival_reference:'Для чтения. Полный скан сохранён в источниках.',summary:'Фрагмент или отрисованная страница для удобства чтения. Не является отдельным независимым источником.',people:x.person?[x.person]:[],access_notes:'Локальный фрагмент; оригиналы не изменены.',sha256:'',independence_group:'Та же цепочка, что у исходного документа',url:''};
    sources.set(a.id,a);openArtifact(a.id);
  }
  function navigate(view,updateHash=true){
    if(!['tree','people','timeline','archive','research'].includes(view))view='tree';state.view=view;
    $$('.view').forEach(v=>v.hidden=v.id!==`view-${view}`);
    $$('.main-nav a').forEach(a=>{if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    if(view==='people')renderPeople();if(view==='timeline')renderTimeline();if(view==='archive')renderArchive();
    if(updateHash)history.pushState(null,'',`#${view}`);
  }
  function parseHash(){const [view,kind,id]=location.hash.slice(1).split('/');navigate(view||'tree',false);if(kind==='person'&&people.has(id))selectPerson(id,false,true);if(kind==='root'&&people.has(id)){state.root='P-0001';state.depth=5;buildLayout();}}

  document.addEventListener('click',e=>{
    const b=e.target.closest('button,a');if(!b)return;
    if(b.dataset.view){e.preventDefault();navigate(b.dataset.view);return;}
    if(b.classList.contains('brand')){e.preventDefault();navigate('tree');return;}
    if(b.dataset.person){if(moved){moved=false;return;}selectPerson(b.dataset.person);return;}
    if(b.dataset.docPerson){$('#document-dialog').close();selectPerson(b.dataset.docPerson,true);return;}
    if(b.dataset.artifact){openArtifact(b.dataset.artifact);return;}
    if(b.dataset.extra){openExtra(b.dataset.extra);return;}
    if(b.dataset.focus){focusRoot(b.dataset.focus);return;}
    if(b.dataset.profileTab){switchProfileTab(b.dataset.profileTab,b.closest('.profile-body'));return;}
    if(b.dataset.close){$('#'+b.dataset.close).close();return;}
    if(b.hasAttribute('data-help'))$('#help-dialog').showModal();
  });
  document.addEventListener('keydown',e=>{
    const tab=e.target.closest('[role=tab]');if(!tab||!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;
    const tabs=$$('[role=tab]',tab.parentElement),i=tabs.indexOf(tab);let next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    e.preventDefault();switchProfileTab(tabs[next].dataset.profileTab,tab.closest('.profile-body'));tabs[next].focus();
  });
  $$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  $('#person-dialog').addEventListener('close',()=>{renderProfile();const target=$(`.sidebar-person[data-person="${state.selected}"]`);if(target&&state.view==='tree'&&matchMedia('(min-width:1201px)').matches)target.focus({preventScroll:true});});
  $('#tree-search').addEventListener('input',e=>{state.query=e.target.value;renderSidebar();});
  $('#mobile-search').addEventListener('input',e=>{const q=e.target.value.trim(),list=D.people.filter(p=>matching(p,q));const out=$('#mobile-search-results');out.hidden=!q;out.innerHTML=list.length?list.map(p=>personButton(p.id)).join(''):'<p class="no-data">Ничего не найдено.</p>';});
  $('#mobile-search-results').addEventListener('click',e=>{if(e.target.closest('[data-person]')){$('#mobile-search-results').hidden=true;$('#mobile-search').value='';}});
  $('#zoom-in').addEventListener('click',()=>zoomBy(1.2));$('#zoom-out').addEventListener('click',()=>zoomBy(1/1.2));$('#fit-tree').addEventListener('click',fitTree);
  $('#people-search').addEventListener('input',e=>{state.peopleQuery=e.target.value;renderPeople();});
  $('#pdf-previous').addEventListener('click',()=>showPdfPage(activeArtifact.previewPage-1));
  $('#pdf-next').addEventListener('click',()=>showPdfPage(activeArtifact.previewPage+1));
  $('#pdf-page').addEventListener('change',e=>showPdfPage((Number(e.target.value)||1)-1));
  const viewport=$('#chart-viewport');
  viewport.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();const r=viewport.getBoundingClientRect();zoomBy(e.deltaY<0?1.08:1/1.08,e.clientX-r.left,e.clientY-r.top);}}, {passive:false});
  viewport.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=false;drag={id:e.pointerId,x:e.clientX,y:e.clientY,tx:state.x,ty:state.y};if(!e.target.closest('button'))viewport.setPointerCapture(e.pointerId);});
  viewport.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId))return;const old=[...pointers.values()];pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2){const now=[...pointers.values()],before=Math.hypot(old[0].x-old[1].x,old[0].y-old[1].y),after=Math.hypot(now[0].x-now[1].x,now[0].y-now[1].y);const r=viewport.getBoundingClientRect();if(before>0)zoomBy(after/before,(now[0].x+now[1].x)/2-r.left,(now[0].y+now[1].y)/2-r.top);moved=true;drag=null;return;}
    if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>5){moved=true;viewport.classList.add('dragging');viewport.setPointerCapture(e.pointerId);}if(moved){state.x=drag.tx+dx;state.y=drag.ty+dy;transform();}
  });
  function pointerEnd(e){pointers.delete(e.pointerId);drag=null;viewport.classList.remove('dragging');setTimeout(()=>moved=false,0);}
  viewport.addEventListener('pointerup',pointerEnd);viewport.addEventListener('pointercancel',pointerEnd);
  viewport.addEventListener('keydown',e=>{if(e.target!==viewport)return;const d={ArrowLeft:[45,0],ArrowRight:[-45,0],ArrowUp:[0,45],ArrowDown:[0,-45]}[e.key];if(d){e.preventDefault();state.x+=d[0];state.y+=d[1];transform();}if(['+','=','-','0'].includes(e.key)){e.preventDefault();if(e.key==='0')fitTree();else zoomBy(e.key==='-'?1/1.2:1.2);}});
  let viewportSize=null;
  new ResizeObserver(()=>{const w=viewport.clientWidth,h=viewport.clientHeight;if(!w||!h)return;if(!viewportSize)defaultTreeView();else{state.x+=(w-viewportSize.w)/2;state.y+=(h-viewportSize.h)/2;transform();}viewportSize={w,h};}).observe(viewport);
  window.addEventListener('popstate',parseHash);
  renderSidebar();buildLayout();renderProfile();parseHash();
})();
