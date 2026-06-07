if ("Notification" in window && Notification.permission !== "granted") {
    Notification.requestPermission();
}

let snoozeMap = {};

window.onload = function () {
    checkDailyReset();
    setGreeting();
    showCaregiverCode();
    loadCaregiverInfo();
    loadMedicines();
    loadHistory();
    updateStatistics();
    updateUpcomingDose();
    drawWeeklyChart();
    loadTheme();
    syncToCaregiver();
    checkReminders();
};

function scrollToSection(sectionId, clickedItem) {
    const section = document.getElementById(sectionId);

    if (section) {
        section.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.remove("active");
    });

    if (clickedItem) {
        clickedItem.classList.add("active");
    }
}

function scrollToSectionMobile(sectionId) {
    const section = document.getElementById(sectionId);

    if (section) {
        section.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}

function setGreeting() {
    const hour = new Date().getHours();
    let text = "Good Evening 🌙";

    if (hour < 12) {
        text = "Good Morning ☀️";
    } else if (hour < 17) {
        text = "Good Afternoon 🌤️";
    }

    document.getElementById("greetingText").innerText = text + ", Bhavya";
}

function checkDailyReset() {
    const today = new Date().toDateString();
    const lastReset = localStorage.getItem("lastResetDate");

    if (!lastReset) {
        localStorage.setItem("lastResetDate", today);
        return;
    }

    if (today !== lastReset) {
        let medicines = JSON.parse(localStorage.getItem("medicines")) || [];

        medicines = medicines.map(medicine => {
            if (medicine.repeatDaily) {
                medicine.times = medicine.times.map(dose => {
                    dose.taken = false;
                    dose.missedLogged = false;
                    dose.notified = false;
                    return dose;
                });
            }

            return medicine;
        });

        localStorage.setItem("medicines", JSON.stringify(medicines));
        localStorage.setItem("lastResetDate", today);
    }
}

function addTimeField() {
    const input = document.createElement("input");
    input.type = "time";
    input.className = "medicineTime";

    document.getElementById("timeInputs").appendChild(input);
}

function saveMedicine() {
    const editId = document.getElementById("editMedicineId").value;
    const name = document.getElementById("medicineName").value.trim();
    const category = document.getElementById("medicineCategory").value;
    const repeat = document.getElementById("repeatDaily").checked;
    const inputs = document.querySelectorAll(".medicineTime");

    if (name === "") {
        alert("Enter medicine name");
        return;
    }

    if (category === "") {
        alert("Select medicine category");
        return;
    }

    let times = [];

    inputs.forEach(input => {
        if (input.value !== "") {
            times.push({
                time: input.value,
                taken: false,
                missedLogged: false,
                notified: false
            });
        }
    });

    if (times.length === 0) {
        alert("Add at least one time");
        return;
    }

    let medicines = JSON.parse(localStorage.getItem("medicines")) || [];

    if (editId) {
        medicines = medicines.map(medicine => {
            if (medicine.id == editId) {
                return {
                    id: medicine.id,
                    name: name,
                    category: category,
                    repeatDaily: repeat,
                    times: times
                };
            }

            return medicine;
        });

        alert("Medicine updated successfully");
    } else {
        medicines.push({
            id: Date.now(),
            name: name,
            category: category,
            repeatDaily: repeat,
            times: times
        });
    }

    localStorage.setItem("medicines", JSON.stringify(medicines));

    resetMedicineForm();
    refreshAll();
}

function resetMedicineForm() {
    document.getElementById("editMedicineId").value = "";
    document.getElementById("medicineName").value = "";
    document.getElementById("medicineCategory").value = "";
    document.getElementById("repeatDaily").checked = false;

    document.getElementById("timeInputs").innerHTML =
        `<input type="time" class="medicineTime">`;

    document.getElementById("saveMedicineBtn").innerText = "+ Add Medicine";
}

function cancelEdit() {
    resetMedicineForm();
}

function loadMedicines() {
    const medicineList = document.getElementById("medicineList");
    const search = document.getElementById("searchMedicine")?.value.toLowerCase() || "";

    medicineList.innerHTML = "";

    let medicines = JSON.parse(localStorage.getItem("medicines")) || [];

    medicines = medicines.filter(medicine =>
        medicine.name.toLowerCase().includes(search) ||
        (medicine.category || "").toLowerCase().includes(search)
    );

    if (medicines.length === 0) {
        medicineList.innerHTML = `
            <div class="medicine-card empty-state">
                <h2>💊</h2>
                <p>No medicines found. Add your first medicine reminder.</p>
            </div>
        `;
        return;
    }

    medicines.forEach(displayMedicine);
}

function displayMedicine(medicine) {
    const card = document.createElement("div");
    card.className = "medicine-card";

    let doseHTML = "";

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    medicine.times.forEach((dose, index) => {
        const parts = dose.time.split(":");
        const doseMinutes = parseInt(parts[0]) * 60 + parseInt(parts[1]);

        let buttonText = "Mark Taken";
        let buttonColor = "#5b5ce2";
        let takenDisabled = "";

        if (dose.taken) {
            buttonText = "Taken ✓";
            buttonColor = "#22c55e";
            takenDisabled = "disabled";
        } else if (currentMinutes > doseMinutes + 30) {
            buttonText = "Missed ❌";
            buttonColor = "#ef4444";
            takenDisabled = "disabled";

            if (!dose.missedLogged) {
                saveHistory(medicine.name, dose.time, "❌");
                markMissedLogged(medicine.id, index);
            }
        }

        doseHTML += `
            <div class="dose-item">
                <p class="time">⏰ ${formatTime(dose.time)}</p>

                <button class="taken-btn"
                    onclick="markTaken(${medicine.id}, ${index})"
                    ${takenDisabled}
                    style="background:${buttonColor}">
                    ${buttonText}
                </button>

                <button class="snooze-btn"
                    onclick="snooze('${medicine.name}', '${dose.time}')">
                    😴 Snooze
                </button>
            </div>
        `;
    });

    card.innerHTML = `
        <div class="medicine-header">
            <div>
                <h2>${medicine.name}</h2>
                <p class="repeat-text">
                    ${medicine.repeatDaily ? "Daily Medicine" : "One Time Medicine"}
                </p>
                <span class="category-badge">${medicine.category || "Medicine"}</span>
            </div>

            <div class="button-row">
                <button class="edit-btn" onclick="editMedicine(${medicine.id})">
                    ✏️ Edit
                </button>

                <button class="delete-btn" onclick="deleteMedicine(${medicine.id})">
                    🗑 Delete
                </button>
            </div>
        </div>

        ${doseHTML}
    `;

    document.getElementById("medicineList").appendChild(card);
}

function editMedicine(id) {
    const medicines = JSON.parse(localStorage.getItem("medicines")) || [];
    const medicine = medicines.find(m => m.id === id);

    if (!medicine) {
        return;
    }

    document.getElementById("editMedicineId").value = medicine.id;
    document.getElementById("medicineName").value = medicine.name;
    document.getElementById("medicineCategory").value = medicine.category || "";
    document.getElementById("repeatDaily").checked = medicine.repeatDaily;
    document.getElementById("timeInputs").innerHTML = "";

    medicine.times.forEach(dose => {
        const input = document.createElement("input");
        input.type = "time";
        input.className = "medicineTime";
        input.value = dose.time;

        document.getElementById("timeInputs").appendChild(input);
    });

    document.getElementById("saveMedicineBtn").innerText = "Update Medicine";

    scrollToSectionMobile("medicineSection");
}

function markTaken(id, index) {
    let medicines = JSON.parse(localStorage.getItem("medicines")) || [];

    medicines.forEach(medicine => {
        if (medicine.id === id) {
            medicine.times[index].taken = true;
            medicine.times[index].missedLogged = false;
            medicine.times[index].notified = false;

            const key = medicine.name + "_" + medicine.times[index].time;
            delete snoozeMap[key];

            saveHistory(medicine.name, medicine.times[index].time, "✅");
        }
    });

    localStorage.setItem("medicines", JSON.stringify(medicines));

    refreshAll();
}

function markMissedLogged(id, index) {
    let medicines = JSON.parse(localStorage.getItem("medicines")) || [];

    medicines.forEach(medicine => {
        if (medicine.id === id) {
            medicine.times[index].missedLogged = true;
        }
    });

    localStorage.setItem("medicines", JSON.stringify(medicines));
}

function deleteMedicine(id) {
    if (!confirm("Are you sure you want to delete this medicine?")) {
        return;
    }

    let medicines = JSON.parse(localStorage.getItem("medicines")) || [];

    medicines = medicines.filter(medicine => medicine.id !== id);

    localStorage.setItem("medicines", JSON.stringify(medicines));

    refreshAll();
}

function updateStatistics() {
    const medicines = JSON.parse(localStorage.getItem("medicines")) || [];

    let total = medicines.length;
    let taken = 0;
    let pending = 0;
    let missed = 0;
    let daily = 0;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    medicines.forEach(medicine => {
        if (medicine.repeatDaily) {
            daily++;
        }

        medicine.times.forEach(dose => {
            const parts = dose.time.split(":");
            const doseMinutes = parseInt(parts[0]) * 60 + parseInt(parts[1]);

            if (dose.taken) {
                taken++;
            } else if (currentMinutes > doseMinutes + 30) {
                missed++;
            } else {
                pending++;
            }
        });
    });

    document.getElementById("totalMedicines").innerText = total;
    document.getElementById("takenMedicines").innerText = taken;
    document.getElementById("pendingMedicines").innerText = pending;
    document.getElementById("missedMedicines").innerText = missed;
    document.getElementById("dailyMedicines").innerText = daily;

    const totalDoses = taken + pending + missed;
    const percentage = totalDoses === 0 ? 0 : Math.round((taken / totalDoses) * 100);

    document.getElementById("todayProgressFill").style.width = percentage + "%";
    document.getElementById("todayProgressText").innerText = percentage + "% completed";
}

function updateUpcomingDose() {
    const medicines = JSON.parse(localStorage.getItem("medicines")) || [];
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let upcoming = null;

    medicines.forEach(medicine => {
        medicine.times.forEach(dose => {
            if (!dose.taken) {
                const parts = dose.time.split(":");
                const mins = parseInt(parts[0]) * 60 + parseInt(parts[1]);

                if (mins >= currentMinutes) {
                    if (!upcoming || mins < upcoming.mins) {
                        upcoming = {
                            name: medicine.name,
                            time: dose.time,
                            category: medicine.category,
                            mins: mins
                        };
                    }
                }
            }
        });
    });

    const box = document.getElementById("upcomingDose");

    if (upcoming) {
        box.innerHTML = `
            Next Dose: <b>${upcoming.name}</b><br>
            ${upcoming.category} at ${formatTime(upcoming.time)}
        `;
    } else {
        box.innerHTML = "No upcoming dose for today 🎉";
    }
}

function saveHistory(name, time, status) {
    let history = JSON.parse(localStorage.getItem("medicineHistory")) || [];
    const today = new Date().toDateString();

    let day = history.find(item => item.date === today);

    const exists = day && day.logs.some(log =>
        log.medicine === name &&
        log.time === time &&
        log.status === status
    );

    if (exists) {
        return;
    }

    const entry = {
        medicine: name,
        time: time,
        status: status
    };

    if (day) {
        day.logs.push(entry);
    } else {
        history.push({
            date: today,
            logs: [entry]
        });
    }

    localStorage.setItem("medicineHistory", JSON.stringify(history));
}

function loadHistory() {
    const historyList = document.getElementById("historyList");
    const history = JSON.parse(localStorage.getItem("medicineHistory")) || [];

    historyList.innerHTML = "";

    if (history.length === 0) {
        historyList.innerHTML = `
            <div class="history-card empty-state">
                <p>No history found yet.</p>
            </div>
        `;
        return;
    }

    history.slice().reverse().forEach(day => {
        let logs = "";

        day.logs.forEach(log => {
            logs += `
                <div class="history-item">
                    ${log.status} ${log.medicine} - ${formatTime(log.time)}
                </div>
            `;
        });

        historyList.innerHTML += `
            <div class="history-card">
                <div class="history-date">${day.date}</div>
                ${logs}
            </div>
        `;
    });
}

function drawWeeklyChart() {
    const canvas = document.getElementById("weeklyChart");

    if (!canvas) {
        return;
    }

    const ctx = canvas.getContext("2d");
    const history = JSON.parse(localStorage.getItem("medicineHistory")) || [];

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const labels = [];
    const takenData = [];
    const missedData = [];

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);

        const dateStr = d.toDateString();

        labels.push(
            d.toLocaleDateString("en-US", {
                weekday: "short"
            })
        );

        const day = history.find(h => h.date === dateStr);

        let taken = 0;
        let missed = 0;

        if (day) {
            day.logs.forEach(log => {
                if (log.status === "✅") {
                    taken++;
                }

                if (log.status === "❌") {
                    missed++;
                }
            });
        }

        takenData.push(taken);
        missedData.push(missed);
    }

    const maxVal = Math.max(...takenData, ...missedData, 1);
    const barWidth = 25;
    const gap = 55;
    const baseY = 180;

    ctx.font = "12px Poppins";

    labels.forEach((label, i) => {
        const x = 35 + i * gap;

        const takenHeight = (takenData[i] / maxVal) * 120;
        const missedHeight = (missedData[i] / maxVal) * 120;

        ctx.fillStyle = "#22c55e";
        ctx.fillRect(x, baseY - takenHeight, barWidth, takenHeight);

        ctx.fillStyle = "#ef4444";
        ctx.fillRect(x + barWidth + 5, baseY - missedHeight, barWidth, missedHeight);

        ctx.fillStyle = "#6b7280";
        ctx.fillText(label, x, 205);
    });

    ctx.fillStyle = "#22c55e";
    ctx.fillRect(420, 20, 15, 15);

    ctx.fillStyle = "#6b7280";
    ctx.fillText("Taken", 440, 32);

    ctx.fillStyle = "#ef4444";
    ctx.fillRect(500, 20, 15, 15);

    ctx.fillStyle = "#6b7280";
    ctx.fillText("Missed", 520, 32);
}

