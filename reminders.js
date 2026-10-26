import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import{getAuth,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,updateProfile,sendPasswordResetEmail,GoogleAuthProvider,signInWithPopup,EmailAuthProvider,reauthenticateWithCredential,reauthenticateWithPopup,deleteUser}from"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import{initializeFirestore,persistentLocalCache,persistentMultipleTabManager,collection,doc,addDoc,updateDoc,deleteDoc,setDoc,getDoc,getDocs,writeBatch,onSnapshot,query,orderBy,serverTimestamp}from"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import{firebaseConfig}from"./firebase-config.js";

const $=id=>document.getElementById(id);
const body=$("remBody"),summary=$("remSummary"),account=$("account");
const CATEGORIES={housing:"🏠 Mortgage & rent",loans:"💳 Loans & bank",utilities:"💡 Utilities & phone",insurance:"🛡️ Insurance",vehicle:"🚗 Vehicle (NCT, motor tax)",documents:"🛂 Documents (passport, IRP, visa)",bills:"🧾 Bills & subscriptions",health:"🩺 Health",family:"🎂 Birthdays & family",other:"📌 Other"};
const BILLS_TEMPLATE=[["Life Insurance",1,"insurance"],["Leisure / Club Membership",1,"bills"],["Home Security",1,"bills"],["Bank Account Fee",1,"loans"],["Personal Loan",2,"loans"],["Mortgage",5,"housing"],["Gas Bill",5,"utilities"],["Mobile / Phone Bill",9,"utilities"],["Home Insurance",23,"insurance"]];
const euro=n=>new Intl.NumberFormat("en-IE",{style:"currency",currency:"EUR"}).format(n);
const SUGGESTIONS=[["Car insurance renewal","insurance","yearly"],["NCT test","vehicle","none"],["Motor tax","vehicle","yearly"],["Home insurance","insurance","yearly"],["IRP card renewal","documents","none"],["Passport renewal","documents","none"],["Health insurance","insurance","yearly"]];
let auth,db,user=null,profile={remindDays:30},events=[],unsubEvents=null,authMode="login",editingId=null;

const today=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const parse=s=>{const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const daysLeft=s=>Math.round((parse(s)-today())/864e5);
const fmt=s=>parse(s).toLocaleDateString("en-IE",{day:"numeric",month:"short",year:"numeric"});
const plural=(n,w)=>`${n} ${w}${n===1?"":"s"}`;

function nextDue(day){
  const t=today(),fit=(y,m)=>Math.min(day,new Date(y,m+1,0).getDate());
  let y=t.getFullYear(),m=t.getMonth();
  if(fit(y,m)<t.getDate()){m++;if(m>11){m=0;y++}}
  return iso(new Date(y,m,fit(y,m)));
}

function advance(s,repeat,preferredDay){
  const d=parse(s),day=preferredDay||d.getDate(),months=repeat==="monthly"?1:12;
  d.setDate(1);d.setMonth(d.getMonth()+months);
  d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));
  return iso(d);
}

function status(e){
  const n=daysLeft(e.dueDate),lead=e.remindDays??profile.remindDays;
  if(n<0)return["overdue",plural(-n,"day")+" overdue"];
  if(n===0)return["soon","Due today"];
  if(n<=lead)return["soon","Due in "+plural(n,"day")];
  return["ok",n>60?"in "+plural(Math.round(n/30.4),"month"):"in "+plural(n,"day")];
}

function renderAccount(){
  account.innerHTML=user
    ?`<button class="avatar" id="profileBtn" title="My profile">${escapeHtml(initials())}</button>`
    :`<button class="btn primary" data-auth="login">Log in</button>`;
}
function initials(){
  const n=profile.name||user.displayName||user.email||"?";
  return n.split(/[\s@.]+/).filter(Boolean).slice(0,2).map(p=>p[0].toUpperCase()).join("");
}

