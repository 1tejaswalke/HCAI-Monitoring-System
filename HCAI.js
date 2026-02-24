
// ======================================================
// HCAI - Human-Centered AI Driver Monitoring Engine
// Frontend-Only Version (GitHub Pages Ready)
// ======================================================

let model;
let frameCount = 0;
let closedFrames = 0;
let earBuffer = [];

const EAR_THRESHOLD = 0.25;
const SMOOTH_WINDOW = 5;

const video = document.getElementById("video");
const earText = document.getElementById("earValue");
const headText = document.getElementById("headPose");
const fatigueText = document.getElementById("fatigueScore");
const statusText = document.getElementById("status");

const alertSound = new Audio("https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg");

// ================= CAMERA =================
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: false
        });

        video.srcObject = stream;

        await new Promise(resolve => {
            video.onloadedmetadata = () => {
                video.play();
                resolve();
            };
        });

        console.log("Camera started");

    } catch (err) {
        console.error("Camera Error:", err);
        alert("Camera access failed. Use HTTPS.");
    }
}

// ================= LOAD MODEL =================
async function loadFaceModel() {
    model = await faceLandmarksDetection.load(
        faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
        { maxFaces: 1 }
    );
    console.log("FaceMesh loaded");
}

// ================= EAR =================
function computeEAR(points) {
    const d = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1]);

    const A = d(points[159], points[145]);
    const B = d(points[158], points[153]);
    const C = d(points[33], points[133]);

    return (A + B) / (2.0 * C);
}

// ================= TEMPORAL SMOOTHING =================
function smoothEAR(value) {
    earBuffer.push(value);
    if (earBuffer.length > SMOOTH_WINDOW) {
        earBuffer.shift();
    }
    const avg = earBuffer.reduce((a,b)=>a+b,0) / earBuffer.length;
    return avg;
}

// ================= HEAD POSE =================
function getHeadDirection(points) {
    const left = points[33][0];
    const right = points[263][0];
    const nose = points[1][0];

    const center = (left + right) / 2;
    const offset = nose - center;

    if (offset > 15) return "RIGHT";
    if (offset < -15) return "LEFT";
    return "CENTER";
}

// ================= FATIGUE SCORE (PERCLOS) =================
function calculateFatigueScore() {
    if (frameCount === 0) return 0;
    const perclos = (closedFrames / frameCount) * 100;
    return Math.min(100, Math.round(perclos));
}

// ================= MAIN LOOP =================
async function detectLoop() {

    const predictions = await model.estimateFaces({ input: video });

    if (predictions.length > 0) {

        const mesh = predictions[0].scaledMesh;

        let ear = computeEAR(mesh);
        ear = smoothEAR(ear);

        const headDir = getHeadDirection(mesh);

        frameCount++;
        if (ear < EAR_THRESHOLD) {
            closedFrames++;
        }

        const fatigue = calculateFatigueScore();

        earText.innerText = ear.toFixed(2);
        headText.innerText = headDir;
        fatigueText.innerText = fatigue;

        if (fatigue > 60) {
            statusText.innerText = "HIGH FATIGUE";
            statusText.className = "status drowsy";
            alertSound.play();
        } 
        else if (headDir !== "CENTER") {
            statusText.innerText = "DISTRACTED";
            statusText.className = "status warning";
        }
        else {
            statusText.innerText = "SAFE";
            statusText.className = "status safe";
        }

        console.log("EAR:", ear.toFixed(3),
                    "| Head:", headDir,
                    "| Fatigue:", fatigue);
    }

    requestAnimationFrame(detectLoop);
}

// ================= INIT =================
async function initHCAI() {
    await startCamera();
    await loadFaceModel();
    detectLoop();
}

initHCAI();
