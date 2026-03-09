const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const path = require("path");
app.use(express.static(path.join(__dirname, "client")));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  }
});

io.on("connection", (socket) => {

  console.log("User connected:", socket.id);

  socket.on("join-room", (roomId) => {

    socket.join(roomId);

    // Notify others
    socket.to(roomId).emit("user-joined", socket.id);

    // Send existing users to new user
    const clients = [...(io.sockets.adapter.rooms.get(roomId) || [])];

    socket.emit("all-users", clients.filter(id => id !== socket.id));
  });

  socket.on("offer", (data) => {

    socket.to(data.to).emit("offer", {
      offer: data.offer,
      from: socket.id
    });

  });

  socket.on("answer", (data) => {

    socket.to(data.to).emit("answer", {
      answer: data.answer,
      from: socket.id
    });

  });

  socket.on("ice-candidate", (data) => {

    socket.to(data.to).emit("ice-candidate", {
      candidate: data.candidate,
      from: socket.id
    });

  });

});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("Server running on port 5000");
});