function render(){
  if(!user){
    summary.textContent="Private";summary.className="tag purple";
    body.innerHTML=`<div class="rem-empty"><p>Keep track of renewals and due dates: car insurance, NCT, motor tax, IRP, passports and more. Your dates are private to your account.</p>
      <div class="rem-actions"><button class="btn primary" data-auth="signup">Create free account</button><button class="btn" data-auth="login">Log in</button></div></div>`;
    return;
  }
  const counts={overdue:0,soon:0,ok:0};
  events.forEach(e=>counts[status(e)[0]]++);
  summary.textContent=counts.overdue?`${counts.overdue} overdue`:counts.soon?`${counts.soon} due soon`:"All good";
  summary.className="tag "+(counts.overdue?"red":counts.soon?"orange":"green");
  const stats=`<div class="rem-stats"><div class="overdue"><b>${counts.overdue}</b>Overdue</div><div class="soon"><b>${counts.soon}</b>Due soon</div><div class="ok"><b>${counts.ok}</b>Upcoming</div><div class="rem-buttons"><button class="btn primary" id="addEvent">+ Add date</button><button class="btn" id="openTemplate">📋 Bills template</button></div></div>`;
  const list=events.length
    ?`<div class="scroll rem-list">${events.map(row).join("")}</div>`
    :`<div class="rem-empty"><p class="muted">No dates yet. Start with the <button class="link" data-template>monthly bills template</button> or quick add:</p><div class="chips">${SUGGESTIONS.map((s,i)=>`<button class="chip" data-suggest="${i}">${s[0]}</button>`).join("")}</div></div>`;
  body.innerHTML=stats+billsSummary()+list;
}

function billsSummary(){
  const monthly=events.filter(e=>e.repeat==="monthly"&&typeof e.amount==="number");
  if(!monthly.length)return"";
  const t=today(),total=monthly.reduce((s,e)=>s+e.amount,0);
  const left=monthly.filter(e=>{const d=parse(e.dueDate);return d.getMonth()===t.getMonth()&&d.getFullYear()===t.getFullYear()&&d>=t}).reduce((s,e)=>s+e.amount,0);
  return`<div class="bills-summary"><span>💶 Monthly bills <b>${euro(total)}</b></span><span>Still to pay this month <b>${euro(left)}</b></span></div>`;
}

function row(e){
  const[s,label]=status(e),repeats=e.repeat&&e.repeat!=="none";
  return`<div class="rem-item ${s}" data-edit="${e.id}" title="Edit">
    <div><strong>${escapeHtml(e.title)}${typeof e.amount==="number"?` <span class="amount">${euro(e.amount)}</span>`:""}</strong><small>${CATEGORIES[e.category]||CATEGORIES.other} • ${fmt(e.dueDate)}${repeats?" • repeats "+e.repeat:""}</small>${e.notes?`<small class="note">${escapeHtml(e.notes)}</small>`:""}</div>
    <div class="rem-right"><span class="badge">${label}</span>${repeats&&s!=="ok"?`<button class="btn small" data-renew="${e.id}">Renewed ✓</button>`:""}</div></div>`;
}

async function renew(id){
  const e=events.find(x=>x.id===id);
  let next=advance(e.dueDate,e.repeat,e.day);
  while(daysLeft(next)<0)next=advance(next,e.repeat,e.day);
  await updateDoc(doc(db,"users",user.uid,"events",id),{dueDate:next,updatedAt:serverTimestamp()});
}

function openAuth(mode){
  authMode=mode;
  const f=$("authForm");
  f.classList.toggle("signup",mode==="signup");
  f.querySelectorAll(".auth-tabs button").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
  f.elements.password.autocomplete=mode==="signup"?"new-password":"current-password";
  $("authSubmit").textContent=mode==="signup"?"Create account":"Log in";
  msg("authMsg","");
  if(!$("authDlg").open)$("authDlg").showModal();
}

function openEvent(e={}){
  editingId=e.id||null;
  const f=$("eventForm");f.reset();
  $("eventTitle").textContent=editingId?"Edit date":"Add a date";
  f.elements.title.value=e.title||"";
  f.elements.category.value=e.category||"other";
  f.elements.dueDate.value=e.dueDate||"";
  f.elements.repeat.value=e.repeat||"none";
  f.elements.remindDays.value=e.remindDays??"";
  f.elements.amount.value=e.amount??"";
  f.elements.remindDays.placeholder=`Default (${profile.remindDays})`;
  f.elements.notes.value=e.notes||"";
  $("deleteEvent").hidden=!editingId;
  msg("eventMsg","");
  $("eventDlg").showModal();
}

