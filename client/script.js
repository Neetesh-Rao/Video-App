const socket = io("http://192.168.1.123:5000");
// const socket = io('https://cw6wsg7n-5000.inc1.devtunnels.ms/')  
// const socket = io();
window.addEventListener("load", async () => {
  const savedRoom = localStorage.getItem("roomId");

  if (savedRoom) {
    roomInput.value = savedRoom;

    await startCamera();

    socket.emit("join-room", savedRoom);
  }
});

let localStream;
let peerConnections={};

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
function leaveRoom(){

  // Remove saved room
  localStorage.removeItem("roomId");

  // Close all peer connections
  Object.values(peerConnections).forEach(pc => pc.close());

  peerConnections = {};

  // Clear remote videos
  document.getElementById("videos").innerHTML =
      '<video id="localVideo" autoplay playsinline muted></video>';

  // Disconnect socket
  socket.disconnect();

  // Reload page
  location.reload();
}

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

  // Save room in localStorage
  localStorage.setItem("roomId", roomId);

  await startCamera();

  if (localStream) {
    socket.emit("join-room", roomId);
  }
}


function createPeerConnection(socketId){
  // If a peer connection already exists for this socket, return it
  if (peerConnections[socketId]) return peerConnections[socketId];

  const pc = new RTCPeerConnection(servers);

  // Add local tracks
  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);    
  });

  pc.ontrack = event => {
    // Only create video element if it doesn't exist
    let existingVideo = document.getElementById(`video-${socketId}`);
    if (!existingVideo) {
      const video = document.createElement("video");
      video.id = `video-${socketId}`; // unique id per user
      video.srcObject = event.streams[0];
      video.autoplay = true;
      video.playsInline = true;
      document.getElementById("videos").appendChild(video);
    }
  };

  pc.onicecandidate = event => {
    if(event.candidate){
      socket.emit("ice-candidate",{
        to: socketId,
        candidate: event.candidate
      });
    }
  };

  peerConnections[socketId] = pc;
  return pc;
}

socket.on("user-joined", async (socketId) => {
  const pc=createPeerConnection(socketId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  
  socket.emit("offer", {
  to:socketId,
    offer: offer
  });
});

socket.on("offer", async (data) => {
const pc=createPeerConnection(data.from);
  await pc.setRemoteDescription(data.offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  
  socket.emit("answer", {
    to:data.from,
    answer: answer
  });
});

socket.on("answer", async (data) => {
    const pc = peerConnections[data.from];

  await pc.setRemoteDescription(data.answer);
});

socket.on("ice-candidate", async (data) => {
  const pc = peerConnections[data.from];
  if (pc) {
    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
});

socket.on("user-left", (socketId) => {

  const video = document.getElementById(`video-${socketId}`);
  if(video) video.remove();

  if(peerConnections[socketId]){
    peerConnections[socketId].close();
    delete peerConnections[socketId];
  }

});