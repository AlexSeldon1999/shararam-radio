const express = require("express");
const path = require("path");
const http = require("http");
const mongoose = require("mongoose");
const socketIO = require("socket.io");
require("dotenv").config();

const apiRoutes = require("./routes/api");
const socketHandler = require("./socket");
const bot = require("./bot");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

app.use(express.json());
app.use("/api", apiRoutes);

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Запускаем обработчик Socket.IO
socketHandler(io);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  bot.run();
});