function showNotification(title, body) {
    if (!("Notification" in window)) {
        return;
    }

    if (Notification.permission === "granted") {
        new Notification(title, {
            body: body
        });
    }
}

function speakMedicine(name) {
    if ("speechSynthesis" in window) {
        speechSynthesis.cancel();

        const message = new SpeechSynthesisUtterance(
            "Take your medicine " + name
        );

        speechSynthesis.speak(message);
    }
}

function snooze(medicineName, time) {
    const medicines = JSON.parse(localStorage.getItem("medicines")) || [];

    for (let medicine of medicines) {
        if (medicine.name === medicineName) {
            for (let dose of medicine.times) {
                if (dose.time === time) {
                    if (dose.taken) {
                        alert("✅ This medicine is already taken.");
                        return;
                    }

                    const key = medicineName + "_" + time;

                    snoozeMap[key] = Date.now() + 2 * 60 * 1000;

                    showNotification(
                        "😴 Snoozed",
                        medicineName + " will remind again in 2 minutes"
                    );

                    alert(medicineName + " reminder snoozed for 2 minutes");
                    return;
                }
            }
        }
    }
}

function checkReminders() {
    const now = new Date();

    const currentTime =
        now.getHours().toString().padStart(2, "0") +
        ":" +
        now.getMinutes().toString().padStart(2, "0");

    let medicines = JSON.parse(localStorage.getItem("medicines")) || [];
    let changed = false;

    medicines.forEach(medicine => {
        medicine.times.forEach(dose => {
            const key = medicine.name + "_" + dose.time;
            const snoozedUntil = snoozeMap[key];

            if (
                currentTime === dose.time &&
                !dose.taken &&
                !dose.notified &&
                !snoozedUntil
            ) {
                showNotification(
                    "💊 Medicine Reminder",
                    "Take " + medicine.name
                );

                speakMedicine(medicine.name);

                dose.notified = true;
                changed = true;
            }

            if (
                snoozedUntil &&
                Date.now() >= snoozedUntil &&
                !dose.taken
            ) {
                showNotification(
                    "💊 Snooze Reminder",
                    "Take " + medicine.name
                );

                speakMedicine(medicine.name);

                delete snoozeMap[key];
            }

            if (currentTime !== dose.time) {
                dose.notified = false;
            }
        });
    });

    if (changed) {
        localStorage.setItem("medicines", JSON.stringify(medicines));
    }

    updateStatistics();
    updateUpcomingDose();
}

