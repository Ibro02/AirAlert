// Firebase Configuration
const firebaseConfig = {
	apiKey: "AIzaSyC2NZ1SOxCe7M6IqqCfySd8c9M0id19Xw8",
	authDomain: "hrus-8fa7f.firebaseapp.com",
	databaseURL:
		"https://hrus-8fa7f-default-rtdb.europe-west1.firebasedatabase.app",
	projectId: "hrus-8fa7f",
	storageBucket: "hrus-8fa7f.firebasestorage.app",
	messagingSenderId: "354760794895",
	appId: "1:354760794895:web:5919ccc8dca46def75d47a",
	measurementId: "G-8KXFLGNMP9",
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Chart Configuration
let coChart;
const chartData = {
	labels: [],
	values: [],
};

const MAX_DATA_POINTS = 30;
let dangerThreshold = 10; // Default threshold

// Sound Alert Functions
function initAlarmSound() {
	// Create an oscillator-based alarm sound (no external files needed)
	const audioContext = new (window.AudioContext || window.webkitAudioContext)();

	return {
		play: function () {
			if (!soundAlertEnabled) return;

			const oscillator = audioContext.createOscillator();
			const gainNode = audioContext.createGain();

			oscillator.connect(gainNode);
			gainNode.connect(audioContext.destination);

			// Alarm sound configuration
			oscillator.frequency.value = 800; // Hz
			oscillator.type = "sine";

			// Fade in and out
			gainNode.gain.setValueAtTime(0, audioContext.currentTime);
			gainNode.gain.linearRampToValueAtTime(
				0.3,
				audioContext.currentTime + 0.1
			);
			gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);

			oscillator.start(audioContext.currentTime);
			oscillator.stop(audioContext.currentTime + 0.5);

			// Repeat pattern
			setTimeout(() => {
				if (soundAlertEnabled && lastAlarmState) {
					this.play();
				}
			}, 1000);
		},
		stop: function () {
			// The oscillators stop themselves, we just prevent new ones
			lastAlarmState = false;
		},
	};
}

// Email Notification Function
async function sendEmailNotification(type, concentration) {
	if (!emailAlertEnabled || !userEmail) {
		console.log("Email notifications disabled or no email set");
		return;
	}

	const emailData = {
		to: userEmail,
		subject:
			type === "alarm"
				? "🚨 ALARM - Opasna razina CO!"
				: "✅ CO razina normalna",
		message:
			type === "alarm"
				? `UPOZORENJE!\n\nKoncentracija ugljen monoksida je dostigla opasnu razinu: ${concentration.toFixed(
						2
				  )} mg/m³\n\nPreporučujemo hitno provjetravanje prostorije!\n\nVrijeme: ${new Date().toLocaleString(
						"bs-BA"
				  )}`
				: `Obavještenje\n\nKoncentracija ugljen monoksida se vratila u normalu: ${concentration.toFixed(
						2
				  )} mg/m³\n\nVrijeme: ${new Date().toLocaleString("bs-BA")}`,
		userName: userName || "Korisnik",
		timestamp: new Date().toISOString(),
		concentration: concentration,
	};

	try {
		// Save to Firebase for email service to pick up
		await database.ref("emailQueue").push(emailData);
		console.log("Email notification queued:", type);
		addActivityLog(
			"success",
			`Email notifikacija poslana na ${userEmail}`,
			new Date().toLocaleString("bs-BA")
		);
	} catch (error) {
		console.error("Error sending email notification:", error);
		addActivityLog(
			"warning",
			"Greška pri slanju email notifikacije",
			new Date().toLocaleString("bs-BA")
		);
	}
}

