const amount=document.getElementById("amount");let from="EUR",to="INR",rateValue=null;
async function loadRate(){
  const status=document.getElementById("currencyStatus");
  status.textContent="Getting live market rate…";
  try{
    const r=await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`,{cache:"no-store"});
    if(!r.ok)throw new Error("rate request failed");
    const data=await r.json(); rateValue=data.rates[to];
    document.getElementById("rate").textContent=rateValue.toFixed(4);
    document.getElementById("rateFrom").textContent=from;document.getElementById("rateTo").textContent=to;
    document.getElementById("updated").textContent="Updated "+new Date().toLocaleTimeString("en-IE",{hour:"2-digit",minute:"2-digit"});
    status.textContent="Live mid-market reference rate • refreshes every 15 minutes";
    calculate();
  }catch(e){status.textContent="Live rate temporarily unavailable — try refresh.";calculate()}
}
function calculate(){
  const n=Number(amount.value)||0;
  document.getElementById("result").textContent=rateValue?new Intl.NumberFormat("en-IN",{maximumFractionDigits:2}).format(n*rateValue):"—";
}
amount.addEventListener("input",calculate);
document.querySelectorAll(".quick button").forEach(b=>b.onclick=()=>{amount.value=b.dataset.v;calculate()});
document.getElementById("swap").onclick=()=>{[from,to]=[to,from];updateLabels();loadRate()};
function updateLabels(){
  const euro=from==="EUR";document.getElementById("fromFlag").textContent=euro?"🇪🇺":"🇮🇳";document.getElementById("toFlag").textContent=euro?"🇮🇳":"🇪🇺";
  document.getElementById("fromName").textContent=from;document.getElementById("toName").textContent=to;document.getElementById("fromLabel").textContent=from;document.getElementById("toLabel").textContent=to;
}
async function loadSports(){
 try{
  const r=await fetch("sports.json?ts="+Date.now(),{cache:"no-store"});const data=await r.json();const feed=document.getElementById("sportsFeed");
  feed.innerHTML=data.map(x=>`<a class="sports-item ${x.category}" href="${x.url}" target="_blank" rel="noopener"><span class="news-tag">${x.category.toUpperCase()}</span><strong>${escapeHtml(x.title)}</strong><small>${escapeHtml(x.source)} • ${escapeHtml(x.date)}</small></a>`).join("");
  document.getElementById("sportsUpdated").textContent="Feed updated "+new Date().toLocaleTimeString("en-IE",{hour:"2-digit",minute:"2-digit"});
 }catch(e){document.getElementById("sportsFeed").innerHTML='<div class="loading">Sports feed is temporarily unavailable.</div>'}
}
function filterSports(c,b){document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".sports-item").forEach(x=>x.style.display=c==="all"||x.classList.contains(c)?"block":"none")}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function tick(){document.getElementById("clock").textContent=new Date().toLocaleString("en-IE",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}
tick();setInterval(tick,30000);loadRate();setInterval(loadRate,900000);loadSports();setInterval(loadSports,1800000);document.getElementById("year").textContent=new Date().getFullYear();
