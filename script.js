const EUR_INR_RATE = 102;

function convert(){
  const eur = parseFloat(document.getElementById("eurInput").value) || 0;
  document.getElementById("inrResult").textContent =
    "₹" + (eur * EUR_INR_RATE).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
}
function setEUR(value){
  document.getElementById("eurInput").value=value;
  convert();
}
function toggleMenu(){
  document.getElementById("mobileMenu").classList.toggle("open");
}
function toolMessage(name){
  document.getElementById("toolMessage").textContent =
    name + " selected — this widget can be connected next.";
}
const now=new Date();
document.getElementById("dayName").textContent=now.toLocaleDateString("en-IE",{weekday:"long"});
document.getElementById("todayDate").textContent=now.toLocaleDateString("en-IE",{day:"numeric",month:"short",year:"numeric"});
document.getElementById("year").textContent=now.getFullYear();
convert();