setInterval(checkReminders, 1000);

function generateCaregiverCode() {
    let code = localStorage.getItem("caregiverCode");

    if (!code) {
        code = "CG-" + Math.random().toString(36).substring(2, 10).toUpperCase();
        localStorage.setItem("caregiverCode", code);
    }

    return code;
}

function showCaregiverCode() {
    document.getElementById("myCaregiverCode").innerText = generateCaregiverCode();
}

function linkCaregiver() {
    const input = document.getElementById("caregiverInput").value.trim();
    const name = document.getElementById("caregiverName").value.trim();
    const phone = document.getElementById("caregiverPhone").value.trim();
    const email = document.getElementById("caregiverEmail").value.trim();

    if (!input.startsWith("CG-")) {
        alert("Invalid caregiver code");
        return;
    }

    localStorage.setItem("linkedCaregiver", input);
    localStorage.setItem("caregiverName", name);
    localStorage.setItem("caregiverPhone", phone);
    localStorage.setItem("caregiverEmail", email);

    syncToCaregiver();

    alert("Caregiver saved successfully");
}

function loadCaregiverInfo() {
    document.getElementById("caregiverName").value =
        localStorage.getItem("caregiverName") || "";

    document.getElementById("caregiverPhone").value =
        localStorage.getItem("caregiverPhone") || "";

    document.getElementById("caregiverEmail").value =
        localStorage.getItem("caregiverEmail") || "";
}

