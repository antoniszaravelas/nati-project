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

function getStartOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isClassBookable(classDate, timeHHMM) {
  const now = new Date();
  const classDay = getStartOfDay(classDate);
  const today = getStartOfDay(now);

  if (classDay < today) {
    return false;
  }
  if (classDay > today) {
    return true;
  }

  const [hours, minutes] = timeHHMM.split(":").map(Number);
  const cutoff = new Date(now);
  cutoff.setHours(hours, minutes - 10, 0, 0);
  return now < cutoff;
}

function getClassDateFromSlot(slotValue) {
  const match = slotValue.match(/^(\d{1,2}\s+[A-Za-z]+\s+\d{4})/);
  if (!match) {
    return null;
  }
  const isoDate = parseDateKey(match[1]);
  if (!isoDate) {
    return null;
  }
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getClassTimeFromSlot(slotValue) {
  const match = slotValue.match(/\s(\d{2}:\d{2})\s+-/);
  return match ? match[1] : null;
}

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7pPKmyxkjuKnU0BshXLpKc9PUHtMvRc8czQb7gWNGTBIvLZX1L5nfRiYqeah0FnGddLomYpgtsSLw/pub?gid=0&single=true&output=csv";
const REFORMER_LABEL = "All Levels, Only Reformer, Small Group, 20 €";
const REFORMER_LABEL_MARKER = "only reformer";
const REFORMER_TIME = "18:10";
const REFORMER_CAPACITY = 6;

const CIRCUIT_LABEL =
  "Level With Experience, Circuit: Cadillac, Chair, Ladder Barrel, 3 People, 20–25 €";
const CIRCUIT_LABEL_MARKER = "level with experience";
const CIRCUIT_TIME = "19:10";
const CIRCUIT_CAPACITY = 3;

const SESSION_BASELINE_KEY = "natiSheetBaseline";
const SESSION_EXTRA_KEY = { reformer: "natiSessionReformerExtra", circuit: "natiSessionCircuitExtra" };

function populateOptions() {
  const today = new Date();
  const slot1810 = document.getElementById("slot1810");
  const slot1910 = document.getElementById("slot1910");

  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const mondaysThisMonth = getMondaysInMonth(currentYear, currentMonth, getStartOfDay(today));

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

    if (isClassBookable(monday, REFORMER_TIME)) {
      const option1810 = document.createElement("option");
      option1810.value = `${dateStr} ${REFORMER_TIME} - ${REFORMER_LABEL}`;
      option1810.textContent = dateStr;
      slot1810.appendChild(option1810);
    }

    if (isClassBookable(monday, CIRCUIT_TIME)) {
      const option1910 = document.createElement("option");
      option1910.value = `${dateStr} ${CIRCUIT_TIME} - ${CIRCUIT_LABEL}`;
      option1910.textContent = dateStr;
      slot1910.appendChild(option1910);
    }
  });
}

populateOptions();
refreshClassAvailability();

function extractSlotFromCsvRow(row) {
  const quotedSlot = row.match(/,\s*"([^"]*\d{2}:\d{2}[^"]*)"\s*$/);
  if (quotedSlot) {
    return quotedSlot[1].trim();
  }
  const splitRegex = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;
  const cells = row.split(splitRegex).map((cell) => cell.replace(/^"|"$/g, "").trim());
  return cells[cells.length - 1] || "";
}

function getSessionBaseline() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_BASELINE_KEY) || "{}");
  } catch (error) {
    return {};
  }
}

function ensureSessionBaseline(reformerCounts, circuitCounts) {
  if (!sessionStorage.getItem(SESSION_BASELINE_KEY)) {
    sessionStorage.setItem(
      SESSION_BASELINE_KEY,
      JSON.stringify({ reformer: reformerCounts, circuit: circuitCounts })
    );
  }
}

function getSessionExtra(type, key) {
  try {
    const data = JSON.parse(sessionStorage.getItem(SESSION_EXTRA_KEY[type]) || "{}");
    return data[key] || 0;
  } catch (error) {
    return 0;
  }
}

function addSessionExtra(type, key) {
  const storageKey = SESSION_EXTRA_KEY[type];
  const data = JSON.parse(sessionStorage.getItem(storageKey) || "{}");
  data[key] = (data[key] || 0) + 1;
  sessionStorage.setItem(storageKey, JSON.stringify(data));
}

function getEffectiveCount(type, sheetCounts, key) {
  const baseline = getSessionBaseline()[type] || {};
  const extra = getSessionExtra(type, key);
  const sheetNow = sheetCounts[key] || 0;
  const base = baseline[key] || 0;
  const appearedOnSheet = Math.max(0, sheetNow - base);
  return sheetNow + Math.max(0, extra - appearedOnSheet);
}

