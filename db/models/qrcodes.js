import db from "../knex.js"
import { v4 as uuidv4 } from "uuid"



function calculateExpirationTime(minutes = 10) {
    const bufferInSeconds = 3; // The crucial 3-second network buffer

    const validityInMs = minutes * 60 * 1000;
    const bufferInMs = bufferInSeconds * 1000;

    // Return a new Date object calculated from the current time in milliseconds
    return new Date(Date.now() + validityInMs + bufferInMs);
}


async function generateQrCode(course_code, expires_in_minutes = 10, existing_session_id = null) {
    const qr_string = uuidv4();
    const expires_at = calculateExpirationTime(expires_in_minutes);

    const session_id = existing_session_id || uuidv4()

    const [qrcode_id] = await db("qrcodes").insert({
        qr_string,
        course_code,
        expires_at,
        session_id,
    });
    
    // Return the newly created QR code object
    return findById(qrcode_id);
}


async function findById(qrcode_id) {
    return db("qrcodes")
        .select("qrcode_id", "qr_string", "course_code", "expires_at", "created_at", "session_id")
        .where({ qrcode_id })
        .first();
}


async function findByQrString(qr_string) {
    return db("qrcodes")
        .select("qrcode_id", "qr_string", "course_code", "expires_at", "created_at", "session_id")
        .where({ qr_string })
        .first();
}


async function validateQrCode(qr_string) {
    const qrcode = await findByQrString(qr_string);

    if (!qrcode) {
        return { isValid: false, message: "QR Code not found." };
    }

    if (new Date() > new Date(qrcode.expires_at)) {
        return { isValid: false, message: "QR Code has expired.", qrcode: qrcode };
    }

    // If valid, return its details
    return { isValid: true, message: "QR Code is valid.", qrcode: qrcode };
}


// Optional: Function to invalidate/delete a QR code
async function invalidateQrCode(qrcode_id) {
    const affectedRows = await db("qrcodes")
        .where({ qrcode_id })
        .del(); // Or you could set an 'is_active' flag
    return affectedRows > 0;
}


export default {
    generateQrCode,
    findById,
    findByQrString,
    validateQrCode,
    invalidateQrCode, 
};