function getLinkedCaregiver() {
    return localStorage.getItem("linkedCaregiver");
}

function getCaregiverViewData() {
    const medicines = JSON.parse(localStorage.getItem("medicines")) || [];

    return medicines.map(medicine => ({
        name: medicine.name,
        category: medicine.category,
        repeatDaily: medicine.repeatDaily,
        times: medicine.times.map(dose => ({
            time: dose.time,
            taken: dose.taken,
            missed: dose.missedLogged
        }))
    }));
}

function syncToCaregiver() {
    const caregiver = getLinkedCaregiver();

    if (!caregiver) {
        return;
    }

    localStorage.setItem(
        "caregiverData_" + caregiver,
        JSON.stringify(getCaregiverViewData())
    );
}

function loadCaregiverDashboard() {
    const code = getLinkedCaregiver();
    const box = document.getElementById("caregiverDashboard");

    if (!code) {
        alert("No caregiver linked");
        return;
    }

    const data = JSON.parse(localStorage.getItem("caregiverData_" + code)) || [];

    if (data.length === 0) {
        box.innerHTML = `
            <div class="empty-state">
                No caregiver data found.
            </div>
        `;
        return;
    }

    let html = `
        <table class="caregiver-table">
            <tr>
                <th>Medicine</th>
                <th>Category</th>
                <th>Time</th>
                <th>Status</th>
            </tr>
    `;

    data.forEach(medicine => {
        medicine.times.forEach(dose => {
            let status = "Pending";

            if (dose.taken) {
                status = "Taken";
            } else if (dose.missed) {
                status = "Missed";
            }

            html += `
                <tr>
                    <td>${medicine.name}</td>
                    <td>${medicine.category}</td>
                    <td>${formatTime(dose.time)}</td>
                    <td>${status}</td>
                </tr>
            `;
        });
    });

    html += `</table>`;

    box.innerHTML = html;
}

