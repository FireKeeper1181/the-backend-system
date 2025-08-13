import jwt from "jsonwebtoken"
import lecturersModel from "../db/models/lecturers.js"

const JWT_SECRET = process.env.JWT_SECRET

function authenticateToken(req, res, next) {

    //get token from Authorization header
    const authHeader = req.headers["authorization"]

    //expected format: "Bearer TOKEN"
    const token = authHeader && authHeader.split(" ")[1]


    if (token == null) {
        return res.status(401).json({ message: "Authentication token required"})
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error("JWT verification error:", err.message)
            return res.status(403).json({ message: "Invalid or expired token"})
        }

        //If token valid, attach the user payload to the request object
        req.user = user // {id, email, role}
        next()
    })
}

async function authenticateAdmin(req, res, next) { // <--- MAKE THIS ASYNC
    authenticateToken(req, res, async () => { // <--- Use async function here
        if (req.user.role === 'admin') { // This path assumes a dedicated admin role (which we are phasing out)
            next();
        } else if (req.user.role === 'lecturer') {
            // Check if this lecturer is marked as an admin
            const lecturer = await lecturersModel.findById(req.user.id);
            if (lecturer && lecturer.is_admin) { // Check the new is_admin flag
                next();
            } else {
                return res.status(403).json({ message: "Forbidden: Admins only." });
            }
        }
        else {
            return res.status(403).json({ message: "Forbidden: Admins only." });
        }
    });
}


async function authenticateLecturerOrAdmin(req, res, next) { // <--- MAKE THIS ASYNC
    authenticateToken(req, res, async () => { // <--- Use async function here
        if (req.user.role === 'lecturer') {
            next(); // Lecturer is allowed
        } else if (req.user.role === 'admin') { // This path assumes a dedicated admin role
            next(); // Admin is allowed
        } else if (req.user.role === 'lecturer') {
            // Check if this lecturer is marked as an admin (if we don't have a separate 'admin' role)
            const lecturer = await lecturersModel.findById(req.user.id);
            if (lecturer && lecturer.is_admin) { // Check the new is_admin flag
                next();
            } else {
                // Not a lecturer and not an admin
                return res.status(403).json({ message: "Forbidden: Lecturers or Admins only." });
            }
        }
        else {
            return res.status(403).json({ message: "Forbidden: Lecturers or Admins only." });
        }
    });
}



export default {
    authenticateToken,
    authenticateAdmin,
    authenticateLecturerOrAdmin
}