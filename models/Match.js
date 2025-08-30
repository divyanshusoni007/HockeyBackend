// Old Match Schema

const mongoose = require("mongoose");

const MatchSchema = new mongoose.Schema({
  match_id: String,
  home_team_name: String,
  away_team_name: String,
  venue: String,
  match_date: String,
  match_time: String,

  status: {
    type: String,
    enum: ['Live', 'Upcoming', 'Finished'],
    default: 'Upcoming'
  },

  home_score: {
    type: Number,
    default: 0,
  },
  away_score: {
    type: Number,
    default: 0,
  },
  remaining_time: {
    type: String,
    default: "15:00",
  },
  timer_running: {
    type: Boolean,
    default: false,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Match", MatchSchema);


// New Match Schema
// This schema is designed to handle live match updates, including scores, events, and more.


// const mongoose = require('mongoose');

// // Individual match events (goal, card, PC, etc.)
// const eventSchema = new mongoose.Schema({
//   time: { type: String, required: true }, // "MM:SS" format
//   team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
//   player: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   type: { 
//     type: String, 
//     enum: [
//       'Goal', 
//       'Penalty Corner Earned', 
//       'PC Scored', 
//       'Green Card', 
//       'Yellow Card', 
//       'Red Card'
//     ],
//     required: true
//   },
//   quarter: { type: String, enum: ['Q1', 'Q2', 'Q3', 'Q4', 'Extra Time'], required: true }
// });

// // Penalty shootout structure
// const penaltySchema = new mongoose.Schema({
//   team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
//   player: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   outcome: { type: String, enum: ['Goal', 'Saved', 'Missed'], required: true }
// });

// const matchSchema = new mongoose.Schema({
//   match_id: { type: String, unique: true, required: true }, // e.g. "M001"
  
//   tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' },

//   team1: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
//   team2: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },

//   date: { type: Date, required: true },
//   venue: { type: String },

//   status: { 
//     type: String, 
//     enum: ['Upcoming', 'Live', 'Finished'], 
//     default: 'Upcoming' 
//   },

//   current_quarter: { type: String, enum: ['Q1', 'Q2', 'Q3', 'Q4', 'Extra Time', null], default: null },

//   // Scores per quarter
//   score: {
//     team1: { type: Number, default: 0 },
//     team2: { type: Number, default: 0 }
//   },
//   quarter_scores: {
//     Q1: { team1: { type: Number, default: 0 }, team2: { type: Number, default: 0 } },
//     Q2: { team1: { type: Number, default: 0 }, team2: { type: Number, default: 0 } },
//     Q3: { team1: { type: Number, default: 0 }, team2: { type: Number, default: 0 } },
//     Q4: { team1: { type: Number, default: 0 }, team2: { type: Number, default: 0 } },
//     ExtraTime: { team1: { type: Number, default: 0 }, team2: { type: Number, default: 0 } }
//   },

//   events: [eventSchema], // Goals, cards, PCs, etc.
//   penalty_shootout: [penaltySchema], // If match ends in tie

//   start_time: { type: Date },
//   end_time: { type: Date },

//   created_at: { type: Date, default: Date.now },
//   updated_at: { type: Date, default: Date.now }
// });

// module.exports = mongoose.model('Match', matchSchema);


