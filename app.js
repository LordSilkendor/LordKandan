const defaultData = [
  {id:'ideas',title:'Ideer',cards:[{id:1,title:'Kartlegg behov fra kundesamtaler',tag:'Planlegging',date:'I dag',person:'M',progress:35},{id:2,title:'Utforsk visuell retning',tag:'Design',date:'18. juli',person:'A'}]},
  {id:'next',title:'Neste',cards:[{id:3,title:'Lag landingsside for venteliste',tag:'Design',date:'19. juli',person:'M',progress:70},{id:4,title:'Skriv velkomstsekvens på e-post',tag:'Innhold',date:'20. juli',person:'S'}]},
  {id:'doing',title:'Pågår',cards:[{id:5,title:'Bygg interaktiv prototype',tag:'Utvikling',date:'I morgen',person:'A',progress:55},{id:6,title:'Forbered lanseringsplan',tag:'Planlegging',date:'22. juli',person:'M',progress:25}]},
  {id:'done',title:'Ferdig',cards:[{id:7,title:'Definer mål og suksesskriterier',tag:'Planlegging',date:'15. juli',person:'S',progress:100},{id:8,title:'Opprett designsystem',tag:'Design',date:'14. juli',person:'A',progress:100}]}
];
let legacy;
try { legacy=JSON.parse(localStorage.getItem('flyt-board'))||defaultData; } catch { legacy=defaultData; }
let projects;
try { projects=JSON.parse(localStorage.getItem('lords-projects')); } catch { projects=null; }
if(!projects || !projects.length) projects=[{id:'launch',name:'Produktlansering',columns:legacy},{id:'personal',name:'Mine oppgaver',columns:JSON.parse(JSON.stringify(defaultData)).map(c=>({...c,cards:[]}))}];
const columnNames={ideas:'Ideer',doing:'Under arbeid',next:'Venter',done:'Ferdig'},columnOrder=['ideas','doing','next','done'];
projects.forEach(project=>{project.columns.forEach(c=>c.title=columnNames[c.id]||c.title);project.columns.sort((a,b)=>columnOrder.indexOf(a.id)-columnOrder.indexOf(b.id))});
let activeProjectId=localStorage.getItem('lords-active-project')||projects[0].id;
let activeProject=projects.find(p=>p.id===activeProjectId);
let data=(activeProject&&activeProject.columns)||projects[0].columns;

const $=s=>document.querySelector(s), board=$('#board'), modal=$('#modal'), actionModal=$('#actionModal'), categoryModal=$('#categoryModal'), categoryDialog=$('#categoryDialog'), projectDialog=$('#projectDialog'), subtaskDialog=$('#subtaskDialog'), taskDeleteDialog=$('#taskDeleteDialog'), form=$('#taskForm'), columnSelect=$('#taskColumn');
let categories;
try { categories=JSON.parse(localStorage.getItem('lords-categories')); } catch { categories=null; }
if(!categories||!categories.length) categories=['Design','Utvikling','Innhold','Planlegging'];
const categoryColors=['#fde1d7','#f7c8c8','#f8d6b3','#f6edc4','#dcebdc','#cce8df','#dce9ef','#cfdcf5','#e5e1f0','#e5d2f2','#f5dded','#dedbd3'];
let categoryColorMap;
try { categoryColorMap=JSON.parse(localStorage.getItem('lords-category-colors'))||{}; } catch { categoryColorMap={}; }
categories.forEach((name,i)=>{if(!categoryColorMap[name])categoryColorMap[name]=categoryColors[i%categoryColors.length]});
let activeColumn='ideas', activeTags=new Set(), search='', selectedTask=null;
const save=()=>{localStorage.setItem('lords-projects',JSON.stringify(projects));localStorage.setItem('lords-active-project',activeProjectId);localStorage.setItem('lords-categories',JSON.stringify(categories));localStorage.setItem('lords-category-colors',JSON.stringify(categoryColorMap))};
const tagClass=t=>t.toLowerCase().replace('å','a');
const matches=card=>(!activeTags.size||activeTags.has(card.tag))&&(!search||card.title.toLowerCase().includes(search));

