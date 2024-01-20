const moongose = require('mongoose');

const uploadFileSchema = new moongose.Schema({
    fileName: { type: String, required: true },
    fileOriginalName: { type: String, required: true },
    userId: { type: moongose.Schema.Types.ObjectId },
    // fileHash: { type: String, required: true },
}, { timestamps: true });

const uploadFile = moongose.model('uploadFile', uploadFileSchema);
module.exports = uploadFile;