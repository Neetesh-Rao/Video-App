const socket = io("http://192.168.1.123:5000");
// const socket = io('https://cw6wsg7n-5000.inc1.devtunnels.ms/')  
// const socket = io();

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

// function createPeerConnection(roomId) {
//   peerConnection = new RTCPeerConnection(servers);
  
//   // Add all tracks from local stream
//   if (localStream) {
//     localStream.getTracks().forEach(track => {
//       peerConnection.addTrack(track, localStream);
//     });
//   }
  
//   peerConnection.ontrack = event => {
//     if (!remoteVideo.srcObject) {
//       remoteVideo.srcObject = event.streams[0];
//     }
//   };
  
//   peerConnection.onicecandidate = event => {
//     if (event.candidate) {
//       socket.emit("ice-candidate", {
//         room: roomId,
//         candidate: event.candidate
//       });
//     }
//   };
// }
function createPeerConnection(socketId){
  const pc= new RTCPeerConnection(servers);
  localStream.getTracks().forEach(track => {
pc.addTrack(track,localStream);    
  });
  pc.ontrack=event=>{
    const video=document.createElement("video");
    video.srcObject=event.streams[0];
    video.autoplay=true;
    video.playsInline=true;
   document.getElementById("videos").appendChild(video);
  };
  pc.onicecandidate=event=>{
    if(event.candidate){
      socket.emit("ice-candidate",{
        to:socketId,
        candidate:event.candidate
      })
    }
  }
  peerConnections[socketId]=pc;
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