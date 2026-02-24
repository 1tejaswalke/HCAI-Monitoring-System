
// ============================================
// Advanced Automotive DMS Engine v3
// Developed by Tejas Walke
// ============================================

let model;
let frameCount = 0;
let closedEyeFrames = 0;
let earHistory = [];
const SMOOTHING_WINDOW = 10;
const EAR_THRESHOLD = 0.25;

const video = document.getElementById("video");
const earDisplay = document.getElementById("earValue");
const statusDisplay = document.getElementById("status");
const headDisplay = document.getElementById("headPose");
const fatigueDisplay = document.getElementById("fatigueScore");

const gaugeCanvas = document.getElementById("fatigueGauge");
const gaugeCtx = gaugeCanvas.getContext("2d");

// Audio Alert
const alertSound = new Audio("https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg");

// ===============================
// Camera Setup
// ===============================
async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    return new Promise(resolve => {
        video.onloadedmetadata = () => resolve(video);
    });
}

// ===============================
// Load FaceMesh Model
// ===============================
async function loadModel() {
    await tf.setBackend("webgl");
    model = await faceLandmarksDetection.createDetector(
        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
        {
            runtime: "tfjs",
            refineLandmarks: true,
            maxFaces: 1
        }
    );
}

// ===============================
// EAR Calculation
// ===============================
function calculateEAR(landmarks) {
    const dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
    const A = dist(landmarks[160], landmarks[144]);
    const B = dist(landmarks[158], landmarks[153]);
    const C = dist(landmarks[33], landmarks[133]);
    return (A+B)/(2*C);
}

// ===============================
// Head Pose Estimation
// ===============================
function estimateHeadPose(landmarks) {
    const left = landmarks[33];
    const right = landmarks[263];
    const nose = landmarks[1];
    const midX = (left.x + right.x) / 2;
    const offset = nose.x - midX;

    if (offset > 20) return "RIGHT";
    if (offset < -20) return "LEFT";
    return "CENTER";
}

// ===============================
// Temporal Smoothing
// ===============================
function smoothEAR(ear) {
    earHistory.push(ear);
    if (earHistory.length > SMOOTHING_WINDOW) {
        earHistory.shift();
    }
    const avg = earHistory.reduce((a,b)=>a+b,0) / earHistory.length;
    return avg;
}

// ===============================
// PERCLOS Calculation
// ===============================
function calculatePERCLOS() {
    return (closedEyeFrames / frameCount) * 100;
}

// ===============================
// Fatigue Score (0-100)
// ===============================
function calculateFatigueScore(perclos) {
    let score = Math.min(100, perclos * 1.2);
    return Math.round(score);
}

// ===============================
// Automotive Gauge Meter
// ===============================
function drawGauge(score) {

    const ctx = gaugeCtx;
    const centerX = gaugeCanvas.width / 2;
    const centerY = gaugeCanvas.height / 2;
    const radius = 80;

    ctx.clearRect(0,0,gaugeCanvas.width,gaugeCanvas.height);

    // Background arc
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, 2*Math.PI);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 15;
    ctx.stroke();

    // Value arc
    const endAngle = Math.PI + (score/100)*Math.PI;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, endAngle);
    ctx.strokeStyle = score > 70 ? "#ff0033" : score > 40 ? "#ffaa00" : "#00ff88";
    ctx.lineWidth = 15;
    ctx.stroke();

    // Text
    ctx.fillStyle = "#ffffff";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.fillText(score + "%", centerX, centerY + 10);
}

// ===============================
// Detection Loop
// ===============================
async function detect() {

    const predictions = await model.estimateFaces(video);

    if (predictions.length > 0) {

        const landmarks = predictions[0].keypoints.map(p => ({x:p.x, y:p.y}));

        let ear = calculateEAR(landmarks);
        ear = smoothEAR(ear);

        const headPose = estimateHeadPose(landmarks);

        frameCount++;
        if (ear < EAR_THRESHOLD) {
            closedEyeFrames++;
        }

        const perclos = calculatePERCLOS();
        const fatigueScore = calculateFatigueScore(perclos);

        earDisplay.innerText = ear.toFixed(2);
        headDisplay.innerText = headPose;
        fatigueDisplay.innerText = fatigueScore;

        drawGauge(fatigueScore);

        if (fatigueScore > 70) {
            statusDisplay.innerText = "HIGH FATIGUE";
            statusDisplay.className = "status drowsy";
            alertSound.play();
        } else if (fatigueScore > 40) {
            statusDisplay.innerText = "MODERATE FATIGUE";
            statusDisplay.className = "status warning";
        } else {
            statusDisplay.innerText = "SAFE";
            statusDisplay.className = "status safe";
        }

        console.log("Frame:", frameCount,
                    "| EAR:", ear.toFixed(3),
                    "| PERCLOS:", perclos.toFixed(2),
                    "| Fatigue:", fatigueScore);
    }

    requestAnimationFrame(detect);
}

// ===============================
// Initialize System
// ===============================
async function initDMS() {
    await setupCamera();
    await loadModel();
    detect();
}

initDMS();
