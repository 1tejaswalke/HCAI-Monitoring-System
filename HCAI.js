// ======================================================
// HCAI - Parametric Emotion & Fatigue Model (Improved)
// ======================================================

let model;
let video = document.getElementById("video");

let closedStartTime = null;
let lastAlertTime = 0;

const FATIGUE_DURATION_MS = 1500;
const ALERT_COOLDOWN = 3000; // prevent sound spam

// UI Elements
const earText = document.getElementById("earValue");
const marText = document.getElementById("marValue");
const headText = document.getElementById("headPose");
const fatigueText = document.getElementById("fatigueScore");
const emotionText = document.getElementById("emotionState");
const emotionProbText = document.getElementById("emotionProb");
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

// ================= MODEL =================
async function loadModel() {
    model = await faceLandmarksDetection.load(
        faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
        { maxFaces: 1 }
    );
}

// ================= UTILS =================
function dist(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

// ================= FEATURES =================
function computeEAR(p) {
    const A = dist(p[159], p[145]);
    const B = dist(p[158], p[153]);
    const C = dist(p[33], p[133]);
    return (A + B) / (2 * C);
}

function computeMAR(p) {
    const A = dist(p[13], p[14]);     // vertical
    const B = dist(p[78], p[308]);    // horizontal
    return A / B;
}

// ================= HEAD =================
function getHeadDirection(p) {
    const left = p[33][0];
    const right = p[263][0];
    const nose = p[1][0];
    const center = (left + right) / 2;
    const offset = nose - center;

    if (offset > 20) return "LEFT";
    if (offset < -20) return "RIGHT";
    return "CENTER";
}

// ================= CLASSIFICATION =================
function classifyState(ear, mar) {

    // ===== FATIGUE (Eye Closure Time) =====
    if (ear < 0.25) {
        if (!closedStartTime) {
            closedStartTime = Date.now();
        }

        if (Date.now() - closedStartTime > FATIGUE_DURATION_MS) {
            return { state: "Fatigue", prob: 95 };
        }
    } else {
        closedStartTime = null;
    }

    // ===== FATIGUE (Yawning) =====
    if (mar > 0.45) {
        return { state: "Fatigue", prob: 90 };
    }

    // ===== NEUTRAL =====
    if (ear >= 0.25 && ear <= 0.40 && mar >= 0.25 && mar <= 0.40) {
        return { state: "Neutral", prob: 80 };
    }

    // ===== ANGER =====
    if (ear >= 0.20 && ear <= 0.25 && mar >= 0.15 && mar <= 0.25) {
        return { state: "Anger", prob: 85 };
    }

    // ===== DEFAULT =====
    return { state: "Neutral", prob: 60 };
}

// ================= LOOP =================
async function detectLoop() {

    const predictions = await model.estimateFaces({ input: video });

    if (predictions.length > 0) {

        const mesh = predictions[0].scaledMesh;

        const ear = computeEAR(mesh);
        const mar = computeMAR(mesh);
        const headDir = getHeadDirection(mesh);

        const emotion = classifyState(ear, mar);

        // ===== FATIGUE SCORE =====
        let fatigueScore = 0;

        if (emotion.state === "Fatigue") {
            fatigueScore = 100;
        } else {
            fatigueScore = Math.max(0, Math.round((0.30 - ear) * 200));
        }

        // ===== UI UPDATE =====
        earText.innerText = ear.toFixed(2);
        marText.innerText = mar.toFixed(2);
        headText.innerText = headDir;
        fatigueText.innerText = fatigueScore;
        emotionText.innerText = emotion.state;
        emotionProbText.innerText = emotion.prob;

        // ===== ALERT CONTROL =====
        if (emotion.state === "Fatigue") {
            statusText.innerText = "HIGH FATIGUE";
            statusText.className = "status drowsy";

            if (Date.now() - lastAlertTime > ALERT_COOLDOWN) {
                alertSound.play();
                lastAlertTime = Date.now();
            }
        } else {
            statusText.innerText = emotion.state.toUpperCase();
            statusText.className = "status safe";
        }
    }

    requestAnimationFrame(detectLoop);
}

// ================= INIT =================
async function init() {
    await startCamera();
    await loadModel();
    detectLoop();
}

init();