function render(){
  board.innerHTML=data.map(col=>{
    const visible=col.cards.filter(matches);
    return `<article class="column ${col.id===activeColumn?'mobile-active':''}" data-column="${col.id}">
      <header class="column-head"><div><span class="column-title">${col.title}</span><span class="count">${visible.length}</span></div><button class="column-menu" aria-label="Valg for ${col.title}">•••</button></header>
      <div class="card-list" data-list="${col.id}">${visible.length?visible.map(card=>`<article class="task-card" draggable="true" data-id="${card.id}">
        <span class="tag tag-${tagClass(card.tag)}" style="background:${categoryColor(card.tag)}">${card.tag}</span><h3 class="task-title">${card.title}</h3>
        ${card.subtasks&&card.subtasks.length?`<div class="progress" aria-label="${progress(card)}% ferdig"><span style="width:${progress(card)}%"></span></div>`:''}
        <footer class="card-meta"><span class="card-subtasks">${card.subtasks&&card.subtasks.length?`☑ <strong>${card.subtasks.filter(s=>s.done).length}/${card.subtasks.length}</strong><span>· ${progress(card)}%</span>`:'Ingen underoppgaver'}</span><button class="card-action" data-actions="${card.id}" aria-label="Handlinger for ${card.title}">•••</button></footer>
      </article>`).join(''):`<div class="empty-state">Ingen oppgaver matcher filteret</div>`}</div>
    </article>`;
  }).join('');
  $('#mobileTabs').innerHTML=data.map(c=>`<button class="tab-btn ${c.id===activeColumn?'active':''}" data-tab="${c.id}">${c.title} <span>${c.cards.filter(matches).length}</span></button>`).join('');
  $('#taskTotal').textContent=`${data.reduce((sum,c)=>sum+c.cards.length,0)} oppgaver`;
  attachDragEvents();
}

