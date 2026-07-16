const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  id: String,
  name: String,
  date: String,
  time_in: String,
  time_out: String
});

module.exports = mongoose.model(
  "Attendance",
  attendanceSchema
);