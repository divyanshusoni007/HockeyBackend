const mongoose = require('mongoose');

const PlayerStatsSchema = new mongoose.Schema({
    total_matches: { type: Number, default: 0 },
    goals: { type: Number, default: 0 },
    field_goals: { type: Number, default: 0 },
    pc: { type: Number, default: 0 },
    ps: { type: Number, default: 0 },
    assists: { type: Number, default: 0 },
    red_cards: { type: Number, default: 0 },
    yellow_cards: { type: Number, default: 0 },
    green_cards: { type: Number, default: 0 },
    total_goal_score: { type: Number, default: 0 }
}, { _id: false });

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
    profile_pic: { type: String },

    // ✅ NEW
    player_stats: { type: PlayerStatsSchema, default: () => ({}) }
});

module.exports = mongoose.model('User', UserSchema);