const progress=card=>card.subtasks&&card.subtasks.length?Math.round(card.subtasks.filter(s=>s.done).length/card.subtasks.length*100):0;
const categoryColor=name=>categoryColorMap[name]||categoryColors[0];
function renderProjects(){const current=projects.find(p=>p.id===activeProjectId);$('#projectName').textContent=current.name;$('#projectList').innerHTML=projects.map(p=>`<button class="project-option ${p.id===activeProjectId?'active':''}" data-project="${p.id}">${p.name}</button>`).join('')}
function selectProject(id){activeProjectId=id;data=projects.find(p=>p.id===id).columns;activeColumn=data[0].id;save();renderProjects();render();closeProjectMenu()}
function closeProjectMenu(){const menu=$('#projectMenu');menu.hidden=true;$('#projectPicker').setAttribute('aria-expanded','false')}
let projectDialogMode='rename';
function openProjectDialog(mode){const project=projects.find(p=>p.id===activeProjectId),dialog=$('#projectDialogForm'),input=$('#projectDialogInput');projectDialogMode=mode;closeProjectMenu();dialog.classList.toggle('is-danger',mode==='delete');$('#projectDialogIcon').textContent=mode==='delete'?'×':mode==='create'?'+':'✎';$('#projectDialogTitle').textContent=mode==='delete'?'Slett prosjekt':mode==='create'?'Nytt prosjekt':'Endre prosjektnavn';$('#projectDialogText').textContent=mode==='delete'?`«${project.name}» og alle oppgavene i prosjektet slettes permanent.`:mode==='create'?'Gi prosjektet et kort og tydelig navn.':'Skriv inn det nye navnet på prosjektet.';$('#confirmProjectDialog').textContent=mode==='delete'?'Ja, slett':mode==='create'?'Opprett':'Lagre';input.value=mode==='rename'?project.name:'';projectDialog.hidden=false;document.body.style.overflow='hidden';if(mode!=='delete')setTimeout(()=>input.focus(),50)}
function submitProjectDialog(){const input=$('#projectDialogInput'),name=input.value.trim(),project=projects.find(p=>p.id===activeProjectId);if(projectDialogMode!=='delete'&&!name){input.focus();return}if(projectDialogMode==='create'){const id=`project-${Date.now()}`,columns=JSON.parse(JSON.stringify(defaultData)).map(c=>({...c,title:columnNames[c.id],cards:[]})).sort((a,b)=>columnOrder.indexOf(a.id)-columnOrder.indexOf(b.id));projects.push({id,name,columns});closeModal(projectDialog);selectProject(id);toast('Prosjektet ble opprettet')}else if(projectDialogMode==='rename'){project.name=name;save();renderProjects();closeModal(projectDialog);toast('Prosjektnavnet ble endret')}else{projects=projects.filter(p=>p.id!==activeProjectId);closeModal(projectDialog);selectProject(projects[0].id);toast('Prosjektet ble slettet')}}
function deleteProject(){if(projects.length===1){toast('Du må ha minst ett prosjekt');return}openProjectDialog('delete')}
let subtaskDialogMode='edit',selectedSubtaskIndex=null;
function openSubtaskDialog(mode,index){const card=findTask(selectedTask).card,sub=card.subtasks[index],dialog=$('#subtaskDialogForm'),input=$('#subtaskDialogInput');subtaskDialogMode=mode;selectedSubtaskIndex=index;dialog.classList.toggle('is-danger',mode==='delete');$('#subtaskDialogIcon').textContent=mode==='delete'?'×':'✎';$('#subtaskDialogTitle').textContent=mode==='delete'?'Slett underoppgave':'Endre underoppgave';$('#subtaskDialogText').textContent=mode==='delete'?`«${sub.title}» slettes permanent.`:'Oppdater teksten for underoppgaven.';$('#confirmSubtaskDialog').textContent=mode==='delete'?'Ja, slett':'Lagre';input.value=mode==='edit'?sub.title:'';subtaskDialog.hidden=false;document.body.style.overflow='hidden';if(mode==='edit')setTimeout(()=>input.focus(),50)}
function submitSubtaskDialog(){const card=findTask(selectedTask).card,input=$('#subtaskDialogInput'),title=input.value.trim();if(subtaskDialogMode==='edit'){if(!title){input.focus();return}card.subtasks[selectedSubtaskIndex].title=title}else card.subtasks.splice(selectedSubtaskIndex,1);save();renderSubtasks();render();closeModal(subtaskDialog);toast(subtaskDialogMode==='edit'?'Underoppgaven ble endret':'Underoppgaven ble slettet')}

