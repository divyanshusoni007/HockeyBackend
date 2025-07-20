const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    user_id: { type: String, unique: true }, // Added unique constraint
    full_name: { type: String, required: true },
    email: { type: String, required: true, unique: true }, // Assuming email should also be unique
    date_of_birth: { type: Date },
    gender: { type: String },
    phone_number: { type: String },
    address: { type: String },
    zip: { type: String },
    position: { type: String },
    join_date: { type: Date, default: Date.now }, // Set default join_date
    jersey_number: { type: Number },
    player_bio: { type: String },
    profile_pic:{type: String}
});

module.exports = mongoose.model('User', UserSchema);