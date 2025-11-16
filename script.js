// Get all Mondays in a given month
function getMondaysInMonth(year, month, startDate = null) {
  let mondays = [];
  const date = new Date(year, month, 1);
  while (date.getDay() !== 1) {
    date.setDate(date.getDate() + 1);
  }
  while (date.getMonth() === month) {
    if (!startDate || date >= startDate) {
      mondays.push(new Date(date));
    }
    date.setDate(date.getDate() + 7);
  }
  return mondays;
}

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRuRNAmSnkd0gJw-wlVuK8izku-nh6OC8NmgNpHHLC9xlsaJTud8xHNcceg8wcvy4rqvKMRA9Xe9b-M/pub?gid=0&single=true&output=csv";
const TRIO_LABEL = "Trio with Experience (Cadillac, Chair, Ladder Barrel, Reformer, 20–30 €)";
const TRIO_TIMES = ["19:00", "20:00"];
const TRIO_CAPACITY = 3;

function populateOptions() {
  const today = new Date();
  const slot19 = document.getElementById("slot19");
  const slot20 = document.getElementById("slot20");

  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Mondays this month
  const mondaysThisMonth = getMondaysInMonth(currentYear, currentMonth, today);

  // Mondays next month
  let nextMonth = currentMonth + 1;
  let nextYear = currentYear;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear++;
  }
  const mondaysNextMonth = getMondaysInMonth(nextYear, nextMonth);

  const allMondays = mondaysThisMonth.concat(mondaysNextMonth);

  allMondays.forEach((monday) => {
    const dateStr = monday.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    // 19:00 Trio class
    const option19 = document.createElement("option");
    option19.value = `${dateStr} 19:00 - ${TRIO_LABEL}`;
    option19.textContent = dateStr;
    slot19.appendChild(option19);

    // 20:00 Trio class
    const option20 = document.createElement("option");
    option20.value = `${dateStr} 20:00 - ${TRIO_LABEL}`;
    option20.textContent = dateStr;
    slot20.appendChild(option20);
  });
}

populateOptions();
markFullTrioClasses();

function parseCsv(text) {
  const rows = text.trim().split(/\r?\n/);
  if (rows.length <= 1) {
    return [];
  }
  const splitRegex = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;
  const headers = rows[0].split(splitRegex).map((h) => h.replace(/^"|"$/g, "").trim());
  return rows
    .slice(1)
    .filter((row) => row.trim().length > 0)
    .map((row) => {
      const cells = row.split(splitRegex).map((cell) => cell.replace(/^"|"$/g, "").trim());
      const entry = {};
      headers.forEach((header, idx) => {
        entry[header] = cells[idx] || "";
      });
      return entry;
    });
}

async function isTrioSlotAvailable(slotValue) {
  const cacheBustedUrl = `${SHEET_CSV_URL}&cb=${Date.now()}`;
  const response = await fetch(cacheBustedUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to fetch sheet data");
  }
  const csvText = await response.text();
  const bookings = parseCsv(csvText);
  const counts = countTrioBookings(bookings);
  const key = getTrioKey(slotValue);
  if (!key) {
    return true;
  }
  return (counts[key] || 0) < TRIO_CAPACITY;
}

async function markFullTrioClasses() {
  try {
    const cacheBustedUrl = `${SHEET_CSV_URL}&initial=${Date.now()}`;
    const response = await fetch(cacheBustedUrl, { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const csvText = await response.text();
    const bookings = parseCsv(csvText);
    const counts = countTrioBookings(bookings);
    ["slot19", "slot20"].forEach((id) => {
      const select = document.getElementById(id);
      if (!select) {
        return;
      }
      Array.from(select.options).forEach((option) => {
        if (!option.value) {
          return;
        }
        const key = getTrioKey(option.value);
        if (!key) {
          return;
        }
        if ((counts[key] || 0) >= TRIO_CAPACITY) {
          option.disabled = true;
          option.textContent = `${option.textContent} (Full)`;
        }
      });
    });
  } catch (error) {
    console.error("Failed to mark full trio classes", error);
  }
}

function countTrioBookings(bookings) {
  const counts = {};
  bookings.forEach((entry) => {
    const slotText = entry.Slot || "";
    const key = getTrioKey(slotText);
    if (!key) {
      return;
    }
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function getTrioKey(slotText) {
  if (!slotText || !slotText.includes(TRIO_LABEL)) {
    return null;
  }
  const match = slotText.match(/^(\d{1,2} \w{3} \d{4}) (\d{2}:\d{2})/);
  if (!match) {
    return null;
  }
  const datePart = match[1];
  const timePart = match[2];
  if (!TRIO_TIMES.includes(timePart)) {
    return null;
  }
  const parsed = new Date(`${datePart} UTC`);
  if (isNaN(parsed)) {
    return null;
  }
  const dateKey = parsed.toISOString().split("T")[0];
  return `${dateKey}-${timePart}`;
}

// Handle form submission
const form = document.getElementById("bookingForm");
form.addEventListener("submit", async function (e) {
  e.preventDefault();
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const slot19 = document.getElementById("slot19").value;
  const slot20 = document.getElementById("slot20").value;

  const chosenSlot = slot19 || slot20;
  if (!chosenSlot) {
    document.getElementById("message").textContent = "⚠️ Please select a class date.";
    return;
  }

  const isTrioSlot = TRIO_TIMES.some((time) => chosenSlot.includes(`${time} - ${TRIO_LABEL}`));
  if (isTrioSlot) {
    document.getElementById("message").textContent = "Checking availability...";
    try {
      const available = await isTrioSlotAvailable(chosenSlot);
      if (!available) {
        document.getElementById("message").textContent =
          "⚠️ Sorry, that class already has 3 bookings.";
        return;
      }
    } catch (err) {
      document.getElementById("message").textContent =
        "❌ Could not verify availability. Please try again.";
      return;
    }
  }

  fetch("https://script.google.com/macros/s/AKfycbxOOWFiDDiqbeDkjPogoWZx4ItJ0UrpfBj_LRPVVhg3bPORuejjfXZ_f0WrYvgkm7G9/exec", {
    method: "POST",
    body: JSON.stringify({ name, email, phone, slot: chosenSlot }),
  })
    .then((response) => response.json())
    .then((data) => {
      document.getElementById("message").textContent = "✅ Booking confirmed for " + chosenSlot;
      form.reset();
    })
    .catch((error) => {
      document.getElementById("message").textContent = "❌ Error. Please try again.";
    });
});