function openProfile(){
  const f=$("profileForm");
  f.elements.displayName.value=profile.name||user.displayName||"";
  f.elements.email.value=user.email||"";
  f.elements.remindDays.value=profile.remindDays;
  msg("profileMsg","");
  $("deleteZone").hidden=true;
  $("deletePwLabel").hidden=!usesPassword();
  $("deletePw").value="";
  msg("deleteMsg","");
  $("profileDlg").showModal();
}

function templateRow(name="",day=1,category="bills"){
  const existing=events.some(e=>e.title.toLowerCase()===name.toLowerCase());
  const div=document.createElement("div");div.className="tpl-row";
  div.innerHTML=`<input type="checkbox" class="tpl-on" aria-label="Include"${existing?"":" checked"}>
    <input class="tpl-name" maxlength="120" placeholder="Payment type" aria-label="Payment type">
    <input class="tpl-day" type="number" min="1" max="31" aria-label="Day of month">
    <input class="tpl-amt" type="number" min="0" step="0.01" placeholder="€ amount" aria-label="Amount in euro">`;
  div.querySelector(".tpl-name").value=name;
  div.querySelector(".tpl-day").value=day;
  div.dataset.category=category;
  if(existing)div.title="Already in your reminders";
  return div;
}

function templateTotal(){
  let sum=0;
  $("templateRows").querySelectorAll(".tpl-row").forEach(r=>{if(r.querySelector(".tpl-on").checked)sum+=Number(r.querySelector(".tpl-amt").value)||0});
  $("templateTotal").textContent=euro(sum);
}

function openTemplate(){
  const rows=$("templateRows");rows.innerHTML="";
  BILLS_TEMPLATE.forEach(([n,d,c])=>rows.append(templateRow(n,d,c)));
  templateTotal();msg("templateMsg","");
  $("templateDlg").showModal();
}

