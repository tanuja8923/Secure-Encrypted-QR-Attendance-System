const express = require("express");
const cors = require("cors");
const QRCode = require("qrcode");
const crypto = require("crypto");
const path = require("path");

require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// HTML files serve karega
app.use(express.static("public"));

// MongoDB Connection
require("./db");
const Attendance = require("./models/Attendance");

// =========================
// Encryption Setup
// =========================

const SECRET_KEY = crypto.scryptSync(
    process.env.SECRET_KEY,
    "salt",
    32
);
const IV = Buffer.alloc(16, 0);

// Encrypt Function
function encrypt(text) {

    const cipher = crypto.createCipheriv(
        "aes-256-cbc",
        SECRET_KEY,
        IV
    );

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    return encrypted;
}

// Decrypt Function
function decrypt(text) {

    const decipher = crypto.createDecipheriv(
        "aes-256-cbc",
        SECRET_KEY,
        IV
    );

    let decrypted = decipher.update(text, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
}
// =========================
// QR GENERATE API
// =========================

app.post("/qr/generate", async (req, res) => {

    try {

        const { name, id } = req.body;

        const qrData = JSON.stringify({
            id,
            name,
            date: new Date().toDateString()
        });

        const encryptedData = encrypt(qrData);

        const qrImage = await QRCode.toDataURL(encryptedData);

        res.json({
            qrImage,
            message: "QR Generated Successfully"
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            error: "QR Generation Failed"
        });

    }

});
app.get("/", (req,res)=>{
    res.sendFile(path.join(__dirname,"public","index.html"));
});



// =========================
// QR SCAN API
// =========================

app.post("/qr/scan", async (req, res) => {

    try {

        const { qrData } = req.body;

        const decrypted = decrypt(qrData);

        const user = JSON.parse(decrypted);

        const today = new Date().toDateString();
        const currentTime = new Date().toLocaleTimeString();

        let record = await Attendance.findOne({

            id: user.id,
            date: today

        });

        // First Scan -> Time In

        if (!record) {

            const newEntry = new Attendance({

                id: user.id,
                name: user.name,
                date: today,
                time_in: currentTime,
                time_out: null

            });

            await newEntry.save();

            return res.json({

                message: "Time In Marked ✔",
                data: newEntry

            });

        }

        // Second Scan -> Time Out

        if (record.time_out === null) {

            record.time_out = currentTime;

            await record.save();

            return res.json({

                message: "Time Out Marked ✔",
                data: record

            });

        }

        return res.json({

            message: "Already Checked Out ✔",
            data: record

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            error: "Invalid QR"

        });

    }

});
// =========================
// ATTENDANCE API
// =========================

app.get("/attendance", async (req, res) => {

    try {

        const data = await Attendance.find();

        res.json(data);

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }

});


// =========================
// EXPORT CSV
// =========================

app.get("/export", async (req, res) => {

    try {

        const data = await Attendance.find();

        let csv = "ID,Name,Date,Time In,Time Out\n";

        data.forEach(user => {

            csv += `${user.id},${user.name},${user.date},${user.time_in},${user.time_out || ""}\n`;

        });

        res.header("Content-Type", "text/csv");
        res.attachment("attendance.csv");
        res.send(csv);

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }

});


// =========================
// START SERVER
// =========================

const PORT = 3000;

app.listen(PORT, () => {

    console.log(`🚀 Server running at http://localhost:${PORT}`);

});