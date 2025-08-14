import "dotenv/config"
import express from "express"
import cors from "cors"
import { Server } from "socket.io"
import { createServer } from "https"
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

const httpsOptions = {
    key: fs.readFileSync('./localhost+1-key.pem'),
    cert: fs.readFileSync('./localhost+1.pem'),
};

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

const httpsServer = createServer(httpsOptions, app);


const io = new Server(httpsServer, {
    cors: corsOptions
})

// Socket.IO connection handling
io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Example: A lecturer joining a specific section's room
    // The frontend would emit an event like 'join_section' with section_id
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
  timezone: "Asia/Kuala_Lumpur" // Set to your timezone
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

httpsServer.listen(PORT, "0.0.0.0", () => {
    console.log(`HTTPS Server running on port ${PORT}`)
    console.log(`Websocket server also running on port ${PORT}`)
})
