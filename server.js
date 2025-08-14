import "dotenv/config"
import express from "express"
import cors from "cors"
import { Server } from "socket.io"
import { createServer as createHttpServer } from "http"
import { createServer as createHttpsServer } from "https"
import fs from "fs"
import cron from 'node-cron';

import authMiddleware from "./middleware/auth.js"
import attendanceChecker from './services/attendance-checker.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import lecturerRoutes from './routes/lecturerRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import sectionRoutes from './routes/sectionRoutes.js';
import createAttendanceRoutes from './routes/attendanceRoutes.js';
import reportRoutes from './routes/reportsRoutes.js';
import studentRoutes from './routes/studentRoutes.js'; 


const PORT = process.env.PORT || 8090

const app = express()

//Middleware
app.use(express.json())


const allowedOrigins = [
  'http://localhost:5173',
  'https://localhost:5173',
  'https://192.168.0.103:5173',
  'https://192.168.0.103',
  'https://attendance-system-frontend-pudqik4ft-firekeepers-projects.vercel.app',
  'https://attendance-system-frontend-ten.vercel.app',
  process.env.CLIENT_ORIGIN
];


const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};

app.use(cors(corsOptions));


let server;
if (process.env.NODE_ENV === 'production') {
  // In production (on Render), create a standard HTTP server.
  // Render's load balancer handles HTTPS.
  server = createHttpServer(app);
  console.log('Running in production mode: creating HTTP server.');
} else {
  // In development, create an HTTPS server using your local certs.
  const httpsOptions = {
    key: fs.readFileSync('./localhost+1-key.pem'),
    cert: fs.readFileSync('./localhost+1.pem'),
  };
  server = createHttpsServer(httpsOptions, app);
  console.log('Running in development mode: creating HTTPS server.');
}



const io = new Server(server, {
    cors: corsOptions
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  socket.on("join_section", (sectionId) => {
    socket.join(`section_${sectionId}`);
    console.log(`User ${socket.id} joined section room: section_${sectionId}`);
  });
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

cron.schedule('0 2 * * *', () => {
    console.log('Triggering the scheduled daily attendance check...');
    attendanceChecker.runDailyCheck();
}, {
    scheduled: true,
    timezone: "Asia/Kuala_Lumpur"
});



//API Routes
app.use("/api", authRoutes)
app.use("/api", userRoutes)
app.use("/api", lecturerRoutes);
app.use("/api", studentRoutes);
app.use("/api", courseRoutes)
app.use("/api", sectionRoutes)
app.use("/api", reportRoutes);

//Attendance routes (with io)
app.use("/api", createAttendanceRoutes(io))


app.get("/", (req, res) => {
    res.send('Welcome to the Attendance System API!');
})

console.log('SERVER STARTUP - Allowed Origins:', allowedOrigins);

server.listen(PORT, "0.0.0.0", () => {
  const protocol = process.env.NODE_ENV === 'production' ? 'HTTP' : 'HTTPS';
  console.log(`${protocol} Server running on port ${PORT}`);
  console.log(`Websocket server also running on port ${PORT}`);
});
