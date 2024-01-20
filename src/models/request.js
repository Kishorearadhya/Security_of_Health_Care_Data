const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
    doctorId: { type: mongoose.Schema.Types.ObjectId},
    patientId: { type: mongoose.Schema.Types.ObjectId},
    status: { type: String, default: 'pending'},
    fileId: { type: mongoose.Schema.Types.ObjectId, default: null },
    password: { type: String, default: null },
}, { timestamps: true });

const Request = mongoose.model('Request', requestSchema);
module.exports = Request;
