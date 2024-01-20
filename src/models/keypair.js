const mongoose = require('mongoose');

const keypairSchema = new mongoose.Schema({
    publicKey: {type: String, required: true},
    privateKey: {type: String, required: true},
    userId: {type: mongoose.Schema.Types.ObjectId}
});

const Keypair = mongoose.model('Keypair', keypairSchema);
module.exports = Keypair;