async function addTemplate(ev){
  ev.preventDefault();
  const picked=[...$("templateRows").querySelectorAll(".tpl-row")].filter(r=>r.querySelector(".tpl-on").checked)
    .map(r=>({title:r.querySelector(".tpl-name").value.trim(),day:Math.max(1,Math.min(31,Number(r.querySelector(".tpl-day").value)||1)),
      amount:r.querySelector(".tpl-amt").value,category:r.dataset.category}))
    .filter(p=>p.title);
  if(!picked.length)return msg("templateMsg","Tick at least one bill.");
  const batch=writeBatch(db),col=collection(db,"users",user.uid,"events");
  picked.forEach(p=>batch.set(doc(col),{title:p.title,category:p.category,dueDate:nextDue(p.day),day:p.day,repeat:"monthly",remindDays:3,
    amount:p.amount===""?null:Math.round(Math.abs(Number(p.amount))*100)/100,notes:"",createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
  try{await batch.commit();$("templateDlg").close()}
  catch(e){msg("templateMsg","Could not add the bills. Please try again.")}
}

const usesPassword=()=>user.providerData.some(p=>p.providerId==="password");

function downloadData(){
  const data={exportedAt:new Date().toISOString(),account:{email:user.email,createdAt:user.metadata.creationTime,lastLogin:user.metadata.lastSignInTime},
    profile:{name:profile.name||"",remindDays:profile.remindDays},
    reminders:events.map(({id,title,category,dueDate,repeat,remindDays,amount,notes})=>({id,title,category,dueDate,repeat,remindDays,amount,notes}))};
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
  a.download="euro2rupee-my-data.json";a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

async function deleteAccount(){
  const btn=$("confirmDelete");btn.disabled=true;
  try{
    if(usesPassword()){
      const pw=$("deletePw").value;
      if(!pw){msg("deleteMsg","Enter your password to confirm.");return}
      await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,pw));
    }else await reauthenticateWithPopup(user,new GoogleAuthProvider());
    if(unsubEvents){unsubEvents();unsubEvents=null}
    const snap=await getDocs(collection(db,"users",user.uid,"events"));
    const batch=writeBatch(db);
    snap.docs.forEach(d=>batch.delete(d.ref));
    batch.delete(doc(db,"users",user.uid));
    await batch.commit();
    await deleteUser(user);
    $("profileDlg").close();
    alert("Your account and all your data have been deleted.");
  }catch(e){msg("deleteMsg",e.code?authError(e):"Could not delete your account. Please try again.")}
  finally{btn.disabled=false}
}

function msg(id,text,ok){const el=$(id);el.textContent=text;el.classList.toggle("ok",!!ok)}

function authError(e){
  return{"auth/invalid-credential":"Email or password is incorrect.","auth/wrong-password":"Email or password is incorrect.","auth/user-not-found":"No account found for that email.",
    "auth/email-already-in-use":"An account already exists for that email. Try logging in.","auth/weak-password":"Password must be at least 6 characters.",
    "auth/invalid-email":"Please enter a valid email address.","auth/missing-password":"Please enter your password.","auth/too-many-requests":"Too many attempts. Please wait a few minutes and try again.",
    "auth/popup-closed-by-user":"Google sign-in was cancelled.","auth/popup-blocked":"Google sign-in could not open. Please log in with email and password.","auth/network-request-failed":"Network error. Check your connection."}[e.code]||"Something went wrong. Please try again.";
}

async function loadProfile(){
  const ref=doc(db,"users",user.uid),snap=await getDoc(ref);
  if(snap.exists())profile={remindDays:30,...snap.data()};
  else{
    profile={name:user.displayName||"",email:user.email,remindDays:30};
    await setDoc(ref,{...profile,createdAt:serverTimestamp()});
  }
}

function watchEvents(){
  unsubEvents=onSnapshot(query(collection(db,"users",user.uid,"events"),orderBy("dueDate")),
    snap=>{events=snap.docs.map(d=>({id:d.id,...d.data()}));render()},
    ()=>{body.innerHTML='<div class="loading">Could not load your dates. Please refresh.</div>'});
}

function wireUi(){
  $("categorySelect").innerHTML=Object.entries(CATEGORIES).map(([k,v])=>`<option value="${k}">${v}</option>`).join("");
  document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>b.closest("dialog").close());

  document.addEventListener("click",ev=>{
    const t=ev.target.closest("[data-auth],#profileBtn");
    if(!t)return;
    if(t.dataset.auth)openAuth(t.dataset.auth);else openProfile();
  });

  body.addEventListener("click",ev=>{
    const t=ev.target.closest("button,[data-edit]");
    if(!t||t.dataset.auth)return;
    if(t.id==="addEvent")openEvent();
    else if(t.id==="openTemplate"||"template" in t.dataset)openTemplate();
    else if(t.dataset.suggest){const[title,category,repeat]=SUGGESTIONS[t.dataset.suggest];openEvent({title,category,repeat})}
    else if(t.dataset.renew)renew(t.dataset.renew);
    else if(t.dataset.edit)openEvent(events.find(e=>e.id===t.dataset.edit));
  });

  $("authForm").querySelectorAll(".auth-tabs button").forEach(b=>b.onclick=()=>openAuth(b.dataset.mode));

  $("authForm").onsubmit=async ev=>{
    ev.preventDefault();
    const f=ev.target,email=f.elements.email.value.trim(),password=f.elements.password.value;
    if(!email||!password)return msg("authMsg","Please enter your email and password.");
    $("authSubmit").disabled=true;
    try{
      if(authMode==="signup"){
        const name=f.elements.displayName.value.trim();
        const cred=await createUserWithEmailAndPassword(auth,email,password);
        if(name)await updateProfile(cred.user,{displayName:name});
        profile={name,email,remindDays:30};
        await setDoc(doc(db,"users",cred.user.uid),{...profile,createdAt:serverTimestamp()});
        renderAccount();
      }else await signInWithEmailAndPassword(auth,email,password);
      f.reset();$("authDlg").close();
    }catch(e){msg("authMsg",authError(e))}
    finally{$("authSubmit").disabled=false}
  };

  $("googleBtn").onclick=async()=>{
    try{await signInWithPopup(auth,new GoogleAuthProvider());$("authDlg").close()}
    catch(e){msg("authMsg",authError(e))}
  };

  $("forgotBtn").onclick=async()=>{
    const email=$("authForm").elements.email.value.trim();
    if(!email)return msg("authMsg","Enter your email above, then click “Forgot password?” again.");
    try{await sendPasswordResetEmail(auth,email);msg("authMsg","If an account exists for that email, a reset link is on its way.",true)}
    catch(e){msg("authMsg",authError(e))}
  };

  $("eventForm").onsubmit=async ev=>{
    ev.preventDefault();
    const f=ev.target,title=f.elements.title.value.trim(),dueDate=f.elements.dueDate.value;
    if(!title||!dueDate)return msg("eventMsg","Please enter a name and a due date.");
    const rd=f.elements.remindDays.value,amt=f.elements.amount.value;
    const data={title,dueDate,category:f.elements.category.value,repeat:f.elements.repeat.value,
      remindDays:rd===""?null:Math.max(0,Math.min(365,Number(rd))),amount:amt===""?null:Math.round(Math.abs(Number(amt))*100)/100,
      day:parse(dueDate).getDate(),notes:f.elements.notes.value.trim(),updatedAt:serverTimestamp()};
    try{
      if(editingId)await updateDoc(doc(db,"users",user.uid,"events",editingId),data);
      else await addDoc(collection(db,"users",user.uid,"events"),{...data,createdAt:serverTimestamp()});
      $("eventDlg").close();
    }catch(e){msg("eventMsg","Could not save. Please try again.")}
  };

  $("deleteEvent").onclick=async()=>{
    if(!editingId||!confirm("Delete this date?"))return;
    await deleteDoc(doc(db,"users",user.uid,"events",editingId));
    $("eventDlg").close();
  };

  $("profileForm").onsubmit=async ev=>{
    ev.preventDefault();
    const f=ev.target,name=f.elements.displayName.value.trim(),remindDays=Math.max(0,Math.min(365,Number(f.elements.remindDays.value)||0));
    try{
      await setDoc(doc(db,"users",user.uid),{name,remindDays,updatedAt:serverTimestamp()},{merge:true});
      if(name!==(user.displayName||""))await updateProfile(user,{displayName:name});
      profile={...profile,name,remindDays};
      renderAccount();render();
      msg("profileMsg","Profile saved.",true);
    }catch(e){msg("profileMsg","Could not save your profile. Please try again.")}
  };

  $("resetPwBtn").onclick=async()=>{
    try{await sendPasswordResetEmail(auth,user.email);msg("profileMsg","Password reset email sent to "+user.email,true)}
    catch(e){msg("profileMsg",authError(e))}
  };

  $("signOutBtn").onclick=async()=>{await signOut(auth);$("profileDlg").close()};
  $("downloadBtn").onclick=downloadData;
  $("templateForm").onsubmit=addTemplate;
  $("templateRows").addEventListener("input",templateTotal);
  $("addTemplateRow").onclick=()=>{const r=templateRow("",1,"bills");$("templateRows").append(r);r.querySelector(".tpl-name").focus()};
  $("deleteStart").onclick=()=>{$("deleteZone").hidden=false;if(usesPassword())$("deletePw").focus()};
  $("cancelDelete").onclick=()=>{$("deleteZone").hidden=true};
  $("confirmDelete").onclick=deleteAccount;
}

function start(){
  const app=initializeApp(firebaseConfig);
  auth=getAuth(app);db=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});
  wireUi();
  onAuthStateChanged(auth,async u=>{
    if(unsubEvents){unsubEvents();unsubEvents=null}
    user=u;events=[];profile={remindDays:30};
    if(user){
      body.innerHTML='<div class="loading">Loading your dates…</div>';
      try{await loadProfile()}catch(e){}
      watchEvents();
    }
    renderAccount();render();
  });
  setInterval(render,3600000);
}

if(firebaseConfig.apiKey)start();
else body.innerHTML='<p class="muted">Reminders aren’t set up yet. Add your Firebase config to <code>firebase-config.js</code> (see README).</p>';