// Initialize Chart
function initializeChart() {
	const ctx = document.getElementById("myChart").getContext("2d");

	coChart = new Chart(ctx, {
		type: "line",
		data: {
			labels: chartData.labels,
			datasets: [
				{
					label: "CO Koncentracija",
					data: chartData.values,
					borderColor: "#8b5cf6",
					backgroundColor: (context) => {
						const ctx = context.chart.ctx;
						const gradient = ctx.createLinearGradient(0, 0, 0, 400);
						gradient.addColorStop(0, "rgba(139, 92, 246, 0.3)");
						gradient.addColorStop(1, "rgba(139, 92, 246, 0.0)");
						return gradient;
					},
					borderWidth: 3,
					fill: true,
					tension: 0.4,
					pointRadius: 4,
					pointHoverRadius: 6,
					pointBackgroundColor: "#8b5cf6",
					pointBorderColor: "#fff",
					pointBorderWidth: 2,
					pointHoverBackgroundColor: "#8b5cf6",
					pointHoverBorderColor: "#fff",
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			interaction: {
				intersect: false,
				mode: "index",
			},
			plugins: {
				legend: {
					display: false,
				},
				tooltip: {
					backgroundColor: "rgba(26, 26, 46, 0.95)",
					titleColor: "#fff",
					bodyColor: "rgba(255, 255, 255, 0.7)",
					borderColor: "rgba(255, 255, 255, 0.1)",
					borderWidth: 1,
					padding: 12,
					cornerRadius: 8,
					displayColors: false,
					callbacks: {
						label: function (context) {
							return `${context.parsed.y.toFixed(2)} mg/m³`;
						},
					},
				},
			},
			scales: {
				x: {
					grid: {
						color: "rgba(255, 255, 255, 0.05)",
						drawBorder: false,
					},
					ticks: {
						color: "rgba(255, 255, 255, 0.5)",
						font: {
							family: "Inter",
							size: 11,
						},
					},
				},
				y: {
					grid: {
						color: "rgba(255, 255, 255, 0.05)",
						drawBorder: false,
					},
					ticks: {
						color: "rgba(255, 255, 255, 0.5)",
						font: {
							family: "Inter",
							size: 11,
						},
						callback: function (value) {
							return value + " mg/m³";
						},
					},
					beginAtZero: true,
				},
			},
		},
	});
}

// Update Chart Data
function updateChartData(value) {
	const now = new Date();
	const timeLabel = now.toLocaleTimeString("bs-BA", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});

	chartData.labels.push(timeLabel);
	chartData.values.push(value);

	// Keep only last MAX_DATA_POINTS
	if (chartData.labels.length > MAX_DATA_POINTS) {
		chartData.labels.shift();
		chartData.values.shift();
	}

	coChart.update("none"); // Update without animation for real-time feel
}

// Update Main Display
function updateDisplay(value) {
	const displayElement = document.getElementById("gasConcentrationMgPerM3");
	const statusBadge = document.getElementById("statusBadge");
	const alertBanner = document.getElementById("alertBanner");

	// Animate value change
	animateValue(
		displayElement,
		parseFloat(displayElement.textContent) || 0,
		value,
		500
	);

	// Update status badge
	if (value >= dangerThreshold) {
		statusBadge.className = "status-badge status-danger";
		statusBadge.innerHTML = '<span class="status-dot"></span>Opasno';
		alertBanner.classList.add("show");
	} else if (value >= dangerThreshold * 0.8) {
		statusBadge.className = "status-badge status-warning";
		statusBadge.innerHTML = '<span class="status-dot"></span>Upozorenje';
		alertBanner.classList.remove("show");
	} else {
		statusBadge.className = "status-badge status-normal";
		statusBadge.innerHTML = '<span class="status-dot"></span>Normalno';
		alertBanner.classList.remove("show");
	}
}

// Animate number changes
function animateValue(element, start, end, duration) {
	const range = end - start;
	const increment = range / (duration / 16);
	let current = start;

	const timer = setInterval(() => {
		current += increment;
		if (
			(increment > 0 && current >= end) ||
			(increment < 0 && current <= end)
		) {
			current = end;
			clearInterval(timer);
		}
		element.textContent = current.toFixed(2);
	}, 16);
}

// Calculate Statistics
function calculateStats() {
	if (chartData.values.length === 0) return;

	const values = chartData.values;
	const avg = values.reduce((a, b) => a + b, 0) / values.length;
	const min = Math.min(...values);
	const max = Math.max(...values);

	document.getElementById("avg24h").textContent = avg.toFixed(2);
	document.getElementById("min24h").textContent = min.toFixed(2);
	document.getElementById("max24h").textContent = max.toFixed(2);
}

// Update Email Status Display
function updateEmailStatus() {
	const statusElement = document.getElementById("emailStatus");
	if (emailAlertEnabled && userEmail) {
		statusElement.className = "email-status";
		statusElement.innerHTML =
			'<i class="fas fa-check-circle"></i><span>Email notifikacije su aktivne</span>';
	} else {
		statusElement.className = "email-status inactive";
		statusElement.innerHTML =
			'<i class="fas fa-times-circle"></i><span>Email notifikacije nisu aktivne</span>';
	}
}

// Add Activity Log Entry
function addActivityLog(type, message, time) {
	const activityList = document.getElementById("activityList");

	const activityItem = document.createElement("div");
	activityItem.className = "activity-item";
	activityItem.style.animation = "slideDown 0.3s ease";

	let iconClass = "success";
	let icon = "fa-check-circle";

	if (type === "warning") {
		iconClass = "warning";
		icon = "fa-exclamation-triangle";
	} else if (type === "danger") {
		iconClass = "danger";
		icon = "fa-triangle-exclamation";
	}

	activityItem.innerHTML = `
        <div class="activity-icon ${iconClass}">
            <i class="fas ${icon}"></i>
        </div>
        <div class="activity-info">
            <h4>${message}</h4>
            <p>${time}</p>
        </div>
        <div class="activity-time">Sada</div>
    `;

	activityList.insertBefore(activityItem, activityList.firstChild);

	// Keep only last 5 activities
	while (activityList.children.length > 5) {
		activityList.removeChild(activityList.lastChild);
	}
}

// Popup Controls
function setupPopups() {
	const popup = document.getElementById("popup");
	const popup2 = document.getElementById("popup2");
	const profilePopup = document.getElementById("profilePopup");

	const openPopupBtn = document.getElementById("openPopupBtn");
	const closePopupBtn = document.getElementById("closePopupBtn");
	const cancelBtn = document.getElementById("cancelBtn");
	const saveButton = document.getElementById("saveButton");
	const turnOffAlarmBtn = document.getElementById("turnOffAlarm");

	const userProfileBtn = document.getElementById("userProfileBtn");
	const closeProfilePopupBtn = document.getElementById("closeProfilePopupBtn");
	const cancelProfileBtn = document.getElementById("cancelProfileBtn");
	const saveProfileButton = document.getElementById("saveProfileButton");

	const popupOverlay = document.getElementById("popupOverlay");
	const popup2Overlay = document.getElementById("popup2Overlay");
	const profilePopupOverlay = document.getElementById("profilePopupOverlay");

	const closeAlertBanner = document.getElementById("closeAlertBanner");
	const alertBanner = document.getElementById("alertBanner");

	const soundAlertToggle = document.getElementById("soundAlertToggle");
	const emailAlertToggle = document.getElementById("emailAlertToggle");

	// Settings popup
	openPopupBtn.addEventListener("click", () => {
		popup.classList.add("show");
		document.getElementById("maxCO").value = dangerThreshold;
	});

	closePopupBtn.addEventListener("click", () => {
		popup.classList.remove("show");
	});

	cancelBtn.addEventListener("click", () => {
		popup.classList.remove("show");
	});

	popupOverlay.addEventListener("click", () => {
		popup.classList.remove("show");
	});

	saveButton.addEventListener("click", () => {
		const newThreshold = parseFloat(document.getElementById("maxCO").value);
		if (!isNaN(newThreshold) && newThreshold > 0) {
			// Save to Firebase
			database.ref("maxCO").set(newThreshold);

			// Save notification preferences
			database.ref("soundAlertEnabled").set(soundAlertToggle.checked);
			database.ref("emailAlertEnabled").set(emailAlertToggle.checked);

			popup.classList.remove("show");
			addActivityLog(
				"success",
				`Postavke sačuvane - Prag: ${newThreshold} mg/m³`,
				new Date().toLocaleString("bs-BA")
			);
		}
	});

	// Profile popup
	// userProfileBtn.addEventListener("click", () => {
	// 	profilePopup.classList.add("show");
	// });

	closeProfilePopupBtn.addEventListener("click", () => {
		profilePopup.classList.remove("show");
	});

	cancelProfileBtn.addEventListener("click", () => {
		profilePopup.classList.remove("show");
	});

	profilePopupOverlay.addEventListener("click", () => {
		profilePopup.classList.remove("show");
	});

	saveProfileButton.addEventListener("click", () => {
		const email = document.getElementById("userEmail").value;
		const name = document.getElementById("userName").value;

		if (email && !validateEmail(email)) {
			alert("Molimo unesite validnu email adresu");
			return;
		}

		// Save to Firebase
		database.ref("userEmail").set(email);
		database.ref("userName").set(name);

		profilePopup.classList.remove("show");
		addActivityLog(
			"success",
			`Profil ažuriran${email ? ` - Email: ${email}` : ""}`,
			new Date().toLocaleString("bs-BA")
		);
	});

	// Alert popup
	turnOffAlarmBtn.addEventListener("click", () => {
		// Set turnOffAlarm flag in Firebase
		database.ref("turnOffAlarm").set(!turnOffAlarm);
		popup2.classList.remove("show");

		// Stop sound
		if (alarmSound) {
			alarmSound.stop();
		}
		lastAlarmState = false;

		addActivityLog(
			"success",
			"Alarm isključen - prostorija se provjetrava",
			new Date().toLocaleString("bs-BA")
		);
	});

	popup2Overlay.addEventListener("click", () => {
		popup2.classList.remove("show");
	});

	// Close alert banner
	if (closeAlertBanner) {
		closeAlertBanner.addEventListener("click", () => {
			alertBanner.classList.remove("show");
		});
	}
}

// Validate Email
function validateEmail(email) {
	const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return re.test(email);
}

// Firebase Variables
let gasConcentrationMgPerM3;
let maxCO;
let turnOffAlarm = false;
let userEmail = "";
let userName = "";
let soundAlertEnabled = true;
let emailAlertEnabled = true;
let lastAlarmState = false; // Track if we've already sent an alert
let alarmSound = null;

// Firebase References
const _gasConcentrationMgPerM3 = database.ref("gasConcentrationMgPerM3");
const _maxCO = database.ref("maxCO");
const _turnOffAlarm = database.ref("turnOffAlarm");
const _userEmail = database.ref("userEmail");
const _userName = database.ref("userName");
const _soundAlertEnabled = database.ref("soundAlertEnabled");
const _emailAlertEnabled = database.ref("emailAlertEnabled");

// Listen for alarm state changes
_turnOffAlarm.on("value", (snapshot) => {
	turnOffAlarm = snapshot.val();
});

// Listen for user email changes
_userEmail.on("value", (snapshot) => {
	userEmail = snapshot.val() || "";
	document.getElementById("userEmail").value = userEmail;
	updateEmailStatus();
});

// Listen for user name changes
_userName.on("value", (snapshot) => {
	userName = snapshot.val() || "";
	document.getElementById("userName").value = userName;
});

// Listen for sound alert toggle
_soundAlertEnabled.on("value", (snapshot) => {
	soundAlertEnabled = snapshot.val() !== false; // Default to true
	document.getElementById("soundAlertToggle").checked = soundAlertEnabled;
});

// Listen for email alert toggle
_emailAlertEnabled.on("value", (snapshot) => {
	emailAlertEnabled = snapshot.val() !== false; // Default to true
	document.getElementById("emailAlertToggle").checked = emailAlertEnabled;
	updateEmailStatus();
});

// Listen for max CO threshold changes
_maxCO.on("value", (snapshot) => {
	maxCO = snapshot.val();
	dangerThreshold = parseFloat(maxCO);
	document.getElementById("maxCO").value = maxCO;

	// Re-evaluate current reading with new threshold
	if (gasConcentrationMgPerM3 !== undefined) {
		updateDisplay(gasConcentrationMgPerM3);
	}
});

// Listen for gas concentration changes (main data listener)
_gasConcentrationMgPerM3.on("value", (snapshot) => {
	gasConcentrationMgPerM3 = parseFloat(snapshot.val());

	// Update display and chart
	updateDisplay(gasConcentrationMgPerM3);
	updateChartData(gasConcentrationMgPerM3);
	calculateStats();

	// Handle alarm logic
	const maxCOValue = parseFloat(maxCO);
	const isAlarmCondition = gasConcentrationMgPerM3 > maxCOValue;

	if (isAlarmCondition && !turnOffAlarm) {
		// Alarm state - trigger all alerts
		if (!lastAlarmState) {
			// First time entering alarm state
			lastAlarmState = true;

			// Play sound
			if (!alarmSound) {
				alarmSound = initAlarmSound();
			}
			alarmSound.play();

			// Send email notification
			sendEmailNotification("alarm", gasConcentrationMgPerM3);
		}

		// Show alarm popup
		setTimeout(() => {
			document.getElementById("popup2").classList.add("show");
			addActivityLog(
				"danger",
				`ALARM! Koncentracija: ${gasConcentrationMgPerM3.toFixed(2)} mg/m³`,
				new Date().toLocaleString("bs-BA")
			);
		}, 300);
	} else if (isAlarmCondition && turnOffAlarm) {
		// Warning state - alarm turned off manually
		document.getElementById("alertBanner").classList.add("show");

		// Stop sound if playing
		if (alarmSound) {
			alarmSound.stop();
		}
	} else {
		// Normal state
		if (lastAlarmState) {
			// Just returned to normal - send recovery email
			sendEmailNotification("normal", gasConcentrationMgPerM3);
			addActivityLog(
				"success",
				"Koncentracija CO se vratila u normalu",
				new Date().toLocaleString("bs-BA")
			);
		}

		lastAlarmState = false;

		// Stop sound
		if (alarmSound) {
			alarmSound.stop();
		}

		// Reset alarm flag if it was set
		if (turnOffAlarm) {
			database.ref("turnOffAlarm").set(false);
		}

		document.getElementById("popup2").classList.remove("show");
	}
});

// Time selector functionality
function setupTimeSelector() {
	const timeBtns = document.querySelectorAll(".time-btn");
	timeBtns.forEach((btn) => {
		btn.addEventListener("click", () => {
			timeBtns.forEach((b) => b.classList.remove("active"));
			btn.classList.add("active");
			// Add logic to filter chart data based on selected time range
		});
	});
}

// var test = document.getElementById("test");
// var testValue = false;
// test.addEventListener("click", () => {
// 	database.ref("test").set(!testValue);
// 	testValue = !testValue;
// });

// Initialize everything
document.addEventListener("DOMContentLoaded", () => {
	initializeChart();
	setupPopups();
	setupTimeSelector();

	// Add initial activity log
	addActivityLog(
		"success",
		"Sistem pokrenut",
		new Date().toLocaleString("bs-BA")
	);

	// Initialize email status display
	updateEmailStatus();

	// Firebase listeners are already set up above and will handle real-time updates
});

// Export functions if needed
if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		updateDisplay,
		updateChartData,
		calculateStats,
		addActivityLog,
	};
}