function downloadCSV() {
    const history = JSON.parse(localStorage.getItem("medicineHistory")) || [];
    let csv = "Date,Medicine,Time,Status\n";

    history.forEach(day => {
        day.logs.forEach(log => {
            csv += `${day.date},${log.medicine},${log.time},${log.status}\n`;
        });
    });

    const blob = new Blob([csv], {
        type: "text/csv"
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "medicine-history.csv";
    link.click();
}

function downloadPDF() {
    const history = JSON.parse(localStorage.getItem("medicineHistory")) || [];
    let content = "MediCare Medicine History\n\n";

    history.forEach(day => {
        content += day.date + "\n";

        day.logs.forEach(log => {
            content += `${log.status} ${log.medicine} - ${formatTime(log.time)}\n`;
        });

        content += "\n";
    });

    const win = window.open("", "", "width=800,height=600");

    win.document.write(`<pre>${content}</pre>`);
    win.document.close();
    win.print();
}

function toggleTheme() {
    document.body.classList.toggle("dark-mode");

    const button = document.getElementById("themeToggle");

    if (document.body.classList.contains("dark-mode")) {
        button.innerText = "☀ Light Mode";
        localStorage.setItem("theme", "dark");
    } else {
        button.innerText = "🌙 Dark Mode";
        localStorage.setItem("theme", "light");
    }
}

function loadTheme() {
    if (localStorage.getItem("theme") === "dark") {
        document.body.classList.add("dark-mode");
        document.getElementById("themeToggle").innerText = "☀ Light Mode";
    }
}

function clearAllData() {
    if (!confirm("Are you sure you want to clear all app data?")) {
        return;
    }

    localStorage.clear();
    location.reload();
}

function formatTime(time) {
    const parts = time.split(":");
    const h = parts[0];
    const m = parts[1];

    const date = new Date();
    date.setHours(h);
    date.setMinutes(m);

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function refreshAll() {
    loadMedicines();
    loadHistory();
    updateStatistics();
    updateUpcomingDose();
    drawWeeklyChart();
    syncToCaregiver();
}