function mergeCountsWithSession(type, sheetCounts) {
  const merged = { ...sheetCounts };
  const baseline = getSessionBaseline()[type] || {};
  const allKeys = new Set([...Object.keys(sheetCounts), ...Object.keys(baseline)]);
  allKeys.forEach((key) => {
    merged[key] = getEffectiveCount(type, sheetCounts, key);
  });
  Object.keys(JSON.parse(sessionStorage.getItem(SESSION_EXTRA_KEY[type]) || "{}")).forEach((key) => {
    merged[key] = getEffectiveCount(type, sheetCounts, key);
  });
  return merged;
}

async function fetchSheetCsv() {
  const cacheBustedUrl = `${SHEET_CSV_URL}&cb=${Date.now()}`;
  const response = await fetch(cacheBustedUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to fetch sheet data");
  }
  return response.text();
}

async function refreshClassAvailability() {
  try {
    const csvText = await fetchSheetCsv();
    const reformerCounts = countReformerBookingsFromCsv(csvText);
    const circuitCounts = countCircuitBookingsFromCsv(csvText);
    ensureSessionBaseline(reformerCounts, circuitCounts);
    resetSelectAvailability("slot1810");
    resetSelectAvailability("slot1910");
    markSelectFull(
      "slot1810",
      mergeCountsWithSession("reformer", reformerCounts),
      getReformerKey,
      REFORMER_CAPACITY
    );
    markSelectFull(
      "slot1910",
      mergeCountsWithSession("circuit", circuitCounts),
      getCircuitKey,
      CIRCUIT_CAPACITY
    );
  } catch (error) {
    console.error("Failed to refresh class availability", error);
  }
}

function resetSelectAvailability(selectId) {
  const select = document.getElementById(selectId);
  if (!select) {
    return;
  }
  Array.from(select.options).forEach((option) => {
    if (!option.value) {
      return;
    }
    option.disabled = false;
    option.textContent = option.textContent.replace(/ \(Full\)$/, "");
  });
}

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

async function isSlotAvailable(slotValue, getKey, countFromCsv, capacity, sessionType) {
  const csvText = await fetchSheetCsv();
  const sheetCounts = countFromCsv(csvText);
  ensureSessionBaseline(
    countReformerBookingsFromCsv(csvText),
    countCircuitBookingsFromCsv(csvText)
  );
  const counts = mergeCountsWithSession(sessionType, sheetCounts);
  const key = getKey(slotValue);
  if (!key) {
    return true;
  }
  return (counts[key] || 0) < capacity;
}

function markSelectFull(selectId, counts, getKey, capacity) {
  const select = document.getElementById(selectId);
  if (!select) {
    return;
  }
  Array.from(select.options).forEach((option) => {
    if (!option.value) {
      return;
    }
    const key = getKey(option.value);
    if (!key) {
      return;
    }
    if ((counts[key] || 0) >= capacity) {
      option.disabled = true;
      option.textContent = `${option.textContent} (Full)`;
    }
  });
}

function countBookingsFromCsv(csvText, labelMarker, classTime) {
  const rows = csvText.trim().split(/\r?\n/);
  const counts = {};
  rows.forEach((row) => {
    if (!row.trim()) {
      return;
    }
    const slotText = extractSlotFromCsvRow(row);
    const key = getSlotKey(slotText, labelMarker, classTime);
    if (!key) {
      return;
    }
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function countReformerBookingsFromCsv(csvText) {
  return countBookingsFromCsv(csvText, REFORMER_LABEL_MARKER, REFORMER_TIME);
}

function countCircuitBookingsFromCsv(csvText) {
  return countBookingsFromCsv(csvText, CIRCUIT_LABEL_MARKER, CIRCUIT_TIME);
}

function getSlotKey(slotText, labelMarker, classTime) {
  if (!slotText) {
    return null;
  }
  const normalized = normalizeText(slotText);
  if (!normalized.includes(labelMarker)) {
    return null;
  }
  const match = normalized.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})\s+(\d{2}:\d{2})/);
  if (!match) {
    return null;
  }
  const datePart = `${match[1]} ${match[2]} ${match[3]}`.trim();
  const timePart = match[4];
  if (timePart !== classTime) {
    return null;
  }
  const isoDate = parseDateKey(datePart);
  if (!isoDate) {
    return null;
  }
  return `${isoDate}-${timePart}`;
}

function getReformerKey(slotText) {
  return getSlotKey(slotText, REFORMER_LABEL_MARKER, REFORMER_TIME);
}

