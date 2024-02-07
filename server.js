require('dotenv').config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { MongoClient } = require("mongodb");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
  },
});

const url = process.env.DB_URL
const client = new MongoClient(
  url
);

const serverData = {
  users: 0,
};

let rooms = {};

io.on("connection", async (socket) => {
  console.log("A client connected:", socket.id);
  io.to(socket.id).emit("join", {
    id: socket.id,
  });

  try {
    // Connect to MongoDB Atlas
    await client.connect();
    console.log("Connected to MongoDB Atlas");

    // Example: Insert user information into a 'users' collection
    const usersCollection = client.db('user').collection("chat");
    await usersCollection.insertOne({ socketId: socket.id });

    // Emit a message to the connected client
    socket.emit("welcome", { message: "Welcome to the server!" });

    // Handle chat messages
    socket.on("chat message", async (message) => {
      console.log("Received chat message:", message.msg);

      // Example: Insert chat message into a 'messages' collection
      const messagesCollection = client
        .db('user')
        .collection("messages");
      await messagesCollection.insertOne({ message: message.msg, sender: socket.id });

      // Broadcast the chat message to all connected clients
      io.emit("chat message", message.msg);
    });

    
    socket.on('joinRoom', async (room) => {

      socket.join(room, () => {
        console.log(socket.id, 'joined Room:',room)
      })
      
      const roomCollection = client.db('user').collection('rooms')
      let roomExists = await roomCollection.findOne({roomId: room})

      console.log('room exists -> ', roomExists)
      if(roomExists) {
        let token = 'o';
        await roomCollection.updateOne({roomId: room},{$set: {p2: {id:socket.id, token: token}}})
        
      }
      else {
        let token = 'x';
        await roomCollection.insertOne({roomId: room, p1: {id:socket.id, token: token}})

      }

      const data = await roomCollection.findOne({roomId: room})
      console.log('data found', data)
      if(data) {
        console.log('from if loop')
        io.in(room).emit('playgame', {
        data: data,
        myId: socket.id
      });}
      console.log('updation done');
    })

    socket.on('updateGame', async (d) => {
      const {roomId, game} = d
      const roomCollection = client.db('user').collection('rooms')

      await roomCollection.updateOne({roomId: roomId}, {$set: {game: game}})
      io.in(roomId).emit('gameUpdated', game)

      console.log('game: this one->',game)
    })


    socket.on("disconnect", async () => {
      console.log("A client disconnected:", socket.id);
      console.log("Number of connected clients:", serverData.users);
      await usersCollection.deleteOne({socketId: socket.id})
    })  
  } catch (error) {
    console.error("Error connecting to MongoDB Atlas:", error);
  }
});

const sendGameData = async(socket, room) => {
  const data = await roomCollection.findOne({roomId: room})
  console.log(data)
}

server.listen(3001, () => {
  console.log(`Server listening on port 3001`);
});
