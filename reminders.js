import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import{getAuth,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,updateProfile,sendPasswordResetEmail,GoogleAuthProvider,signInWithPopup}from"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import{getFirestore,collection,doc,addDoc,updateDoc,deleteDoc,setDoc,getDoc,onSnapshot,query,orderBy,serverTimestamp}from"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import{firebaseConfig}from"./firebase-config.js";

const $=id=>document.getElementById(id);
const body=$("remBody"),summary=$("remSummary"),account=$("account");
const CATEGORIES={insurance:"🛡️ Insurance",vehicle:"🚗 Vehicle (NCT, motor tax)",documents:"🛂 Documents (passport, IRP, visa)",bills:"🧾 Bills & subscriptions",health:"🩺 Health",family:"🎂 Birthdays & family",other:"📌 Other"};
const SUGGESTIONS=[["Car insurance renewal","insurance","yearly"],["NCT test","vehicle","none"],["Motor tax","vehicle","yearly"],["Home insurance","insurance","yearly"],["IRP card renewal","documents","none"],["Passport renewal","documents","none"],["Health insurance","insurance","yearly"]];
let auth,db,user=null,profile={remindDays:30},events=[],unsubEvents=null,authMode="login",editingId=null;

const today=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const parse=s=>{const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const daysLeft=s=>Math.round((parse(s)-today())/864e5);
const fmt=s=>parse(s).toLocaleDateString("en-IE",{day:"numeric",month:"short",year:"numeric"});
const plural=(n,w)=>`${n} ${w}${n===1?"":"s"}`;

function advance(s,repeat){
  const d=parse(s),day=d.getDate(),months=repeat==="monthly"?1:12;
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
  const stats=`<div class="rem-stats"><div class="overdue"><b>${counts.overdue}</b>Overdue</div><div class="soon"><b>${counts.soon}</b>Due soon</div><div class="ok"><b>${counts.ok}</b>Upcoming</div><button class="btn primary" id="addEvent">+ Add date</button></div>`;
  const list=events.length
    ?`<div class="scroll rem-list">${events.map(row).join("")}</div>`
    :`<div class="rem-empty"><p class="muted">No dates yet. Quick add:</p><div class="chips">${SUGGESTIONS.map((s,i)=>`<button class="chip" data-suggest="${i}">${s[0]}</button>`).join("")}</div></div>`;
  body.innerHTML=stats+list;
}

function row(e){
  const[s,label]=status(e),repeats=e.repeat&&e.repeat!=="none";
  return`<div class="rem-item ${s}" data-edit="${e.id}" title="Edit">
    <div><strong>${escapeHtml(e.title)}</strong><small>${CATEGORIES[e.category]||CATEGORIES.other} • ${fmt(e.dueDate)}${repeats?" • repeats "+e.repeat:""}</small>${e.notes?`<small class="note">${escapeHtml(e.notes)}</small>`:""}</div>
    <div class="rem-right"><span class="badge">${label}</span>${repeats&&s!=="ok"?`<button class="btn small" data-renew="${e.id}">Renewed ✓</button>`:""}</div></div>`;
}

async function renew(id){
  const e=events.find(x=>x.id===id);
  let next=advance(e.dueDate,e.repeat);
  while(daysLeft(next)<0)next=advance(next,e.repeat);
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
  $("profileDlg").showModal();
}

function msg(id,text,ok){const el=$(id);el.textContent=text;el.classList.toggle("ok",!!ok)}

function authError(e){
  return{"auth/invalid-credential":"Email or password is incorrect.","auth/wrong-password":"Email or password is incorrect.","auth/user-not-found":"No account found for that email.",
    "auth/email-already-in-use":"An account already exists for that email. Try logging in.","auth/weak-password":"Password must be at least 6 characters.",
    "auth/invalid-email":"Please enter a valid email address.","auth/missing-password":"Please enter your password.","auth/too-many-requests":"Too many attempts. Please wait a few minutes and try again.",
    "auth/popup-closed-by-user":"Google sign-in was cancelled.","auth/network-request-failed":"Network error. Check your connection."}[e.code]||"Something went wrong. Please try again.";
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
    const rd=f.elements.remindDays.value;
    const data={title,dueDate,category:f.elements.category.value,repeat:f.elements.repeat.value,
      remindDays:rd===""?null:Math.max(0,Math.min(365,Number(rd))),notes:f.elements.notes.value.trim(),updatedAt:serverTimestamp()};
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
}

function start(){
  const app=initializeApp(firebaseConfig);
  auth=getAuth(app);db=getFirestore(app);
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