function renderFilters(){
  $('#tagFilters').innerHTML=categories.map(t=>`<button type="button" class="chip ${activeTags.has(t)?'active':''}" data-tag="${t}" aria-pressed="${activeTags.has(t)}">${t}</button>`).join('');
  $('#filterCount').textContent=activeTags.size; $('#filterCount').hidden=!activeTags.size;
}
function renderCategoryManager(){$('#categoryList').innerHTML=categories.map((name,i)=>`<div class="category-item"><span class="category-dot" style="background:${categoryColor(name)}"></span><span class="category-name">${name}</span><button data-edit-category="${i}" aria-label="Endre ${name}">✎</button><button class="category-delete" data-delete-category="${i}" aria-label="Slett ${name}">×</button></div>`).join('');$('#taskTag').innerHTML=categories.map(t=>`<option>${t}</option>`).join('')}
function toggleControls(){const panel=$('#controlsPanel'),open=panel.hidden;panel.hidden=!open;$('#filterToggle').setAttribute('aria-expanded',open)}
function openModal(column='ideas'){columnSelect.innerHTML=data.map(c=>`<option value="${c.id}" ${c.id===column?'selected':''}>${c.title}</option>`).join('');modal.hidden=false;document.body.style.overflow='hidden';setTimeout(()=>form.title.focus(),50)}
function closeModal(el=modal){el.hidden=true;const anotherOpen=[modal,actionModal,categoryModal,categoryDialog,projectDialog,subtaskDialog,taskDeleteDialog].some(item=>!item.hidden);document.body.style.overflow=anotherOpen?'hidden':'';if(el===modal)form.reset()}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
function findTask(id){for(const col of data){const card=col.cards.find(c=>c.id===id);if(card)return {card,col}}}
function renderSubtasks(){const {card}=findTask(selectedTask),subs=card.subtasks||[];$('#subtaskProgress').textContent=subs.length?`${progress(card)} % ferdig`:'';$('#subtaskList').innerHTML=subs.length?subs.map((s,i)=>`<div class="subtask-item ${s.done?'done':''}"><input type="checkbox" id="sub-${i}" data-subtask="${i}" ${s.done?'checked':''}><label for="sub-${i}">${s.title}</label><span class="subtask-tools"><button data-edit-subtask="${i}" aria-label="Rediger underoppgave">✎</button><button class="subtask-delete" data-delete-subtask="${i}" aria-label="Slett underoppgave">×</button></span></div>`).join(''):'<div class="subtask-empty">Ingen underoppgaver ennå</div>'}
function openActions(id){selectedTask=id;const found=findTask(id);$('#actionTitle').textContent=found.card.title;$('#actionCategory').innerHTML=categories.map(c=>`<option ${c===found.card.tag?'selected':''}>${c}</option>`).join('');$('#moveOptions').innerHTML=data.map(c=>`<button class="move-btn ${c.id===found.col.id?'current':''}" data-move="${c.id}" ${c.id===found.col.id?'disabled':''}>${c.title}</button>`).join('');renderSubtasks();actionModal.hidden=false;document.body.style.overflow='hidden'}
function moveTask(id,target){const found=findTask(id);found.col.cards=found.col.cards.filter(c=>c.id!==id);data.find(c=>c.id===target).cards.push(found.card);activeColumn=target;save();render();closeModal(actionModal);toast('Oppgaven ble flyttet')}

