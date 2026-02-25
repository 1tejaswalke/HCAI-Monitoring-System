
// ======================================================
// HCAI - Advanced Human-Centered AI Driver Monitoring
// EAR + MAR + Head Pose + PERCLOS + Emotion Detection
// Advanced Emotion Mode (Happy / Angry / Neutral / Stressed)
// ======================================================

let model;
let frameCount = 0;
let closedFrames = 0;
let earBuffer = [];
let marBuffer = [];

const EAR_THRESHOLD = 0.25;
const MAR_THRESHOLD = 0.6;
const SMOOTH_WINDOW = 5;

const video = document.getElementById("video");
const earText = document.getElementById("earValue");
const headText = document.getElementById("headPose");
const fatigueText = document.getElementById("fatigueScore");
const statusText = document.getElementById("status");

const alertSound = new Audio("https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg");

// ================= CAMERA =================
async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
    });
    video.srcObject = stream;
    await video.play();
}

// ================= LOAD MODEL =================
async function loadFaceModel() {
    model = await faceLandmarksDetection.load(
        faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
        { maxFaces: 1 }
    );
}

// ================= UTIL =================
const dist = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1]);

function smooth(buffer, value) {
    buffer.push(value);
    if (buffer.length > SMOOTH_WINDOW) buffer.shift();
    return buffer.reduce((a,b)=>a+b,0) / buffer.length;
}

// ================= EAR =================
function computeEAR(p) {
    const A = dist(p[159], p[145]);
    const B = dist(p[158], p[153]);
    const C = dist(p[33], p[133]);
    return (A + B) / (2.0 * C);
}

// ================= MAR =================
function computeMAR(p) {
    const vertical = dist(p[13], p[14]);
    const horizontal = dist(p[78], p[308]);
    return vertical / horizontal;
}

// ================= HEAD POSE =================
function headDirection(p) {
    const left = p[33][0];
    const right = p[263][0];
    const nose = p[1][0];
    const center = (left + right) / 2;
    const offset = nose - center;

    if (offset > 15) return "RIGHT";
    if (offset < -15) return "LEFT";
    return "CENTER";
}

// ================= FATIGUE =================
function fatigueScore() {
    if (frameCount === 0) return 0;
    const perclos = (closedFrames / frameCount) * 100;
    return Math.min(100, Math.round(perclos));
}

// ================= EMOTION CLASSIFIER =================
function detectEmotion(p, ear, mar) {

    const browRaise = dist(p[70], p[105]);   // eyebrow tension
    const mouthCurve = p[291][1] - p[61][1]; // smile proxy

    if (mar > MAR_THRESHOLD) return "YAWNING";

    if (ear < EAR_THRESHOLD && fatigueScore() > 50) return "DROWSY";

    if (mouthCurve < -5) return "HAPPY";

    if (browRaise < 15) return "ANGRY";

    if (headDirection(p) !== "CENTER") return "DISTRACTED";

    if (Math.abs(mouthCurve) < 3 && browRaise < 20) return "STRESSED";

    return "NEUTRAL";
}

// ================= MAIN LOOP =================
async function detectLoop() {

    const predictions = await model.estimateFaces({ input: video });

    if (predictions.length > 0) {

        const mesh = predictions[0].scaledMesh;

        let ear = smooth(earBuffer, computeEAR(mesh));
        let mar = smooth(marBuffer, computeMAR(mesh));

        const head = headDirection(mesh);

        frameCount++;
        if (ear < EAR_THRESHOLD) closedFrames++;

        const fatigue = fatigueScore();
        const emotion = detectEmotion(mesh, ear, mar);

        earText.innerText = ear.toFixed(2);
        headText.innerText = head + " | " + emotion;
        fatigueText.innerText = fatigue;

        if (fatigue > 60 || emotion === "DROWSY") {
            statusText.innerText = "HIGH FATIGUE";
            statusText.className = "status drowsy";
            alertSound.play();
        } else {
            statusText.innerText = emotion;
            statusText.className = "status safe";
        }
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
