const amountEl = document.getElementById("amount");
const fromEl = document.getElementById("from");
const toEl = document.getElementById("to");
const resultEl = document.getElementById("result");
const rateInfoEl = document.getElementById("rateInfo");

async function convert() {
  const amount = Number(amountEl.value);
  const from = fromEl.value;
  const to = toEl.value;

  if (!amount || amount < 0) {
    resultEl.innerHTML = "<strong>Please enter a valid amount.</strong>";
    return;
  }

  resultEl.innerHTML = "<strong>Loading...</strong>";
  rateInfoEl.textContent = "Fetching current exchange rate...";

  try {
    const response = await fetch(
      `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    );

    if (!response.ok) throw new Error("Exchange rate unavailable");

    const data = await response.json();
    const rate = from === to ? 1 : data.rates[to];
    const converted = amount * rate;

    resultEl.innerHTML = `
      <span>${formatNumber(amount)} ${from}</span>
      <strong>${formatNumber(converted)} ${to}</strong>
    `;

    rateInfoEl.textContent =
      `1 ${from} = ${formatNumber(rate, 6)} ${to} · Rate date: ${data.date}`;
  } catch (error) {
    resultEl.innerHTML = "<strong>Unable to get the exchange rate.</strong>";
    rateInfoEl.textContent = "Please try again in a moment.";
  }
}

function formatNumber(value, decimals = 2) {
  return new Intl.NumberFormat("en-IE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

document.getElementById("convert").addEventListener("click", convert);

document.getElementById("swap").addEventListener("click", () => {
  const currentFrom = fromEl.value;
  fromEl.value = toEl.value;
  toEl.value = currentFrom;
  convert();
});

amountEl.addEventListener("input", convert);
fromEl.addEventListener("change", convert);
toEl.addEventListener("change", convert);

convert();
