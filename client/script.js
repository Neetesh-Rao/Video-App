// const socket = io("http://192.168.1.123:5000");
// const socket = io('https://cw6wsg7n-5000.inc1.devtunnels.ms/')  
const socket = io();

let localStream;
let peerConnection;

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const roomInput = document.getElementById("roomInput");
const audioStatus = document.getElementById("audioStatus"); // Add this in HTML

const servers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ]
};

async function startCamera() {

  try {

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    localStream = stream;
    localVideo.srcObject = stream;

    console.log("Camera + Mic started");

  } catch (err) {

    console.error("Camera/Mic error:", err);

    // fallback video only
    try {

      console.log("Trying video only...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true
      });

      localStream = stream;
      localVideo.srcObject = stream;

    } catch (err2) {

      alert("Camera bhi available nahi hai");

    }

  }

}

async function joinRoom() {
  const roomId = roomInput.value;
  
  if (!roomId) {
    alert("Enter room id");
    return;
  }
  
  await startCamera();
  
  // Only create peer connection if we have stream
  if (localStream) {
    createPeerConnection(roomId);
    socket.emit("join-room", roomId);
  } else {
    alert("Camera not available");
  }
}

function createPeerConnection(roomId) {
  peerConnection = new RTCPeerConnection(servers);
  
  // Add all tracks from local stream
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }
  
  peerConnection.ontrack = event => {
    if (!remoteVideo.srcObject) {
      remoteVideo.srcObject = event.streams[0];
    }
  };
  
  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        room: roomId,
        candidate: event.candidate
      });
    }
  };
}

socket.on("user-joined", async () => {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  
  socket.emit("offer", {
    room: roomInput.value,
    offer: offer
  });
});

socket.on("offer", async (offer) => {
  if (!peerConnection) {
    createPeerConnection(roomInput.value);
  }
  
  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  
  socket.emit("answer", {
    room: roomInput.value,
    answer: answer
  });
});

socket.on("answer", async (answer) => {
  await peerConnection.setRemoteDescription(answer);
});

socket.on("ice-candidate", async (candidate) => {
  if (peerConnection) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
});