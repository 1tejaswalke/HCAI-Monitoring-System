
// ===============================
// Advanced Human-Centered DMS JS
// Developed by Tejas Walke
// ===============================

let model;
let earData = [];
let labels = [];
let frameCount = 0;

const video = document.getElementById("video");
const earDisplay = document.getElementById("earValue");
const statusDisplay = document.getElementById("status");
const headDisplay = document.getElementById("headPose");

const ctx = document.getElementById("earChart").getContext("2d");

const chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: labels,
        datasets: [{
            label: 'EAR Trend',
            data: earData,
            borderColor: '#00f2ff',
            borderWidth: 2,
            fill: false,
            tension: 0.3
        }]
    },
    options: {
        animation: false,
        scales: {
            y: { min: 0, max: 0.5 }
        },
        plugins: { legend: { display: false } }
    }
});

// ===============================
// Camera Setup
// ===============================
async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
}

// ===============================
// Load FaceMesh Model (Updated API)
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
// Graph Update
// ===============================
function updateGraph(ear) {
    if (earData.length > 50) {
        earData.shift();
        labels.shift();
    }

    earData.push(ear);
    labels.push("");
    chart.update();
}

// ===============================
// Fatigue Classification Logic
// ===============================
function classifyFatigue(ear, headPose) {

    const EAR_THRESHOLD = 0.25;

    if (ear < EAR_THRESHOLD) {
        return "DROWSY";
    }

    if (headPose !== "CENTER") {
        return "DISTRACTED";
    }

    return "SAFE";
}

// ===============================
// Frame-by-Frame Analysis Loop
// ===============================
async function detect() {

    const predictions = await model.estimateFaces(video);

    if (predictions.length > 0) {

        const landmarks = predictions[0].keypoints.map(p => ({x: p.x, y: p.y}));

        const ear = calculateEAR(landmarks);
        const headPose = estimateHeadPose(landmarks);
        const state = classifyFatigue(ear, headPose);

        frameCount++;

        earDisplay.innerText = ear.toFixed(2);
        headDisplay.innerText = headPose;

        updateGraph(ear);

        if (state === "DROWSY") {
            statusDisplay.innerText = "DROWSY";
            statusDisplay.className = "status drowsy";
        } 
        else if (state === "DISTRACTED") {
            statusDisplay.innerText = "DISTRACTED";
            statusDisplay.className = "status warning";
        } 
        else {
            statusDisplay.innerText = "SAFE";
            statusDisplay.className = "status safe";
        }

        // Frame-by-frame behavioral logging
        console.log("Frame:", frameCount,
                    "| EAR:", ear.toFixed(3),
                    "| Head:", headPose,
                    "| State:", state);
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