$('#newTaskButton').addEventListener('click',()=>openModal(activeColumn));
$('#closeModal').addEventListener('click',()=>closeModal());
$('#closeActions').addEventListener('click',()=>closeModal(actionModal));
$('#filterToggle').addEventListener('click',()=>toggleControls());
$('#projectPicker').addEventListener('click',()=>{const menu=$('#projectMenu'),open=menu.hidden;menu.hidden=!open;$('#projectPicker').setAttribute('aria-expanded',open)});
$('#projectList').addEventListener('click',e=>{const b=e.target.closest('[data-project]');if(b)selectProject(b.dataset.project)});
$('#newProject').addEventListener('click',()=>openProjectDialog('create'));
$('#renameProject').addEventListener('click',()=>openProjectDialog('rename'));
$('#deleteProject').addEventListener('click',deleteProject);
$('#cancelProjectDialog').addEventListener('click',()=>closeModal(projectDialog));
$('#projectDialogForm').addEventListener('submit',e=>{e.preventDefault();submitProjectDialog()});
$('#manageCategories').addEventListener('click',()=>{renderCategoryManager();categoryModal.hidden=false;document.body.style.overflow='hidden'});
$('#closeCategories').addEventListener('click',()=>closeModal(categoryModal));
$('#tagFilters').addEventListener('click',e=>{const b=e.target.closest('[data-tag]');if(!b)return;activeTags.has(b.dataset.tag)?activeTags.delete(b.dataset.tag):activeTags.add(b.dataset.tag);renderFilters();render()});
$('#searchInput').addEventListener('input',e=>{search=e.target.value.trim().toLowerCase();render()});
$('#clearFilters').addEventListener('click',()=>{activeTags.clear();search='';$('#searchInput').value='';renderFilters();render()});
$('#mobileTabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;activeColumn=b.dataset.tab;render();window.scrollTo({top:$('#mobileTabs').offsetTop-12,behavior:'smooth'})});
board.addEventListener('click',e=>{const add=e.target.closest('[data-add]'),actions=e.target.closest('[data-actions]');if(add)openModal(add.dataset.add);if(actions)openActions(Number(actions.dataset.actions))});
$('#moveOptions').addEventListener('click',e=>{const b=e.target.closest('[data-move]');if(b&&!b.disabled)moveTask(selectedTask,b.dataset.move)});
$('#actionCategory').addEventListener('change',e=>{findTask(selectedTask).card.tag=e.target.value;save();render();toast('Kategorien ble endret')});
$('#subtaskList').addEventListener('change',e=>{if(!e.target.matches('[data-subtask]'))return;const {card}=findTask(selectedTask);card.subtasks[e.target.dataset.subtask].done=e.target.checked;save();renderSubtasks();render()});
$('#subtaskList').addEventListener('click',e=>{const edit=e.target.closest('[data-edit-subtask]'),del=e.target.closest('[data-delete-subtask]');if(edit)openSubtaskDialog('edit',Number(edit.dataset.editSubtask));if(del)openSubtaskDialog('delete',Number(del.dataset.deleteSubtask))});
function addSubtask(){const input=$('#newSubtaskTitle'),title=input.value.trim();if(!title)return;const {card}=findTask(selectedTask);card.subtasks=card.subtasks||[];card.subtasks.push({title,done:false});input.value='';save();renderSubtasks();render()}
$('#addSubtask').addEventListener('click',addSubtask);
$('#newSubtaskTitle').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addSubtask()}});
$('#cancelSubtaskDialog').addEventListener('click',()=>closeModal(subtaskDialog));
$('#subtaskDialogForm').addEventListener('submit',e=>{e.preventDefault();submitSubtaskDialog()});
$('#deleteTask').addEventListener('click',()=>{const found=findTask(selectedTask);$('#taskDeleteDialogText').textContent=`«${found.card.title}» slettes permanent.`;taskDeleteDialog.hidden=false;document.body.style.overflow='hidden'});
$('#cancelTaskDelete').addEventListener('click',()=>closeModal(taskDeleteDialog));
$('#taskDeleteDialogForm').addEventListener('submit',e=>{e.preventDefault();const found=findTask(selectedTask);found.col.cards=found.col.cards.filter(c=>c.id!==selectedTask);save();render();closeModal(taskDeleteDialog);closeModal(actionModal);toast('Oppgaven ble slettet')});
[modal,actionModal,categoryModal,categoryDialog,projectDialog,subtaskDialog,taskDeleteDialog].forEach(el=>el.addEventListener('click',e=>{if(e.target===el)closeModal(el)}));
let categoryDialogMode='create',selectedCategoryIndex=null,selectedCategoryColor=categoryColors[0];
function renderColorPicker(){$('#categoryColorPicker').innerHTML=`<legend>Velg farge</legend><div class="color-options">${categoryColors.map(color=>`<button type="button" class="color-option ${color===selectedCategoryColor?'selected':''}" data-color="${color}" style="background:${color}" aria-label="Velg farge"></button>`).join('')}</div>`}
function openCategoryDialog(mode,index=null){if(mode==='delete'&&categories.length===1){toast('Du må ha minst én kategori');return}categoryDialogMode=mode;selectedCategoryIndex=index;const old=index===null?'':categories[index],dialog=$('#categoryDialogForm'),input=$('#categoryDialogInput');selectedCategoryColor=old?categoryColor(old):categoryColors[categories.length%categoryColors.length];dialog.classList.toggle('is-danger',mode==='delete');$('#categoryDialogIcon').textContent=mode==='delete'?'×':mode==='edit'?'✎':'+';$('#categoryDialogTitle').textContent=mode==='delete'?'Slett kategori':mode==='edit'?'Endre kategori':'Ny kategori';$('#categoryDialogText').textContent=mode==='delete'?`Oppgaver i «${old}» flyttes til «${categories.find((_,i)=>i!==index)}».`:mode==='edit'?'Endre navn eller velg en annen farge.':'Gi kategorien et navn og en tydelig farge.';$('#confirmCategoryDialog').textContent=mode==='delete'?'Ja, slett':mode==='edit'?'Lagre':'Opprett';input.value=old;renderColorPicker();categoryDialog.hidden=false;document.body.style.overflow='hidden';if(mode!=='delete')setTimeout(()=>input.focus(),50)}
function submitCategoryDialog(){const input=$('#categoryDialogInput'),name=input.value.trim(),old=selectedCategoryIndex===null?'':categories[selectedCategoryIndex];if(categoryDialogMode!=='delete'){if(!name){input.focus();return}if(categories.some((c,i)=>i!==selectedCategoryIndex&&c.toLowerCase()===name.toLowerCase())){toast('Kategorien finnes allerede');return}}if(categoryDialogMode==='create'){categories.push(name);categoryColorMap[name]=selectedCategoryColor}else if(categoryDialogMode==='edit'){categories[selectedCategoryIndex]=name;delete categoryColorMap[old];categoryColorMap[name]=selectedCategoryColor;projects.forEach(p=>p.columns.forEach(c=>c.cards.forEach(card=>{if(card.tag===old)card.tag=name})));activeTags.delete(old)}else{categories.splice(selectedCategoryIndex,1);delete categoryColorMap[old];projects.forEach(p=>p.columns.forEach(c=>c.cards.forEach(card=>{if(card.tag===old)card.tag=categories[0]})));activeTags.delete(old)}save();renderCategoryManager();renderFilters();render();closeModal(categoryDialog);toast(categoryDialogMode==='delete'?'Kategorien ble slettet':categoryDialogMode==='edit'?'Kategorien ble endret':'Kategorien ble opprettet')}
$('#addCategory').addEventListener('click',()=>openCategoryDialog('create'));
$('#categoryColorPicker').addEventListener('click',e=>{const b=e.target.closest('[data-color]');if(b){selectedCategoryColor=b.dataset.color;renderColorPicker()}});
$('#cancelCategoryDialog').addEventListener('click',()=>closeModal(categoryDialog));
$('#categoryDialogForm').addEventListener('submit',e=>{e.preventDefault();submitCategoryDialog()});
$('#categoryList').addEventListener('click',e=>{const edit=e.target.closest('[data-edit-category]'),del=e.target.closest('[data-delete-category]');if(edit)openCategoryDialog('edit',Number(edit.dataset.editCategory));if(del)openCategoryDialog('delete',Number(del.dataset.deleteCategory))});
form.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(form),col=data.find(c=>c.id===fd.get('column'));col.cards.push({id:Date.now(),title:fd.get('title').trim(),tag:fd.get('tag'),subtasks:[]});activeColumn=col.id;save();render();closeModal();toast('Oppgaven er lagt til')});
document.addEventListener('click',e=>{if(!e.target.closest('#projectPicker')&&!e.target.closest('#projectMenu'))closeProjectMenu();const panel=$('#controlsPanel');if(!panel.hidden&&!e.target.closest('#controlsPanel')&&!e.target.closest('#filterToggle')){panel.hidden=true;$('#filterToggle').setAttribute('aria-expanded','false')}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!taskDeleteDialog.hidden)closeModal(taskDeleteDialog);else if(!categoryDialog.hidden)closeModal(categoryDialog);else if(!subtaskDialog.hidden)closeModal(subtaskDialog);else if(!projectDialog.hidden)closeModal(projectDialog);else if(!categoryModal.hidden)closeModal(categoryModal);else if(!actionModal.hidden)closeModal(actionModal);else if(!modal.hidden)closeModal();else closeProjectMenu()}});

function attachDragEvents(){let dragged;document.querySelectorAll('.task-card').forEach(card=>{card.addEventListener('dragstart',e=>{if(e.target.closest('button')){e.preventDefault();return}dragged=card;card.classList.add('dragging')});card.addEventListener('dragend',()=>card.classList.remove('dragging'))});document.querySelectorAll('.card-list').forEach(list=>{list.addEventListener('dragover',e=>{e.preventDefault();list.classList.add('dragover')});list.addEventListener('dragleave',()=>list.classList.remove('dragover'));list.addEventListener('drop',e=>{e.preventDefault();list.classList.remove('dragover');if(dragged)moveTask(Number(dragged.dataset.id),list.dataset.list)})})}
save();renderProjects();renderCategoryManager();renderFilters();render();
