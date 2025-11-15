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
const TRIO_IDENTIFIER = "19:00 - Trio with Experience";
const TRIO_CAPACITY = 3;

function populateOptions() {
  const today = new Date();
  const slot18 = document.getElementById("slot18");
  const slot19 = document.getElementById("slot19");

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

    // 18:00 All Levels class
    const option18 = document.createElement("option");
    option18.value = `${dateStr} 18:00 - Group All Levels (Reformer, 10–15 €)`;
    option18.textContent = dateStr;
    slot18.appendChild(option18);

    // 19:00 Trio class
    const option19 = document.createElement("option");
    option19.value = `${dateStr} 19:00 - Trio with Experience (Cadillac, Chair, Ladder Barrel, Reformer, 20–30 €)`;
    option19.textContent = dateStr;
    slot19.appendChild(option19);
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
  const slotDatePart = slotValue.includes("19:00")
    ? slotValue.split("19:00")[0].trim()
    : slotValue.trim();
  const trioBookings = bookings.filter((entry) => {
    const slotText = entry.Slot || "";
    if (!slotText.includes(TRIO_IDENTIFIER)) {
      return false;
    }
    const entryDatePart = slotText.includes("19:00")
      ? slotText.split("19:00")[0].trim()
      : slotText.trim();
    return entryDatePart === slotDatePart;
  });
  return trioBookings.length < TRIO_CAPACITY;
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
    const countsByDate = {};
    bookings.forEach((entry) => {
      const slotText = entry.Slot || "";
      if (!slotText.includes(TRIO_IDENTIFIER)) {
        return;
      }
      const datePart = slotText.includes("19:00")
        ? slotText.split("19:00")[0].trim()
        : slotText.trim();
      countsByDate[datePart] = (countsByDate[datePart] || 0) + 1;
    });
    const select19 = document.getElementById("slot19");
    Array.from(select19.options).forEach((option) => {
      if (!option.value) {
        return;
      }
      const optionDatePart = option.value.includes("19:00")
        ? option.value.split("19:00")[0].trim()
        : option.value.trim();
      if (countsByDate[optionDatePart] >= TRIO_CAPACITY) {
        option.disabled = true;
        option.textContent = `${option.textContent} (Full)`;
      }
    });
  } catch (error) {
    console.error("Failed to mark full trio classes", error);
  }
}

// Handle form submission
const form = document.getElementById("bookingForm");
form.addEventListener("submit", async function (e) {
  e.preventDefault();
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const slot18 = document.getElementById("slot18").value;
  const slot19 = document.getElementById("slot19").value;

  const chosenSlot = slot18 || slot19;
  if (!chosenSlot) {
    document.getElementById("message").textContent = "⚠️ Please select a class date.";
    return;
  }

  const isTrioSlot = !!slot19 && chosenSlot === slot19;
  if (isTrioSlot) {
    document.getElementById("message").textContent = "Checking availability...";
    try {
      const available = await isTrioSlotAvailable(chosenSlot);
      if (!available) {
        document.getElementById("message").textContent =
          "⚠️ Sorry, that 19:00 class already has 3 bookings.";
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
