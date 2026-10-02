const $ = (id) => document.getElementById(id);

const announcements = [
  {
    title: "Welcome to the new community dashboard",
    text: "Currency tools, announcements and local events are now available in one place.",
    date: "Today"
  },
  {
    title: "Suggest a new widget",
    text: "Sports, weather, transport, calculators and more can be added next.",
    date: "Dashboard update"
  },
  {
    title: "Community information",
    text: "This section can later be connected to an admin panel so announcements can be updated without changing the website.",
    date: "Coming soon"
  }
];

const events = [
  { day: "18", month: "OCT", title: "Community Cultural Event", place: "Dublin • Details coming soon" },
  { day: "25", month: "OCT", title: "Community Meetup", place: "Dublin • Details coming soon" },
  { day: "02", month: "NOV", title: "Family & Community Day", place: "Ireland • Details coming soon" }
];

function renderContent() {
  $("announcements").innerHTML = announcements.map(a => `
    <div class="notice">
      <strong>${a.title}</strong>
      <span>${a.text}</span>
      <time>${a.date}</time>
    </div>
  `).join("");

  $("events").innerHTML = events.map(e => `
    <div class="event">
      <div class="date-box"><b>${e.day}</b><span>${e.month}</span></div>
      <div><strong>${e.title}</strong><small>${e.place}</small></div>
    </div>
  `).join("");

  $("today").textContent = new Intl.DateTimeFormat("en-IE", {
    weekday: "short", day: "numeric", month: "short", year: "numeric"
  }).format(new Date());

  $("year").textContent = new Date().getFullYear();
}

let rates = {};

async function fetchRates() {
  const from = $("fromCurrency").value;
  const to = $("toCurrency").value;
  if (from === to) {
    rates = { [to]: 1 };
    $("rateStatus").textContent = "Ready";
    updateConversion();
    return;
  }

  $("rateStatus").textContent = "Updating…";
  try {
    const response = await fetch(
      `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    );
    if (!response.ok) throw new Error("Rate request failed");
    const data = await response.json();
    rates = data.rates || {};
    $("rateStatus").textContent = "Live";
    updateConversion();
  } catch (error) {
    $("rateStatus").textContent = "Offline";
    $("result").textContent = "Unavailable";
    $("rateText").textContent = "Could not load the reference rate. Please try again.";
  }
}

function updateConversion() {
  const amount = Number($("amount").value) || 0;
  const from = $("fromCurrency").value;
  const to = $("toCurrency").value;
  const rate = from === to ? 1 : rates[to];

  if (!rate) return;
  const converted = amount * rate;

  $("resultLabel").textContent = `${formatMoney(amount, from)} ${from}`;
  $("result").textContent = `${formatMoney(converted, to)} ${to}`;
  $("rateText").textContent = `1 ${from} = ${rate.toFixed(4)} ${to}`;
}

function formatMoney(value, currency) {
  return new Intl.NumberFormat("en-IE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

$("amount").addEventListener("input", updateConversion);
$("fromCurrency").addEventListener("change", fetchRates);
$("toCurrency").addEventListener("change", fetchRates);

$("swap").addEventListener("click", () => {
  const from = $("fromCurrency").value;
  $("fromCurrency").value = $("toCurrency").value;
  $("toCurrency").value = from;
  fetchRates();
});

renderContent();
fetchRates();
