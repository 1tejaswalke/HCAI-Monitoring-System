let pc = null;

async function start() {
    pc = new RTCPeerConnection();

    const stream = await navigator.mediaDevices.getUserMedia({video:true});
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const response = await fetch("/offer", {
        method: "POST",
        body: JSON.stringify({
            sdp: pc.localDescription.sdp,
            type: pc.localDescription.type
        }),
        headers: {"Content-Type":"application/json"}
    });

    const answer = await response.json();
    await pc.setRemoteDescription(answer);

    document.getElementById("video").srcObject = stream;
}
