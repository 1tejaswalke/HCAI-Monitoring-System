
// ======================================================
// HCAI - Advanced Human Centered AI Monitoring Engine
// Frontend Only - No Backend Required
// Compatible with Advanced HCAI HTML
// ======================================================

let model;
let frameCount = 0;
let closedFrames = 0;
let earBuffer = [];

const EAR_THRESHOLD = 0.25;
const SMOOTH_WINDOW = 5;

const video = document.getElementById("video");
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

// ================= LOAD MODEL =================
async function loadFaceModel() {
    model = await faceLandmarksDetection.load(
        faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
        { maxFaces: 1 }
    );
}

// ================= DISTANCE =================
function dist(a,b){
    return Math.hypot(a[0]-b[0], a[1]-b[1]);
}

// ================= EAR =================
function computeEAR(p){
    const A = dist(p[159], p[145]);
    const B = dist(p[158], p[153]);
    const C = dist(p[33], p[133]);
    return (A+B)/(2*C);
}

// ================= MAR =================
function computeMAR(p){
    const A = dist(p[13], p[14]);
    const B = dist(p[78], p[308]);
    return A/B;
}

// ================= SMOOTHING =================
function smoothEAR(val){
    earBuffer.push(val);
    if(earBuffer.length>SMOOTH_WINDOW) earBuffer.shift();
    return earBuffer.reduce((a,b)=>a+b,0)/earBuffer.length;
}

// ================= HEAD POSE =================
function getHeadDirection(p){
    const left = p[33][0];
    const right = p[263][0];
    const nose = p[1][0];
    const center = (left+right)/2;
    const offset = nose-center;

    if(offset>15) return "RIGHT";
    if(offset<-15) return "LEFT";
    return "CENTER";
}

// ================= FATIGUE (PERCLOS) =================
function fatigueScore(){
    if(frameCount===0) return 0;
    const perclos = (closedFrames/frameCount)*100;
    return Math.min(100,Math.round(perclos));
}

// ================= EMOTION HEURISTIC =================
function classifyEmotion(mar, ear){
    let state="Neutral";
    let prob=60;

    if(mar>0.6){
        state="Happy";
        prob=Math.min(95,Math.round(mar*100));
    }
    else if(mar<0.3 && ear>0.3){
        state="Angry";
        prob=75;
    }
    else if(ear<0.22){
        state="Stress";
        prob=80;
    }

    return {state,prob};
}

// ================= MAIN LOOP =================
async function detectLoop(){

    const predictions = await model.estimateFaces({input:video});

    if(predictions.length>0){

        const mesh = predictions[0].scaledMesh;

        let ear = computeEAR(mesh);
        ear = smoothEAR(ear);

        const mar = computeMAR(mesh);
        const headDir = getHeadDirection(mesh);

        frameCount++;
        if(ear<EAR_THRESHOLD) closedFrames++;

        const fatigue = fatigueScore();
        const emotion = classifyEmotion(mar,ear);

        // Update UI
        earText.innerText = ear.toFixed(2);
        marText.innerText = mar.toFixed(2);
        headText.innerText = headDir;
        fatigueText.innerText = fatigue;
        emotionText.innerText = emotion.state;
        emotionProbText.innerText = emotion.prob;

        // Status Logic
        if(fatigue>60){
            statusText.innerText="HIGH FATIGUE";
            statusText.className="status drowsy";
            alertSound.play();
        }
        else if(headDir!=="CENTER"){
            statusText.innerText="DISTRACTED";
            statusText.className="status warning";
        }
        else{
            statusText.innerText="SAFE";
            statusText.className="status safe";
        }
    }

    requestAnimationFrame(detectLoop);
}

// ================= INIT =================
async function initHCAI(){
    await startCamera();
    await loadFaceModel();
    detectLoop();
}

initHCAI();