function countCircuitBookings(bookings) {
  const counts = {};
  bookings.forEach((entry) => {
    const slotText = getSlotValue(entry);
    const key = getCircuitKey(slotText);
    if (!key) {
      return;
    }
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function getCircuitKey(slotText) {
  return getSlotKey(slotText, CIRCUIT_LABEL_MARKER, CIRCUIT_TIME);
}

function getSlotValue(entry) {
  if (entry.Slot) {
    return entry.Slot;
  }
  const key = Object.keys(entry).find((k) => k.trim().toLowerCase() === "slot");
  if (key && entry[key]) {
    return entry[key];
  }
  const values = Object.values(entry);
  const match = values.find((value) => normalizeText(value).includes(CIRCUIT_LABEL_MARKER));
  return match || "";
}

function includesNormalizedLabel(text, label) {
  return normalizeText(text).includes(normalizeText(label));
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/â€“|â€”/g, "-")
    .replace(/â‚¬/g, "€")
    .replace(/[–—]/g, "-")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDateKey(dateText) {
  const match = dateText.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/);
  if (!match) {
    return null;
  }
  const day = Number(match[1]);
  const monthText = match[2].toLowerCase();
  const year = Number(match[3]);
  const monthIndex = getMonthIndex(monthText);
  if (!Number.isFinite(day) || !Number.isFinite(year) || monthIndex === null) {
    return null;
  }
  const date = new Date(Date.UTC(year, monthIndex, day));
  return date.toISOString().split("T")[0];
}

function getMonthIndex(monthText) {
  const map = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
  };
  return Object.prototype.hasOwnProperty.call(map, monthText) ? map[monthText] : null;
}

// Handle form submission
const form = document.getElementById("bookingForm");
form.addEventListener("submit", async function (e) {
  e.preventDefault();
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const slot1810 = document.getElementById("slot1810").value;
  const slot1910 = document.getElementById("slot1910").value;

  const chosenSlot = slot1810 || slot1910;
  if (!chosenSlot) {
    document.getElementById("message").textContent = "⚠️ Please select a class date.";
    return;
  }

  const classDate = getClassDateFromSlot(chosenSlot);
  const classTime = getClassTimeFromSlot(chosenSlot);
  if (classDate && classTime && !isClassBookable(classDate, classTime)) {
    document.getElementById("message").textContent =
      "⚠️ Online booking for this class has closed (10 minutes before start).";
    return;
  }

  const reformerKey = getReformerKey(chosenSlot);
  const circuitKey = getCircuitKey(chosenSlot);
  if (reformerKey || circuitKey) {
    document.getElementById("message").textContent = "Checking availability...";
    try {
      let available = true;
      let capacity = 0;
      if (reformerKey) {
        available = await isSlotAvailable(
          chosenSlot,
          getReformerKey,
          countReformerBookingsFromCsv,
          REFORMER_CAPACITY,
          "reformer"
        );
        capacity = REFORMER_CAPACITY;
      } else if (circuitKey) {
        available = await isSlotAvailable(
          chosenSlot,
          getCircuitKey,
          countCircuitBookingsFromCsv,
          CIRCUIT_CAPACITY,
          "circuit"
        );
        capacity = CIRCUIT_CAPACITY;
      }
      if (!available) {
        document.getElementById("message").textContent =
          `⚠️ Sorry, that class already has ${capacity} bookings.`;
        return;
      }
    } catch (err) {
      document.getElementById("message").textContent =
        "❌ Could not verify availability. Please try again.";
      return;
    }
  }

  // Send as URL-encoded form data so the Apps Script can read e.parameter values
  try {
    const payload = new URLSearchParams({
      name,
      email,
      phone,
      slot: chosenSlot,
    });
  
    const response = await fetch(
      "https://script.google.com/macros/s/AKfycbxDmADH9z4xJVdWasg5lgS0-8X1Xaee09Hm16oRA3XYTP6aMYxaljOX4MgSHYOQFa5G/exec",
      {
        method: "POST",
        body: payload,
      }
    );
  
    const text = await response.text().catch(() => "");
  
    if (response.ok) {
      if (reformerKey) {
        addSessionExtra("reformer", reformerKey);
      } else if (circuitKey) {
        addSessionExtra("circuit", circuitKey);
      }
  
      await refreshClassAvailability();
  
      document.getElementById("message").textContent =
        "✅ Booking confirmed for " + chosenSlot;
  
      form.reset();
      return;
    }
  
    throw new Error(
      `Request failed: ${response.status} ${response.statusText} ${text}`
    );
  } catch (error) {
    console.error("Booking submission failed", error);
  
    document.getElementById("message").textContent =
      "❌ Error. Please try again or contact us directly.";
  }
});
