const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    user_id: { type: String, unique: true },
    full_name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    date_of_birth: { type: Date },
    gender: { type: String },
    phone_number: { type: String, unique: true, required: true },
    address: { type: String },
    zip: { type: String },
    position: { type: String },
    join_date: { type: Date, default: Date.now },
    jersey_number: { type: Number },
    player_bio: { type: String },
    profile_pic: { type: String }
});

module.exports = mongoose.model('User', UserSchema);
