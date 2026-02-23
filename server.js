require("dotenv").config();

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const https = require('https');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const Match = require("./models/Match");
const MatchLive = require('./models/MatchLive');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");

// Create socket.io instance
const io = new Server(server, {
  cors: {
    origin: "*", // Change to your frontend URL in production
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());


mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB Atlas");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });


// Root route
app.get("/", (req, res) => {
  res.send("Hockey App Backend Running");
});


// 🔹 Phone.Email OTP verification route
// app.post('/auth/phone-email', (req, res) => {
//   const { user_json_url } = req.body;

//   if (!user_json_url) {
//     return res.status(400).json({ error: 'user_json_url missing' });
//   }

//   https.get(user_json_url, (response) => {
//     let data = '';

//     // 🔴 IMPORTANT: check status code
//     if (response.statusCode !== 200) {
//       return res.status(500).json({
//         error: 'Failed to fetch Phone.Email verification data'
//       });
//     }

//     response.on('data', chunk => {
//       data += chunk;
//     });

//     response.on('end', async () => {
//       try {
//         // 🔍 DEBUG (temporarily)
//         console.log('Phone.Email raw response:', data);

//         const jsonData = JSON.parse(data);

//         const phone = jsonData.user_phone_number;
//         if (!phone) {
//           return res.status(400).json({
//             error: 'Phone number not found in Phone.Email response'
//           });
//         }

//         const firstName = jsonData.user_first_name || '';
//         const lastName = jsonData.user_last_name || '';
//         const fullName = `${firstName} ${lastName}`.trim() || 'New User';

//         let user = await User.findOne({ phone_number: phone });

//         if (!user) {
//           user = await User.create({
//             user_id: crypto.randomUUID
//               ? crypto.randomUUID()
//               : crypto.randomBytes(16).toString('hex'),
//             full_name: fullName,
//             phone_number: phone
//           });
//         }

//         // 🔐 Make sure JWT secret exists
//         if (!process.env.JWT_SECRET_KEY) {
//           throw new Error('JWT_SECRET_KEY not defined');
//         }

//         const token = jwt.sign(
//           { userId: user._id, phone: user.phone_number },
//           process.env.JWT_SECRET_KEY,
//           { expiresIn: '7d' }
//         );

//         res.json({ token });

//       } catch (err) {
//         console.error('Phone.Email verification error:', err);
//         res.status(500).json({
//           error: 'Phone verification failed',
//           details: err.message
//         });
//       }
//     });

//   }).on('error', (err) => {
//     console.error('HTTPS error:', err);
//     res.status(500).json({ error: err.message });
//   });
// });


app.post('/auth/phone-email', (req, res) => {
  const { user_json_url } = req.body;

  if (!user_json_url) {
    return res.status(400).json({ error: 'user_json_url missing' });
  }

  https.get(user_json_url, (response) => {
    let data = '';

    if (response.statusCode !== 200) {
      return res.status(500).json({
        error: 'Failed to fetch Phone.Email verification data'
      });
    }

    response.on('data', chunk => {
      data += chunk;
    });

    response.on('end', async () => {
      try {
        console.log('Phone.Email raw response:', data);

        const jsonData = JSON.parse(data);

        const phone = jsonData.user_phone_number;
        if (!phone) {
          return res.status(400).json({
            error: 'Phone number not found in Phone.Email response'
          });
        }

        if (!process.env.JWT_SECRET_KEY) {
          throw new Error('JWT_SECRET_KEY not defined');
        }

        // 🔍 Check if user already exists
        let user = await User.findOne({ phone_number: phone });
        let isNewUser = false;

        const firstName = jsonData.user_first_name || '';
        const lastName = jsonData.user_last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        const hasName = fullName.length > 0;

        if (!user) {
          // 🆕 New user: create a minimal record with just phone number
          isNewUser = true;

          // Generate a basic user_id (will be updated properly when they fill profile)
          const randomId = crypto.randomBytes(4).toString('hex'); // e.g. "a3f2bc91"
          const user_id = `ph${randomId}`;

          user = await User.create({
            user_id,
            full_name: hasName ? fullName : 'New User',
            phone_number: phone
          });
        } else if (!hasName) {
          // ✅ User exists in DB but Phone.Email returned no name
          // Still redirect to profile form so they can complete/verify details
          isNewUser = true;
        }

        // 🔐 Sign JWT
        const token = jwt.sign(
          { userId: user._id, phone: user.phone_number, user_id: user.user_id },
          process.env.JWT_SECRET_KEY,
          { expiresIn: '7d' }
        );

        console.log('Sending response:', {
          token,
          isNewUser,
          user_id: user.user_id,
          phone_number: user.phone_number
        });

        // ✅ Return token + flag + user_id
        res.json({
          token,
          isNewUser,
          user_id: user.user_id,
          phone_number: user.phone_number
        });

      } catch (err) {
        console.error('Phone.Email verification error:', err);
        res.status(500).json({
          error: 'Phone verification failed',
          details: err.message
        });
      }
    });

  }).on('error', (err) => {
    console.error('HTTPS error:', err);
    res.status(500).json({ error: err.message });
  });
});

// GET all matches for the dashboard
app.get('/api/matches', async (req, res) => {
  try {
    const matches = await MatchLive.find();
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET all match lives for a specific tournament by tournament name
app.get('/api/:tournamentname/matchlives', async (req, res) => {
  try {
    const { tournamentname } = req.params;

    if (!tournamentname) {
      return res.status(400).json({ error: "Tournament name is required." });
    }

    // Find the tournament by name
    const tournament = await AddTournament.findOne({ tournament_name: tournamentname });
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found." });
    }

    // Find matches by tournament_id
    const matches = await MatchLive.find({ tournament_id: tournament.tournament_id });

    if (matches.length === 0) {
      return res.status(404).json({ message: "No matches found for this tournament." });
    }

    res.status(200).json(matches);
  } catch (error) {
    console.error("Error fetching match lives:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/player/:userId/teams', async (req, res) => {
  const playerId = req.params.userId;

  try {
    const teams = await MatchLive.aggregate([
      // 1️⃣ Identify matches where player participated
      {
        $addFields: {
          playerTeam: {
            $cond: [
              { $in: [playerId, '$team1_players.player_id'] },
              'team1',
              {
                $cond: [
                  { $in: [playerId, '$team2_players.player_id'] },
                  'team2',
                  null
                ]
              }
            ]
          }
        }
      },

      { $match: { playerTeam: { $ne: null } } },

      // 2️⃣ Normalize team data
      {
        $project: {
          match_id: 1,
          teamName: {
            $cond: [
              { $eq: ['$playerTeam', 'team1'] },
              '$team1_name',
              '$team2_name'
            ]
          },
          teamScore: {
            $cond: [
              { $eq: ['$playerTeam', 'team1'] },
              '$team1_score',
              '$team2_score'
            ]
          },
          opponentScore: {
            $cond: [
              { $eq: ['$playerTeam', 'team1'] },
              '$team2_score',
              '$team1_score'
            ]
          }
        }
      },

      // 3️⃣ Decide win / loss / draw
      {
        $addFields: {
          result: {
            $cond: [
              { $gt: ['$teamScore', '$opponentScore'] },
              'WIN',
              {
                $cond: [
                  { $lt: ['$teamScore', '$opponentScore'] },
                  'LOSS',
                  'DRAW'
                ]
              }
            ]
          }
        }
      },

      // 4️⃣ Group per team
      {
        $group: {
          _id: '$teamName',
          matches: { $sum: 1 },
          wins: {
            $sum: { $cond: [{ $eq: ['$result', 'WIN'] }, 1, 0] }
          },
          losses: {
            $sum: { $cond: [{ $eq: ['$result', 'LOSS'] }, 1, 0] }
          },
          draws: {
            $sum: { $cond: [{ $eq: ['$result', 'DRAW'] }, 1, 0] }
          }
        }
      },

      // 5️⃣ Final shape
      {
        $project: {
          _id: 0,
          teamName: '$_id',
          matches: 1,
          wins: 1,
          losses: 1,
          draws: 1
        }
      }
    ]);

    res.json(teams);
  } catch (err) {
    res.status(500).json({
      message: 'Error fetching player teams',
      error: err.message
    });
  }
});

app.get('/api/player/:userId/matches', async (req, res) => {
  const { userId } = req.params;

  try {
    const matches = await MatchLive.find({
      $or: [
        { 'team1_players.player_id': userId },
        { 'team2_players.player_id': userId }
      ],
      status: 'Finished'
    }).sort({ match_date: -1 });

    const enrichedMatches = matches.map(match => {
      const isTeam1Player = match.team1_players.some(
        p => p.player_id === userId
      );

      const playerTeam = isTeam1Player ? match.team1_name : match.team2_name;
      const opponentTeam = isTeam1Player ? match.team2_name : match.team1_name;

      const playerScore = isTeam1Player
        ? match.team1_score
        : match.team2_score;

      const opponentScore = isTeam1Player
        ? match.team2_score
        : match.team1_score;

      let result = 'DRAW';
      if (playerScore > opponentScore) result = 'WIN';
      else if (playerScore < opponentScore) result = 'LOSS';

      return {
        match_id: match.match_id,
        match_date: match.match_date,
        venue: match.venue,

        playerTeam,
        opponentTeam,
        playerScore,
        opponentScore,

        result
      };
    });

    res.json(enrichedMatches);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/player-stats/:userId', async (req, res) => {
  const playerId = req.params.userId;

  try {
    const stats = await MatchLive.aggregate([

      // 1️⃣ Matches where player was in squad (Live + Finished)
      {
        $match: {
          status: { $in: ['Live', 'Finished'] },
          $or: [
            { 'team1_players.player_id': playerId },
            { 'team2_players.player_id': playerId }
          ]
        }
      },

      // 2️⃣ Fix match universe first
      {
        $group: {
          _id: '$match_id',
          match_events: { $first: '$match_events' }
        }
      },

      // 3️⃣ Unwind events AFTER matches are locked
      {
        $unwind: {
          path: '$match_events',
          preserveNullAndEmptyArrays: true
        }
      },

      // 4️⃣ Keep only this player's events (or none)
      {
        $match: {
          $or: [
            { 'match_events.player_id': playerId },
            { match_events: null }
          ]
        }
      },

      // 5️⃣ Aggregate stats
      {
        $group: {
          _id: null,
          matches: { $addToSet: '$_id' },

          fieldGoals: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    { $toLower: { $trim: { input: '$match_events.type' } } },
                    'goal'
                  ]
                },
                1,
                0
              ]
            }
          },

          pcEarned: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    { $toLower: { $trim: { input: '$match_events.type' } } },
                    'penalty corner earned'
                  ]
                },
                1,
                0
              ]
            }
          },

          pcScored: {
            $sum: {
              $cond: [{ $eq: ['$match_events.type', 'Penalty Corner Scored'] }, 1, 0]
            }
          },

          psEarned: {
            $sum: {
              $cond: [{ $eq: ['$match_events.type', 'Penalty Stroke Earned'] }, 1, 0]
            }
          },

          psScored: {
            $sum: {
              $cond: [{ $eq: ['$match_events.type', 'Penalty Stroke Scored'] }, 1, 0]
            }
          },

          penaltyShootout: {
            $sum: {
              $cond: [{ $eq: ['$match_events.type', 'Penalty Shootout Goal'] }, 1, 0]
            }
          },

          redCards: {
            $sum: {
              $cond: [{ $eq: ['$match_events.type', 'Red Card'] }, 1, 0]
            }
          },

          yellowCards: {
            $sum: {
              $cond: [{ $eq: ['$match_events.type', 'Yellow Card'] }, 1, 0]
            }
          },

          greenCards: {
            $sum: {
              $cond: [{ $eq: ['$match_events.type', 'Green Card'] }, 1, 0]
            }
          }
        }
      },

      // 6️⃣ Final shape
      {
        $project: {
          _id: 0,
          totalMatches: { $size: '$matches' },

          fieldGoals: 1,
          pcEarned: 1,
          pcScored: 1,
          psEarned: 1,
          psScored: 1,
          penaltyShootout: 1,

          redCards: 1,
          yellowCards: 1,
          greenCards: 1,

          totalGoalScore: {
            $add: ['$fieldGoals', '$pcScored', '$psScored']
          }
        }
      }
    ]);

    res.json(stats[0] || {
      totalMatches: 0,
      fieldGoals: 0,
      pcEarned: 0,
      pcScored: 0,
      psEarned: 0,
      psScored: 0,
      penaltyShootout: 0,
      redCards: 0,
      yellowCards: 0,
      greenCards: 0,
      totalGoalScore: 0
    });

  } catch (err) {
    res.status(500).json({
      message: 'Error calculating player stats',
      error: err.message
    });
  }
});


// app.get('/api/player-stats/:userId', async (req, res) => {
//   const playerId = req.params.userId;

//   try {
//     const result = await MatchLive.aggregate([

//       // 1️⃣ Only matches where player was in squad
//       {
//         $match: {
//           $or: [
//             { 'team1_players.player_id': playerId },
//             { 'team2_players.player_id': playerId }
//           ]
//         }
//       },

//       // 2️⃣ Split pipeline by match status + stats
//       {
//         $facet: {

//           // 🔹 FINISHED MATCHES
//           finishedMatches: [
//             { $match: { status: 'Finished' } },
//             {
//               $project: {
//                 _id: 0,
//                 match_id: 1,
//                 team1_name: 1,
//                 team2_name: 1,
//                 team1_score: 1,
//                 team2_score: 1,
//                 match_date: 1,
//                 venue: 1,
//                 status: 1,
//                 playerTeam: {
//                   $cond: [
//                     { $in: [playerId, '$team1_players.player_id'] },
//                     '$team1_name',
//                     '$team2_name'
//                   ]
//                 }
//               }
//             }
//           ],

//           // 🔹 LIVE MATCHES
//           liveMatches: [
//             { $match: { status: 'Live' } },
//             {
//               $project: {
//                 _id: 0,
//                 match_id: 1,
//                 team1_name: 1,
//                 team2_name: 1,
//                 team1_score: 1,
//                 team2_score: 1,
//                 current_quarter: 1,
//                 venue: 1,
//                 status: 1
//               }
//             }
//           ],

//           // 🔹 UPCOMING MATCHES
//           upcomingMatches: [
//             { $match: { status: 'Upcoming' } },
//             {
//               $project: {
//                 _id: 0,
//                 match_id: 1,
//                 team1_name: 1,
//                 team2_name: 1,
//                 match_date: 1,
//                 match_time: 1,
//                 venue: 1,
//                 status: 1
//               }
//             }
//           ],

//           // 🔹 PLAYER STATS (event-based)
//           stats: [
//             {
//               $unwind: {
//                 path: '$match_events',
//                 preserveNullAndEmptyArrays: true
//               }
//             },
//             {
//               $match: {
//                 'match_events.player_id': playerId
//               }
//             },
//             {
//               $group: {
//                 _id: null,
//                 goals: {
//                   $sum: { $cond: [{ $eq: ['$match_events.type', 'Goal'] }, 1, 0] }
//                 },
//                 pc: {
//                   $sum: { $cond: [{ $eq: ['$match_events.type', 'PC Scored'] }, 1, 0] }
//                 },
//                 ps: {
//                   $sum: { $cond: [{ $eq: ['$match_events.type', 'Penalty Stroke Scored'] }, 1, 0] }
//                 },
//                 redCards: {
//                   $sum: { $cond: [{ $eq: ['$match_events.type', 'Red Card'] }, 1, 0] }
//                 },
//                 yellowCards: {
//                   $sum: { $cond: [{ $eq: ['$match_events.type', 'Yellow Card'] }, 1, 0] }
//                 },
//                 greenCards: {
//                   $sum: { $cond: [{ $eq: ['$match_events.type', 'Green Card'] }, 1, 0] }
//                 },
//                 penaltyShootout: {
//                   $sum: { $cond: [{ $eq: ['$match_events.type', 'Penalty Shootout'] }, 1, 0] }
//                 }
//               }
//             }
//           ]
//         }
//       },

//       // 3️⃣ Final shaping
//       {
//         $project: {
//           finishedMatches: 1,
//           liveMatches: 1,
//           upcomingMatches: 1,

//           stats: {
//             $ifNull: [
//               { $arrayElemAt: ['$stats', 0] },
//               {
//                 goals: 0,
//                 pc: 0,
//                 ps: 0,
//                 redCards: 0,
//                 yellowCards: 0,
//                 greenCards: 0,
//                 penaltyShootout: 0
//               }
//             ]
//           }
//         }
//       },

//       // 4️⃣ Add totals
//       {
//         $addFields: {
//           totalMatches: {
//             $add: [
//               { $size: '$finishedMatches' },
//               { $size: '$liveMatches' }
//             ]
//           },
//           totalGoalScore: {
//             $add: [
//               '$stats.goals',
//               '$stats.pc',
//               '$stats.ps'
//             ]
//           }
//         }
//       }
//     ]);

//     res.json(result[0] || {
//       finishedMatches: [],
//       liveMatches: [],
//       upcomingMatches: [],
//       totalMatches: 0,
//       totalGoalScore: 0,
//       stats: {}
//     });

//   } catch (err) {
//     res.status(500).json({
//       message: 'Error fetching player stats',
//       error: err.message
//     });
//   }
// });

app.get('/api/tournament/:tournamentId/teams', async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const tournament = await AddTournament.findOne({ tournament_id: tournamentId });
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found.' });
    }

    const teams = await Teams.find({ tournament_id: tournament._id })
      .select('team_id team_name location logo_url pool');

    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tournament/:tournamentId/matches1', async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const matches = await MatchLive.find({ tournament_id: tournamentId })
      .sort({ match_date: -1 });

    const formattedMatches = matches.map(match => ({
      match_id: match.match_id,
      match_date: match.match_date,
      match_time: match.match_time,
      venue: match.venue,
      status: match.status,
      team1_name: match.team1_name,
      team2_name: match.team2_name,
      team1_score: match.team1_score,
      team2_score: match.team2_score,
      current_quarter: match.current_quarter
    }));

    res.json(formattedMatches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tournament/:tournamentId/stats', async (req, res) => {
  const { tournamentId } = req.params;

  try {
    const stats = await MatchLive.aggregate([
      // 1️⃣ Tournament + valid match statuses
      {
        $match: {
          tournament_id: tournamentId,
          status: { $in: ['Live', 'Finished'] }
        }
      },

      // 2️⃣ Lock match universe
      {
        $group: {
          _id: '$match_id',
          match_events: { $first: '$match_events' }
        }
      },

      // 3️⃣ Unwind events (keep matches even if no events)
      {
        $unwind: {
          path: '$match_events',
          preserveNullAndEmptyArrays: true
        }
      },

      // 4️⃣ Aggregate tournament-level stats
      {
        $group: {
          _id: null,
          matches: { $addToSet: '$_id' },

          fieldGoals: {
            $sum: {
              $cond: [{ $eq: ['$match_events.type', 'Goal'] }, 1, 0]
            }
          },

          pcEarned: {
            $sum: {
              $cond: [{ $eq: ['$match_events.type', 'Penalty Corner Earned'] }, 1, 0]
            }
          },

          pcScored: {
            $sum: {
              $cond: [{ $eq: ['$match_events.type', 'Penalty Corner Scored'] }, 1, 0]
            }
          },

          psEarned: {
            $sum: {
              $cond: [{ $eq: ['$match_events.type', 'Penalty Stroke Earned'] }, 1, 0]
            }
          },

          psScored: {
            $sum: {
              $cond: [{ $eq: ['$match_events.type', 'Penalty Stroke Scored'] }, 1, 0]
            }
          },

          penaltyShootout: {
            $sum: {
              $cond: [{ $eq: ['$match_events.type', 'Penalty Shootout Goal'] }, 1, 0]
            }
          },

          redCards: {
            $sum: {
              $cond: [{ $eq: ['$match_events.type', 'Red Card'] }, 1, 0]
            }
          },

          yellowCards: {
            $sum: {
              $cond: [{ $eq: ['$match_events.type', 'Yellow Card'] }, 1, 0]
            }
          },

          greenCards: {
            $sum: {
              $cond: [{ $eq: ['$match_events.type', 'Green Card'] }, 1, 0]
            }
          }
        }
      },

      // 5️⃣ Final shape
      {
        $project: {
          _id: 0,
          totalMatches: { $size: '$matches' },

          fieldGoals: 1,
          pcEarned: 1,
          pcScored: 1,
          psEarned: 1,
          psScored: 1,
          penaltyShootout: 1,

          redCards: 1,
          yellowCards: 1,
          greenCards: 1,

          totalGoalScore: {
            $add: ['$fieldGoals', '$pcScored', '$psScored']
          }
        }
      }
    ]);

    res.json(stats[0] || {
      totalMatches: 0,
      fieldGoals: 0,
      pcEarned: 0,
      pcScored: 0,
      psEarned: 0,
      psScored: 0,
      penaltyShootout: 0,
      redCards: 0,
      yellowCards: 0,
      greenCards: 0,
      totalGoalScore: 0
    });

  } catch (err) {
    res.status(500).json({
      message: 'Error calculating tournament stats',
      error: err.message
    });
  }
});

app.get('/api/tournament/:tournamentId/points-table', async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const tournament = await AddTournament.findOne({ tournament_id: tournamentId });
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found.' });
    }

    const teams = await Teams.find({ tournament_id: tournament._id }).select('team_id team_name pool');
    const poolMap = new Map();

    for (const team of teams) {
      const poolName = team?.pool?.name || 'Unassigned';
      if (!poolMap.has(poolName)) {
        poolMap.set(poolName, {
          pool_name: poolName,
          teams: []
        });
      }
      poolMap.get(poolName).teams.push({
        team_id: team.team_id,
        team_name: team.team_name,
        played: 0,
        won: 0,
        draw: 0,
        lost: 0,
        scored_for: 0,
        scored_against: 0,
        goal_diff: 0,
        points: 0,
        results: []
      });
    }

    const teamToPool = new Map();
    for (const [poolName, poolData] of poolMap.entries()) {
      for (const t of poolData.teams) {
        teamToPool.set((t.team_name || '').trim().toLowerCase(), poolName);
      }
    }

    const matches = await MatchLive.find({ tournament_id: tournamentId }).select(
      'team1_name team2_name team1_score team2_score status match_date match_time'
    );

    const completedMatches = matches
      .filter((m) => {
        const status = String(m.status || '').toLowerCase();
        if (status.includes('live') || status.includes('upcoming') || status.includes('pending') || status.includes('scheduled')) {
          return false;
        }
        return Number.isFinite(Number(m.team1_score)) && Number.isFinite(Number(m.team2_score));
      })
      .sort((a, b) => {
        const da = Date.parse(`${a.match_date || ''}T${a.match_time || '00:00'}`) || 0;
        const db = Date.parse(`${b.match_date || ''}T${b.match_time || '00:00'}`) || 0;
        return da - db;
      });

    const getTeamRow = (poolName, teamName) => {
      const pool = poolMap.get(poolName);
      if (!pool) return null;
      const key = (teamName || '').trim().toLowerCase();
      return pool.teams.find((t) => (t.team_name || '').trim().toLowerCase() === key) || null;
    };

    for (const match of completedMatches) {
      const homeName = String(match.team1_name || '').trim();
      const awayName = String(match.team2_name || '').trim();
      const homeKey = homeName.toLowerCase();
      const awayKey = awayName.toLowerCase();
      const homePool = teamToPool.get(homeKey);
      const awayPool = teamToPool.get(awayKey);

      if (!homePool || !awayPool || homePool !== awayPool) continue;

      const home = getTeamRow(homePool, homeName);
      const away = getTeamRow(awayPool, awayName);
      if (!home || !away) continue;

      const homeScore = Number(match.team1_score) || 0;
      const awayScore = Number(match.team2_score) || 0;

      home.played += 1;
      away.played += 1;
      home.scored_for += homeScore;
      home.scored_against += awayScore;
      away.scored_for += awayScore;
      away.scored_against += homeScore;

      if (homeScore > awayScore) {
        home.won += 1;
        home.points += 3;
        away.lost += 1;
        home.results.push('W');
        away.results.push('L');
      } else if (awayScore > homeScore) {
        away.won += 1;
        away.points += 3;
        home.lost += 1;
        home.results.push('L');
        away.results.push('W');
      } else {
        home.draw += 1;
        away.draw += 1;
        home.points += 1;
        away.points += 1;
        home.results.push('D');
        away.results.push('D');
      }

      home.goal_diff = home.scored_for - home.scored_against;
      away.goal_diff = away.scored_for - away.scored_against;
    }

    const pools = Array.from(poolMap.values()).map((pool) => {
      const sortedTeams = pool.teams.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goal_diff !== a.goal_diff) return b.goal_diff - a.goal_diff;
        if (b.scored_for !== a.scored_for) return b.scored_for - a.scored_for;
        if (b.won !== a.won) return b.won - a.won;
        return String(a.team_name).localeCompare(String(b.team_name));
      });

      const ranked = sortedTeams.map((t, index) => ({
        ...t,
        position: index + 1,
        results: t.results.slice(-5)
      }));

      return {
        pool_name: pool.pool_name,
        teams: ranked
      };
    });

    res.status(200).json({
      tournament_id: tournamentId,
      tournament_name: tournament.tournament_name,
      generated_at: new Date().toISOString(),
      pools
    });
  } catch (error) {
    console.error('Error generating points table:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});


app.get('/api/tournamentId/:tournamentId/matches', async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const matches = await Match.find({ tournament_id: tournamentId });
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/matchlive/:matchId", async (req, res) => {
  try {
    const { matchId } = req.params;
    console.log("📌 MatchId received in API:", matchId);

    // Try finding in MatchLive
    let matchLive = await MatchLive.findOne({
      match_id: mongoose.Types.ObjectId.isValid(matchId)
        ? new mongoose.Types.ObjectId(matchId)
        : matchId
    });

    if (matchLive) {
      console.log("✅ Found in MatchLive");
      return res.json(matchLive);
    }

    console.log("⚠️ Not found in MatchLive, checking Match collection...");

    // If not found, try Match collection
    const match = await Match.findById(matchId);
    if (match) {
      console.log("✅ Found in Match collection");
      return res.json(match);
    }

    console.log("❌ Match not found in either collection");
    return res.status(404).json({ error: "Match not found" });

  } catch (err) {
    console.error("🔥 Error fetching match live data:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// POST METHOD FOR ADD USER
app.post("/api/users", async (req, res) => {
  try {
    const {
      full_name,
      email,
      date_of_birth,
      gender,
      phone_number,
      address,
      zip,
      position,
      jersey_number,
      player_bio,
      profile_pic,
    } = req.body;

    // --- Basic input validation ---
    if (!full_name || full_name.length < 2) {
      return res.status(400).json({
        error:
          "Full name must be at least 2 characters long to generate user ID.",
      });
    }
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }
    // Add more validation as needed (e.g., email format, password strength)
    if(!phone_number){
      return res.status(400).json({error: "phone number is required."});
    }

    //  Explicitly check if phone number already exists
    const existingPhone = await User.findOne({ phone_number });
    if (existingPhone) {
      return res.status(409).json({
        error: "This phone number is already registered.",
      });
    }

    // --- Generate user_id ---
    const prefix = full_name.substring(0, 2).toLowerCase(); // Get first two letters, lowercase

    // Find the latest user_id with the same prefix to ensure sequential IDs
    const lastUser = await User.findOne({
      user_id: new RegExp(`^${prefix}\\d+$`, "i"),
    })
      .sort({ user_id: -1 }) // Sort descending to get the highest number
      .exec();

    let nextNumber = 1;
    if (lastUser && lastUser.user_id) {
      const lastNumberMatch = lastUser.user_id.match(/\d+$/); // Extract numeric part
      if (lastNumberMatch) {
        nextNumber = parseInt(lastNumberMatch[0], 10) + 1;
      }
    }
    // Format with leading zeros (e.g., '01', '02')
    const user_id = `${prefix}${String(nextNumber).padStart(2, "0")}`;

    // --- Set join_date to current date (or let schema default handle it) ---
    // It's already set in the schema with `default: Date.now`, so explicitly setting here is redundant but harmless.
    const join_date = new Date();

    const newUser = new User({
      user_id,
      full_name,
      email,
      date_of_birth,
      gender,
      phone_number,
      address,
      zip,
      position,
      join_date,
      jersey_number,
      player_bio,
      profile_pic
    });

    await newUser.save();

    res
      .status(201)
      .json({ message: "User profile created successfully", user: newUser });
  } catch (error) {
    console.error("Error creating user:", error);
    // Handle specific MongoDB duplicate key error (code 11000)
    if (error.code === 11000) {
      let errorMessage = "A user with this data already exists.";
      if (error.keyPattern && error.keyPattern.email) {
        errorMessage =
          "This email is already registered. Please use a different email.";
      } 
      if(error.keyPattern && error.keyPattern.phone_number){
        errorMessage =
          "This phone number is already registered. Please try with different phone number";
      }
      else if (error.keyPattern && error.keyPattern.user_id) {
        errorMessage =
          "Generated user ID already exists. Please try again.";
      } 
      return res.status(409).json({ error: errorMessage });
    }
    res.status(500).json({ error: "Server error: Could not create user." });
  }
});

//PUT METHOD FOR NEW USER
app.put('/api/users/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;

    const allowedFields = [
      'full_name', 'email', 'date_of_birth', 'gender',
      'address', 'zip', 'position', 'jersey_number',
      'player_bio', 'profile_pic'
    ];

    const updateData = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update.' });
    }

    const updatedUser = await User.findOneAndUpdate(
      { user_id },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Error updating user:', error);
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Email already in use.' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// POST METHOD FOR ADD MATCH
app.post("/api/match", async (req, res) => {
  try {
    const {
      tournament_name, // Changed from tournament_id
      home_team_name, // Changed from home_team_id
      away_team_name, // Changed from away_team_id
      // rounds, //removed rounds in 21 nov
      match_type,
      city,
      venue,
      match_date,
      referee_name_one, // Assuming these are names, not IDs for simplicity
      referee_name_two,
      scorer_name,
      // home_score, away_score, winner_team_id are excluded as they'll be updated later
    } = req.body;
    console.log("Received request to add match:", req.body);
    // --- Fetch tournament_id from tournament_name ---
    if (!tournament_name) {
      return res.status(400).json({ error: "Tournament name is required." });
    }
    const tournament = await AddTournament.findOne({
      tournament_name: tournament_name,
    });
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found." });
    }
    const tournament_id = tournament.tournament_id;

    // --- Fetch home_team_id from home_team_name ---
    if (!home_team_name) {
      return res.status(400).json({ error: "Home team name is required." });
    }
    const homeTeam = await Teams.findOne({ team_name: home_team_name });
    if (!homeTeam) {
      return res
        .status(404)
        .json({ error: `Home team "${home_team_name}" not found.` });
    }
    const home_team_id = homeTeam.team_id;

    // --- Fetch away_team_id from away_team_name ---
    if (!away_team_name) {
      return res.status(400).json({ error: "Away team name is required." });
    }
    const awayTeam = await Teams.findOne({ team_name: away_team_name });
    if (!awayTeam) {
      return res
        .status(404)
        .json({ error: `Away team "${away_team_name}" not found.` });
    }
    const away_team_id = awayTeam.team_id;

    // --- Generate match_id ---
    const homePrefix = home_team_name.substring(0, 3).toLowerCase();
    const awayPrefix = away_team_name.substring(0, 3).toLowerCase();

    // Find the latest match_id with the same prefix combination
    const lastMatch = await Match.findOne({
      match_id: new RegExp(`^${homePrefix}${awayPrefix}\\d+$`, "i"),
    })
      .sort({ match_id: -1 })
      .exec();

    let nextNumber = 1;
    if (lastMatch && lastMatch.match_id) {
      const lastNumberMatch = lastMatch.match_id.match(/\d+$/);
      if (lastNumberMatch) {
        nextNumber = parseInt(lastNumberMatch[0], 10) + 1;
      }
    }
    const match_id = `${homePrefix}${awayPrefix}${String(nextNumber).padStart(
      2,
      "0"
    )}`;

    const newMatch = new Match({
      match_id,
      tournament_id,
      // rounds,
      home_team_name,
      away_team_name,
      match_type,
      city,
      venue,
      match_date,
      referee_name_one,
      referee_name_two,
      scorer_name,
      // home_score and away_score will default to 0 as per schema definition
      // winner_team_id will be undefined initially
    });

    await newMatch.save();

    res
      .status(201)
      .json({ message: "Match created successfully", match: newMatch });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      // Duplicate key error
      return res.status(409).json({
        error:
          "A match with this ID already exists. Please try again or adjust team names.",
      });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// POST METHOD FOR ADD MATCH LIVE (create a live match record for a tournament)
// app.post("/api/:tournamentname/addMatchLive", async (req, res) => {
//   try {
//     const { tournamentname } = req.params;

//     if (!tournamentname) {
//       return res.status(400).json({ error: "Tournament name is required in the URL." });
//     }

//     // verify tournament exists
//     const tournament = await AddTournament.findOne({
//       tournament_name: tournamentname,
//     });
//      if (!tournament) {
//       return res.status(404).json({ error: "Tournament not found." });
//     }

//     // Accept either team1/team2 or home/away naming
//     let {
//       team1_name,
//       team2_name,
//       home_team_name,
//       away_team_name,
//       venue,
//       match_date,
//       match_time,
//       team1_players = [],
//       team2_players = [],
//       match_id,
//     } = req.body;

//     team1_name = team1_name || home_team_name;
//     team2_name = team2_name || away_team_name;

//     if (!team1_name || !team2_name) {
//       return res.status(400).json({ error: "Both team names are required." });
//     }

//     // verify both teams exist in this tournament
//     const team1 = await Teams.findOne({ team_name: team1_name, tournament_id: tournament._id });
//     if (!team1) {
//       return res.status(404).json({ error: `Team "${team1_name}" not found in this tournament.` });
//     }
//     const team2 = await Teams.findOne({ team_name: team2_name, tournament_id: tournament._id });
//     if (!team2) {
//       return res.status(404).json({ error: `Team "${team2_name}" not found in this tournament.` });
//     }

//     // generate match_id if not provided
//     if (!match_id) {
//       const homePrefix = team1_name.substring(0, 3).toLowerCase();
//       const awayPrefix = team2_name.substring(0, 3).toLowerCase();

//       const lastMatch = await MatchLive.findOne({
//         match_id: new RegExp(`^${homePrefix}${awayPrefix}\\d+$`, "i"),
//       })
//         .sort({ match_id: -1 })
//         .exec();

//       let nextNumber = 1;
//       if (lastMatch && lastMatch.match_id) {
//         const lastNumberMatch = lastMatch.match_id.match(/\d+$/);
//         if (lastNumberMatch) {
//           nextNumber = parseInt(lastNumberMatch[0], 10) + 1;
//         }
//       }
//       match_id = `${homePrefix}${awayPrefix}${String(nextNumber).padStart(2, "0")}`;
//     } else {
//       // ensure uniqueness
//       const exists = await MatchLive.findOne({ match_id });
//       if (exists) {
//         return res.status(409).json({ error: "A MatchLive with this match_id already exists." });
//       }
//     }

//     const newMatchLive = new MatchLive({
//       match_id,
//       tournament_id: tournament.tournament_id,
//       team1_id: team1.team_id,
//       team2_id: team2.team_id,
//       team1_name,
//       team2_name,
//       venue,
//       match_date,
//       match_time,
//       team1_players,
//       team2_players,
//       updated_at: new Date(),
//     });

//     await newMatchLive.save();

//     // emit to sockets so frontends can react
//     io.emit("matchLiveAdded", newMatchLive);

//     res.status(201).json({ message: "MatchLive created successfully", matchLive: newMatchLive });
//   } catch (error) {
//     console.error("Error creating MatchLive:", error);
//     if (error.code === 11000) {
//       return res.status(409).json({ error: "Duplicate match_id" });
//     }
//     res.status(500).json({ error: "Server error" });
//   }
// });


// POST METHOD FOR ADD MATCH LIVE
app.post("/api/:tournamentname/addMatchLive", async (req, res) => {
  try {
    const { tournamentname } = req.params;

    // 1️⃣ Find tournament
    const tournament = await AddTournament.findOne({
      tournament_name: tournamentname,
    });

    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    let {
      team1_name,
      team2_name,
      home_team_name,
      away_team_name,
      venue,
      match_date,
      match_time,
      match_id,
    } = req.body;

    team1_name = team1_name || home_team_name;
    team2_name = team2_name || away_team_name;

    if (!team1_name || !team2_name) {
      return res.status(400).json({ error: "Both team names are required" });
    }

    // 2️⃣ Fetch teams WITH players populated
    const team1 = await Teams.findOne({
      team_name: team1_name,
      tournament_id: tournament._id,
    }).populate("players", "user_id name");

    const team2 = await Teams.findOne({
      team_name: team2_name,
      tournament_id: tournament._id,
    }).populate("players", "user_id name");

    if (!team1 || !team2) {
      return res.status(404).json({ error: "Team not found in tournament" });
    }

      // 2️⃣ Fetch players from TeamMembers
    const team1Members = await TeamMembers.find({ team_id: team1.team_id });
    const team2Members = await TeamMembers.find({ team_id: team2.team_id });

    if (!team1Members.length || !team2Members.length) {
      return res.status(400).json({
        error: "One or both teams have no players"
      });
    }

    // 3️⃣ Convert to MatchLive format
    const team1_players = team1Members.map(p => ({
      player_id: p.user_id,
      player_name: p.name
    }));

    const team2_players = team2Members.map(p => ({
      player_id: p.user_id,
      player_name: p.name
    }));

    // 4️⃣ Generate match_id if not provided
    if (!match_id) {
      const h = team1_name.slice(0, 3).toLowerCase();
      const a = team2_name.slice(0, 3).toLowerCase();

      const lastMatch = await MatchLive.findOne({
        match_id: new RegExp(`^${h}${a}\\d+$`, "i"),
      }).sort({ match_id: -1 });

      let next = 1;
      if (lastMatch?.match_id) {
        const n = lastMatch.match_id.match(/\d+$/);
        if (n) next = parseInt(n[0]) + 1;
      }

      match_id = `${h}${a}${String(next).padStart(2, "0")}`;
    }

    // 5️⃣ Create MatchLive
    const matchLive = new MatchLive({
      match_id,
      tournament_id: tournament.tournament_id.toString(),

      team1_name,
      team2_name,
      venue,
      match_date,
      match_time,

      team1_id: team1.team_id,
      team2_id: team2.team_id,

      team1_players,
      team2_players,

      updated_at: new Date(),
    });

    await matchLive.save();

    io.emit("matchLiveAdded", matchLive);

    res.status(201).json({
      message: "MatchLive created with players fetched from teams",
      matchLive,
    });

  } catch (err) {
    console.error("Add MatchLive error:", err);
    res.status(500).json({ error: "Server error" });
  }
});



// DELETE METHOD FOR MATCHES
app.delete("/api/matches/:matchId", async (req, res) => {
  try {
    const { matchId } = req.params;

    if (!matchId) {
      return res.status(400).json({ error: "Match ID is required." });
    }

    const match = await MatchLive.findOne({ match_id: matchId });
    if (!match) {
      return res.status(404).json({ error: "Match not found." });
    }

    // Proceed to delete
    await MatchLive.findOneAndDelete({ match_id: matchId });

    // Emit socket event to notify clients
    io.emit("matchDeleted", { match_id: matchId });

    res.status(200).json({
      message: "Match deleted successfully",
      deleted_match_id: matchId
    });
  } catch (error) {
    console.error("Error deleting match:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET user by phone number to autofill organizer name
app.get("/api/users/phone/:phone_number", async (req, res) => {
  try {
    const { phone_number } = req.params;
    const user = await User.findOne({ phone_number });

    if (!user) {
      return res.status(404).json({ error: "No user found with this phone number." });
    }

    res.status(200).json({
      user_id: user.user_id,
      full_name: user.full_name,
      phone_number: user.phone_number
    });
  } catch (error) {
    console.error("Error fetching user by phone:", error);
    res.status(500).json({ error: "Server error while fetching user." });
  }
});


app.get("/api/team/:team_id", async (req, res) => {
  try {
    const { team_id } = req.params;
    if (!team_id) {
      return res.status(400).json({ error: "Team ID is missing from the URL." });
    }

    const team = await Teams.findOne({ team_id }).select("-__v");
    if (!team) {
      return res.status(404).json({ error: `Team with ID "${team_id}" not found.` });
    }

    res.status(200).json(team);
  } catch (error) {
    console.error("Error fetching team:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// POST METHOD FOR ADD TOURNAMENTS
app.post("/api/addtournaments", async (req, res) => {
  try {
    console.log("Received request to add tournament:", req.body);
    const {
      tournament_name,
      start_date,
      end_date,
      location,
      organizer_id,
      format,
      tournament_category,
      match_type,
      ground_type,
    } = req.body;

    // --- Generate tournament_id ---
    const prefix = "TOUR";
    // Find the latest tournament_id to determine the next counter
    const lastTournament = await AddTournament.findOne({
      tournament_id: new RegExp(`^${prefix}\\d+$`, "i"),
    })
      .sort({ tournament_id: -1 }) // Sort descending to get the highest number
      .exec();

    let nextNumber = 1;
    if (lastTournament && lastTournament.tournament_id) {
      const lastNumberMatch = lastTournament.tournament_id.match(/\d+$/); // Extract numeric part
      if (lastNumberMatch) {
        nextNumber = parseInt(lastNumberMatch[0], 10) + 1;
      }
    }
    const tournament_id = `${prefix}${String(nextNumber).padStart(3, "0")}`; // Format with leading zeros (e.g., '001', '010')

    const newTournament = new AddTournament({
      tournament_id, // Auto-generated ID
      tournament_name,
      start_date,
      end_date,
      location,
      organizer_id,
      format,
      tournament_category,
      match_type,
      ground_type,
    });
    console.log("New tournament object:", newTournament);

    await newTournament.save();

    res.status(201).json({
      message: "Tournament created successfully",
      tournament: newTournament,
    });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      // Duplicate key error for tournament_id
      return res.status(409).json({
        error: "A tournament with this ID already exists. Please try again.",
      });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// PUT METHOD FOR UPDATE TOURNAMENTS
app.put("/api/tournaments/:tournament_id", async (req, res) => {
  try {
    const { tournament_id } = req.params;

    // ✅ Allowed fields only
    const allowedFields = ["tournament_name", "start_date", "end_date"];

    // ✅ Filter request body
    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // ❌ No valid fields provided
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: "Only tournament_name, start_date, end_date can be updated."
      });
    }

    const updatedTournament = await AddTournament.findOneAndUpdate(
      { tournament_id },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedTournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    res.status(200).json({
      message: "Tournament updated successfully",
      tournament: updatedTournament
    });
  } catch (error) {
    console.error("Error updating tournament:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE METHOD FOR TOURNAMENTS
app.delete("/api/tournaments/:tournament_id", async (req, res) => {
  try {
    const { tournament_id } = req.params;

    if (!tournament_id) {
      return res.status(400).json({ error: "Tournament ID is required." });
    }

    // Find the tournament
    const tournament = await AddTournament.findOne({ tournament_id });
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found." });
    }

    // Check for related teams
    const relatedTeams = await Teams.find({ tournament_id: tournament._id });
    if (relatedTeams.length > 0) {
      return res.status(409).json({
        error: "Cannot delete tournament. It has associated teams. Please delete teams first."
      });
    }

    // Check for related match lives
    const relatedMatches = await MatchLive.find({ tournament_id: tournament.tournament_id });
    if (relatedMatches.length > 0) {
      return res.status(409).json({
        error: "Cannot delete tournament. It has associated matches. Please delete matches first."
      });
    }

    // Proceed to delete
    await AddTournament.findOneAndDelete({ tournament_id });

    res.status(200).json({
      message: "Tournament deleted successfully",
      deleted_tournament_id: tournament_id
    });
  } catch (error) {
    console.error("Error deleting tournament:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// POST METHOD FOR ADD TEAMS
app.post("/api/tournament/:tournament_id/team", async (req, res) => {
  try {
    // Extract tournament_id from URL parameters
    const { tournament_id } = req.params;
    const { team_name, city, logo_url } = req.body; // --- Validate tournament_id from URL ---
   // console.log("Received request to add team:", req.body);

    if (!tournament_id) {
      return res
        .status(400)
        .json({ error: "Tournament ID is missing from the URL." });
    } // Verify if the provided tournament_id actually exists

    const tournaments = await AddTournament.findOne({
      tournament_id: tournament_id,
      
    });
     
   // console.log("Tournament exists:", tournaments);
    if (!tournaments) {
      return res
        .status(404)
        .json({ error: `Tournament with ID "${tournament_id}" not found.` });
    } // Basic validation for team_name and city

    if (!team_name || team_name.trim() === "") {
      return res.status(400).json({ error: "Team name is required." });
    }
    if (!city || city.trim() === "") {
      return res.status(400).json({ error: "City is required." });
    } // --- Generate team_id ---

    const prefix = "T"; // Find the latest team_id to determine the next counter globally
    const lastTeam = await Teams.findOne({
      team_id: new RegExp(`^${prefix}\\d+$`, "i"),
    })
      .sort({ team_id: -1 })
      .exec();

    let nextNumber = 1;
    if (lastTeam && lastTeam.team_id) {
      const lastNumberMatch = lastTeam.team_id.match(/\d+$/);
      if (lastNumberMatch) {
        nextNumber = parseInt(lastNumberMatch[0], 10) + 1;
      }
    }
    const team_id = `${prefix}${String(nextNumber).padStart(3, "0")}`; // Format with leading zeros (e.g., 'T001', 'T010')
    // console.log("Generate tour:", tournaments);
     //console.log("Generate teamer_id:", tournament_id);
    const newTeam = new Teams({
      team_id, // Auto-generated
     tournament_id: tournaments._id, // Fetched from URL
      team_name,
      location: city,
      logo_url,
    });
   // console.log("New team object:", newTeam);
    await newTeam.save();
    
    res.status(201).json({ message: "Team added successfully", team: newTeam });
  } catch (error) {
    console.error("Error adding team:", error);
    if (error.code === 11000) {
      // Duplicate key error for team_id or team_name
      let errorMessage = "A team with this data already exists.";
      if (error.keyPattern && error.keyPattern.team_name) {
        errorMessage =
          "A team with this name already exists. Please choose a different name.";
      } else if (error.keyPattern && error.keyPattern.team_id) {
        errorMessage =
          "Generated team ID already exists. Please try again (rare conflict).";
      }
      return res.status(409).json({ error: errorMessage });
    }
    res.status(500).json({ error: "Server error: Could not add team." });
  }
});

// PUT METHOD FOR UPDATING TEAM NAME
app.put("/api/teams/:team_id", async (req, res) => {
  try {
    const { team_id } = req.params;
    const { team_name } = req.body;

    if (!team_id) {
      return res.status(400).json({ error: "Team ID is required." });
    }

    if (!team_name || team_name.trim() === "") {
      return res.status(400).json({ error: "Team name is required." });
    }

    // Find and update the team
    const updatedTeam = await Teams.findOneAndUpdate(
      { team_id },
      { team_name: team_name.trim() },
      { new: true, runValidators: true }
    );

    if (!updatedTeam) {
      return res.status(404).json({ error: "Team not found." });
    }

    res.status(200).json({
      message: "Team name updated successfully",
      team: updatedTeam
    });
  } catch (error) {
    console.error("Error updating team:", error);
    if (error.code === 11000) {
      return res.status(409).json({ error: "A team with this name already exists." });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE METHOD FOR TEAMS
app.delete("/api/teams/:team_id", async (req, res) => {
  try {
    const { team_id } = req.params;

    if (!team_id) {
      return res.status(400).json({ error: "Team ID is required." });
    }

    // Find the team
    const team = await Teams.findOne({ team_id });
    if (!team) {
      return res.status(404).json({ error: "Team not found." });
    }

    // Check for related team members
    // const relatedMembers = await TeamMembers.find({ team_id: team.team_id });
    // if (relatedMembers.length > 0) {
    //   return res.status(409).json({
    //     error: "Cannot delete team. It has associated members. Please remove members first."
    //   });
    // }

    // Check for related matches (team1_id or team2_id)
    // const relatedMatches = await MatchLive.find({
    //   $or: [{ team1_id: team.team_id }, { team2_id: team.team_id }]
    // });
    // if (relatedMatches.length > 0) {
    //   return res.status(409).json({
    //     error: "Cannot delete team. It has associated matches. Please delete matches first."
    //   });
    // }

    // Proceed to delete
    await Teams.findOneAndDelete({ team_id });

    res.status(200).json({
      message: "Team deleted successfully",
      deleted_team_id: team_id
    });
  } catch (error) {
    console.error("Error deleting team:", error);
    res.status(500).json({ error: "Server error" });
  }
});

//  POST METHOD FOR ADDING TEAM MEMBERS
app.post("/api/teams/:team_id/members", async (req, res) => {
  try {
    const { team_id } = req.params; // Get team_id from the URL
    const { phone_number, role } = req.body; // Get phone_number and role from the request body

    // 1. Validate incoming data
    if (!phone_number || phone_number.trim() === "") {
      return res.status(400).json({ error: "Phone number is required." });
    }

    // 2. Validate if the team_id exists
    // The issue is here: You were querying by team_name using team_id from the URL.
    // Instead, query by the actual team_id.
    const team = await Teams.findOne({ team_id: team_id }); 
    if (!team) {
      return res.status(404).json({ error: `Team "${team_id}" not found.` });
    }

    // 3. Search for the user in the User collection by phone number
    const user = await User.findOne({ phone_number: phone_number });

    if (!user) {
      return res
        .status(404)
        .json({ error: "User not found with this phone number." });
    }

    // 4. Check if the user is already a member of this specific team
    const existingMember = await TeamMembers.findOne({
      team_id: team.team_id, // Use the actual team_id from the Teams collection
      user_id: user.user_id,
    });

    if (existingMember) {
      return res
        .status(409)
        .json({ error: "This user is already a member of this team." });
    }

    // 5. Create a new TeamMember entry
    const newTeamMember = new TeamMembers({
      team_id: team.team_id, // Use the actual team's ID
      user_id: user.user_id, // Get user_id from the found user
      phone_number: user.phone_number, // Get phone_number from the found user
      role: role || 'Player', // Use provided role or default to 'Player'
      name: user.full_name, // Get name from the found user (full_name in User model)
      profile_pic: user.profile_pic, // Get profile_pic from the found user
    });

    await newTeamMember.save();

    res.status(201).json({
      message: "Team member added successfully",
      member: newTeamMember,
    });
  } catch (error) {
    console.error("Error adding team member:", error);
    if (error.code === 11000) {
      // Duplicate key error, specifically for phone_number if it's unique in TeamMembersSchema
      return res.status(409).json({
        error: "A member with this phone number already exists in this team.",
      });
    }
    res.status(500).json({ error: "Server error: Could not add team member." });
  }
});

// Helper: block member removal once team has started any match
async function hasTeamStartedAnyMatch(team) {
  const teamId = team?.team_id;
  const teamName = team?.team_name;

  const startedStatusRegex = /(live|finish|complete|progress)/i;

  const liveMatchFilter = {
    $and: [
      {
        $or: [
          { team1_id: teamId },
          { team2_id: teamId },
          { team1_name: teamName },
          { team2_name: teamName }
        ]
      },
      {
        $or: [
          { status: startedStatusRegex },
          { team1_score: { $gt: 0 } },
          { team2_score: { $gt: 0 } }
        ]
      }
    ]
  };

  const legacyMatchFilter = {
    $and: [
      {
        $or: [
          { home_team_id: teamId },
          { away_team_id: teamId },
          { home_team_name: teamName },
          { away_team_name: teamName }
        ]
      },
      {
        $or: [
          { status: startedStatusRegex },
          { home_score: { $gt: 0 } },
          { away_score: { $gt: 0 } }
        ]
      }
    ]
  };

  const [liveMatch, legacyMatch] = await Promise.all([
    MatchLive.findOne(liveMatchFilter).select("_id").lean(),
    Match.findOne(legacyMatchFilter).select("_id").lean()
  ]);

  return !!(liveMatch || legacyMatch);
}

function buildMemberLookupConditions(memberKey) {
  const conditions = [{ user_id: memberKey }];
  if (mongoose.Types.ObjectId.isValid(memberKey)) {
    conditions.push({ _id: new mongoose.Types.ObjectId(memberKey) });
  }
  return conditions;
}

async function removeTeamMember(req, res) {
  try {
    const { team_id } = req.params;
    const memberKey =
      req.params.member_id ||
      req.body?.member_id ||
      req.body?.memberId ||
      req.body?.user_id ||
      req.body?.userId ||
      req.query?.member_id ||
      req.query?.memberId ||
      req.query?.user_id ||
      req.query?.userId;

    if (!team_id) {
      return res.status(400).json({ error: "Team ID is required." });
    }

    if (!memberKey) {
      return res.status(400).json({ error: "Member ID or user ID is required." });
    }

    const team = await Teams.findOne({ team_id });
    if (!team) {
      return res.status(404).json({ error: `Team with ID "${team_id}" not found.` });
    }

    const started = await hasTeamStartedAnyMatch(team);
    if (started) {
      return res.status(409).json({
        error: "Player removal is locked because this team has started a match."
      });
    }

    const member = await TeamMembers.findOne({
      team_id,
      $or: buildMemberLookupConditions(String(memberKey))
    });

    if (!member) {
      return res.status(404).json({ error: "Member not found in this team." });
    }

    await TeamMembers.deleteOne({ _id: member._id });

    return res.status(200).json({
      message: "Team member removed successfully.",
      removed_member_id: member._id,
      removed_user_id: member.user_id
    });
  } catch (error) {
    console.error("Error removing team member:", error);
    return res.status(500).json({ error: "Server error: Could not remove team member." });
  }
}

// DELETE member by route param (canonical)
app.delete("/api/team/:team_id/members/:member_id", removeTeamMember);
app.delete("/api/teams/:team_id/members/:member_id", removeTeamMember);

// DELETE member by body/query fallback (frontend compatibility)
app.delete("/api/team/:team_id/members", removeTeamMember);
app.delete("/api/teams/:team_id/members", removeTeamMember);

app.get("/api/tournaments/:tournament_id", async (req, res) => {
  try {
    const { tournament_id } = req.params; // Extract match_id from URL parameters
    const tournament = await AddTournament.findOne({
      tournament_id: tournament_id,
    });
    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }
    res.status(200).json(tournament); // Send the found match as JSON
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});
app.get("/api/tournaments", async (req, res) => {
  try {
    const tournaments = await AddTournament.find({});
    res.status(200).json(tournaments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

//PUT METHOD FOR UPDATING POOL INFORMATION
app.put("/api/:tournament_id/pool", async (req, res) => {
  try {
    const { tournament_id } = req.params;
    const { pool_name, pool_type, teams } = req.body;

    if (!pool_name || !pool_type || !Array.isArray(teams)) {
      return res.status(400).json({
        error: "Pool name, pool type and teams array are required."
      });
    }

    // Find tournament
    const tournament = await AddTournament.findOne({ tournament_id });
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found." });
    }

    // Incoming selected team IDs
    const selectedTeamIds = teams.map(t => t.team_id);

    // 1️⃣ Get teams already assigned to this pool
    const existingPoolTeams = await Teams.find({
      tournament_id: tournament._id,
      "pool.name": pool_name
    });

    const existingTeamIds = existingPoolTeams.map(t => t.team_id);

    // 2️⃣ Find deselected teams
    const deselectedTeamIds = existingTeamIds.filter(
      id => !selectedTeamIds.includes(id)
    );

    // 3️⃣ Remove pool info from deselected teams
    if (deselectedTeamIds.length > 0) {
      await Teams.updateMany(
        {
          team_id: { $in: deselectedTeamIds },
          tournament_id: tournament._id
        },
        {
          $unset: { pool: "" },
          $set: { updated_at: new Date() }
        }
      );
    }

    // 4️⃣ Validate selected teams
    const teamsExist = await Teams.find({
      team_id: { $in: selectedTeamIds },
      tournament_id: tournament._id
    });

    if (teamsExist.length !== selectedTeamIds.length) {
      return res.status(400).json({
        error: "One or more teams are invalid or don't belong to this tournament."
      });
    }

    // 5️⃣ Assign pool to selected teams
    await Teams.updateMany(
      {
        team_id: { $in: selectedTeamIds },
        tournament_id: tournament._id
      },
      {
        $set: {
          pool: {
            name: pool_name,
            type: pool_type
          },
          updated_at: new Date()
        }
      }
    );

    res.status(200).json({
      message: "Pool updated successfully.",
      assigned_teams: selectedTeamIds,
      removed_teams: deselectedTeamIds,
      pool: {
        name: pool_name,
        type: pool_type
      }
    });

  } catch (error) {
    console.error("Error updating pool information:", error);
    res.status(500).json({ error: "Server error." });
  }
});


// app.put("/api/:tournament_id/pool", async (req, res) => {
//   try {
//     const { tournament_id } = req.params;
//     const { pool_name, pool_type, teams } = req.body;
//     console.log("Received pool creation request:", req.body);

//     // Validate request body
//     if (!pool_name || !pool_type || !teams || teams.length === 0) {
//       return res.status(400).json({
//         error: "Pool name, pool type and teams are required."
//       });
//     }

//     // Find the tournament
//     const tournament = await AddTournament.findOne({ tournament_id });
//     if (!tournament) {
//       return res.status(404).json({ error: "Tournament not found." });
//     }
//     console.log(113, tournament._id);
//   //  Check if the pool name already exists in this tournament
//     const existingPool = await Teams.findOne({
//       tournaments: tournament._id,
//       'pool.name': pool_name
//     });

//     if (existingPool) {
//       return res.status(400).json({
//         error: "Pool name must be unique within the tournament."
//       });
//     }

//     // Extract team IDs from the request
//     const team_ids = teams.map((team) => team.team_id);

//     // Validate that all teams exist and belong to the tournament
//     const teamsExist = await Teams.find({
//       team_id: { $in: team_ids },
//       tournament_id: tournament._id
//     });

//     if (teamsExist.length !== team_ids.length) {
//       return res.status(400).json({
//         error: "One or more teams are invalid or don't belong to this tournament."
//       });
//     }

//     // Update teams with pool information
//    const updateResult = await Teams.updateMany(
//   {
//     team_id: { $in: team_ids },
//     tournament_id: tournament._id
//   },
//   {
//     $set: {
//       pool: {
//         name: pool_name,
//         type: pool_type
//       },
//       updated_at: new Date()
//     }
//   }
// );
// console.log("Update result:", updateResult);

//     res.status(200).json({
//       message: "Teams updated with pool information successfully.",
//       updated_teams: team_ids,
//       pool: {
//         name: pool_name,
//         type: pool_type
//       }
//     });

//   } catch (error) {
//     console.error("Error updating pool information:", error);
//     res.status(500).json({ error: "Server error." });
//   }
// });

// DELETE METHOD FOR POOL
app.delete("/api/:tournament_id/pool", async (req, res) => {
  try {
    const { tournament_id } = req.params;
    const { pool_name } = req.body;

    // Validate request body
    if (!pool_name) {
      return res.status(400).json({
        error: "Pool name is required."
      });
    }

    // Find the tournament
    const tournament = await AddTournament.findOne({ tournament_id });
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found." });
    }

    // Remove pool from teams in this tournament with the specified pool name
    const updateResult = await Teams.updateMany(
      {
        tournament_id: tournament._id,
        'pool.name': pool_name
      },
      {
        $unset: { pool: 1 },
        $set: { updated_at: new Date() }
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(404).json({ error: "Pool not found or no teams in this pool." });
    }

    res.status(200).json({
      message: "Pool deleted successfully.",
      deleted_pool: pool_name,
      affected_teams: updateResult.modifiedCount
    });

  } catch (error) {
    console.error("Error deleting pool:", error);
    res.status(500).json({ error: "Server error." });
  }
});

app.get("/api/tournaments/:tournament_id/add-list", async (req, res) => {
  try {
    const { tournament_id } = req.params;

    // Find the tournament
    const tournament = await AddTournament.findOne({ tournament_id });
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found." });
    }
    console.log(194, tournament._id);

    // Get all teams in this tournament with their pool information
    const teams = await Teams.find({ 
      tournament_id: tournament._id 
    }).select('team_id team_name city pool'); // Select only needed fields

    // Group teams by pool
    const poolGroups = teams.reduce((acc, team) => {
      if (team.pool && team.pool.name) {
        if (!acc[team.pool.name]) {
          acc[team.pool.name] = {
            name: team.pool.name,
            type: team.pool.type,
            teams: []
          };
        }
        acc[team.pool.name].teams.push({
          team_id: team.team_id,
          team_name: team.team_name,
          city: team.city
        });
      }
      return acc;
    }, {});
    console.log("Pool groups:", poolGroups);

    // Convert to array format
    const pools = Object.values(poolGroups);

    res.status(200).json({
      tournament_id: tournament_id,
      pools: pools,
      all_teams: teams.map(team => ({
        team_id: team.team_id,
        team_name: team.team_name,
        city: team.city,
        pool: team.pool
      }))
    });


  } catch (error) {
    console.error("Error fetching pool information:", error);
    res.status(500).json({ error: "Server error." });
  }
});


app.get("/api/:tournament_id/teams", async (req, res) => {
  try {
     const { tournament_id } = req.params;
    if (!tournament_id) {
      return res
        .status(400)
        .json({ error: "Tournament ID is missing from the URL." });
    } // Verify if the provided tournament_id actually exists

    const tournamentExists = await AddTournament.findOne({
      tournament_id: tournament_id,
    });
    //console.log("Tournament exists:", tournamentExists);
    if (!tournamentExists) {
      return res
        .status(404)
        .json({ error: `Tournament with ID "${tournament_id}" not found.` });
    }
    //console.log("Tournament exists:", tournamentExists._id);
const teams = await Teams.find({ tournament_id: tournamentExists._id });
//console.log("Teams found:", teams);
  res.status(200).json(teams);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/team/:team_id/members", async (req, res) => {
  try {
     const { team_id } = req.params;
    if (!team_id) {
      return res
        .status(400)
        .json({ error: "Team ID is missing from the URL." });
    } // Verify if the provided team_id actually exists

    const teamExists = await Teams.findOne({
      team_id: team_id,
    });

    console.log("Team exists:", teamExists); // Debug log to check if team is found
    if (!teamExists) {
      return res
        .status(404)
        .json({ error: `Team with ID "${team_id}" not found.` });
    }
  const members = await TeamMembers.find({ team_id: team_id });
  res.status(200).json(members);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/users/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params; // Extract match_id from URL parameters
    const user = await User.findOne({ user_id: user_id },
      {
        _id: 0,
        user_id: 1,
        full_name: 1,
        position: 1,
        profile_pic: 1,
        jersey_number: 1,
        player_bio: 1,
        player_stats: 1
      }
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user); // Send the found match as JSON
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Update timer state
app.post('/api/matches/:matchId/timer', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { totalSeconds, isPaused } = req.body;

    console.log("Incoming timer update:", { matchId, totalSeconds, isPaused });

    const match = await MatchLive.findOneAndUpdate(
      { match_id: matchId },
      { total_seconds: totalSeconds, is_paused: isPaused },
      //{ new: true }
    );

    if (!match) {
      console.log("Match not found for code:", matchId);
      return res.status(404).json({ error: "Match not found" });
    }

    // ✅ Emit snake_case globally
    io.emit("timerUpdated", {
      match_id: match.match_id,
      total_seconds: match.total_seconds,
      is_paused: match.is_paused,
      status: match.status
    });

    // 🔧 FIXED: Emit to specific room 
    io.to(matchId).emit("timerUpdated", {
      match_id: match.match_id,
      total_seconds: match.total_seconds,
      is_paused: match.is_paused,
      status: match.status
    });

    res.json(match);
  } catch (err) {
    console.error("Error updating timer:", err);
    res.status(500).json({ error: 'Failed to update timer' });
  }
});

// GET a specific match by ID (for the scorer page)
// This route now also fetches the team names
app.get("/api/matches/:matchId", async (req, res) => {
  try {
    const { matchId } = req.params;
    const match = await MatchLive.findOne({ match_id: matchId });
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    // Fetch full team details to get the team names
    const homeTeam = await Teams.findOne({ team_id: match.home_team_id });
    const awayTeam = await Teams.findOne({ team_id: match.away_team_id });
    
   
    // Combine everything into a single response object
    const responseData = {
      ...match.toObject(),
      home_team_name: homeTeam?.team_name,
      away_team_name: awayTeam?.team_name 
    };
       const tournamentName = await AddTournament.findOne({ tournament_id: match.tournament_id });
    if (tournamentName) {
      responseData.tournament_name = tournamentName.tournament_name;
    }
    console.log("Match details fetched:", responseData); // Debug log
   
  
    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching match:", error);
    res.status(500).json({ error: "Server error" });
  }
});


// NEW: API endpoint to update the score
// app.post("/api/matches/:matchId/score", async (req, res) => {
//   try {
//     const { matchId } = req.params;
//     const { teamName } = req.body;

//     const match = await Match.findOne({ match_id: matchId });
//     if (!match) {
//       return res.status(404).json({ message: "Match not found" });
//     }

//     // Find the team by name to determine which score to update
//     const homeTeam = await Teams.findOne({ team_id: match.home_team_id });
//     const awayTeam = await Teams.findOne({ team_id: match.away_team_id });

//     if (homeTeam && homeTeam.team_name === teamName) {
//         match.home_score = (match.home_score || 0) + 1;
//     } else if (awayTeam && awayTeam.team_name === teamName) {
//         match.away_score = (match.away_score || 0) + 1;
//     } else {
//         return res.status(400).json({ message: "Invalid team name provided." });
//     }
    
//     const updatedMatch = await match.save();
    
//     // Broadcast the update to all clients
//     io.emit("scoreUpdate", {
//       matchId,
//       homeScore: updatedMatch.home_score,
//       awayScore: updatedMatch.away_score,
//     });

//     res.status(200).json({ message: "Score updated successfully", match: updatedMatch });
//   } catch (error) {
//     console.error("Error updating score:", error);
//     res.status(500).json({ error: "Server error" });
//   }
// });


io.on("connection", (socket) => {
  console.log("A user connected");
  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// PUT - Update match date & time to current system date/time
app.put('/api/matches/:matchId/update-time', async (req, res) => {
  try {
    const { matchId } = req.params;

    const now = new Date();
    const formattedDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const formattedTime = now.toTimeString().slice(0, 5);  // HH:MM

    const updatedMatch = await MatchLive.findOneAndUpdate(
      { match_id: matchId },
      {
        match_date: formattedDate,
        match_time: formattedTime,
        updated_at: Date.now()
      },
      { new: true }
    );

    if (!updatedMatch) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json(updatedMatch);
  } catch (err) {
    console.error('Error updating match time:', err);
    res.status(500).json({ error: 'Failed to update match time' });
  }
});


app.get("/api/users/phone/:phone_number", async (req, res) => {
  try {
    console.log("Received request to get user by phone number:", req.params);
    const { phone_number } = req.params; // Extract phone_number from URL parameters
    const user = await User.findOne({ phone_number: phone_number });
     const users = await User.find(); 
     console.log("All users:", users); // Log all users for debugging
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user); // Send the found match as JSON
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// NEW: API endpoint to update the score
// app.post("/api/matches/:matchId/score", async (req, res) => {
//   const matchId = req.params.matchId;
//   const { teamName } = req.body;
  
//   try {
//     const match = await Match.findById(matchId);
//     if (!match) return res.status(404).json({ message: "Match not found" });

//     if (teamName === match.home_team_name) {
//       match.home_score += 1;
//     } else if (teamName === match.away_team_name) {
//       match.away_score += 1;
//     }
//     await match.save();

//     // ✅ Emit to dashboards
//     // io.emit("scoreUpdate", {
//     //   matchId,
//     //   homeScore: match.home_score,
//     //   awayScore: match.away_score
//     // });

//     res.json(match);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// Add a new event to a match
app.post('/api/matches/:matchId/events', async (req, res) => {
  try {
    const { matchId } = req.params;
    const event = req.body;

    console.log("📌 New event for match:", matchId, event);

    const match = await MatchLive.findOneAndUpdate(
      { match_id: matchId },
      { $push: { match_events: event } },
      //{ new: true }   // return updated doc
    );

    if (!match) {
      return res.status(404).json({ error: "Match not found" });
    }

    // ✅ Emit snake_case globally
    io.emit("eventAdded", {
      match_id: match.match_id,
      match_events: [event],
      status: match.status
    });

    // 🔧 FIXED: Emit to specific room
    io.to(matchId).emit("eventAdded", {
      match_id: match.match_id,
      event: event,
      match_events: match.match_events,
      status: match.status
    });

    res.json(match);
  } catch (err) {
    console.error("🔥 Error saving event:", err);
    res.status(500).json({ error: "Failed to save event" });
  }
});

// Update score when a goal is added
app.post('/api/matches/:matchId/score', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { teamName } = req.body;

    const match = await MatchLive.findOne({ match_id: matchId.trim() });
    if (!match) return res.status(404).json({ error: "Match not found" });

    if (teamName === match.team1_name) match.team1_score++;
    else if (teamName === match.team2_name) match.team2_score++;

    await match.save();

    // ✅ Emit in snake_case, global emit
    io.emit("scoreUpdated", {
      match_id: match.match_id,
      team1_score: match.team1_score,
      team2_score: match.team2_score,
      status: match.status
    });

    // 🔧 FIXED: Emit to specific room
    io.to(matchId).emit("scoreUpdated", {
      match_id: match.match_id,
      team1_score: match.team1_score,
      team2_score: match.team2_score,
      status: match.status
    });

    console.log("📡 Emitted scoreUpdated:", match.match_id, match.team1_score, match.team2_score);

    res.json(match);
  } catch (err) {
    console.error("🔥 Error updating score:", err);
    res.status(500).json({ error: "Failed to update score" });
  }
});

// 🔧 NEW: Update quarter
app.post('/api/matches/:matchId/quarter', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { currentQuarter } = req.body;

    const match = await MatchLive.findOneAndUpdate(
      { match_id: matchId },
      { current_quarter: currentQuarter },
      { new: true }
    );

    if (!match) {
      return res.status(404).json({ error: "Match not found" });
    }

    io.to(matchId).emit("quarterChanged", {
      match_id: match.match_id,
      current_quarter: match.current_quarter,
      status: match.status
    });

    res.json(match);
  } catch (err) {
    console.error("Error updating quarter:", err);
    res.status(500).json({ error: 'Failed to update quarter' });
  }
});


// 🔧 NEW: Update match status
app.post('/api/matches/:matchId/status', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { status } = req.body;

    const match = await MatchLive.findOneAndUpdate(
      { match_id: matchId },
      { status: status },
      { new: true }
    );

    if (!match) {
      return res.status(404).json({ error: "Match not found" });
    }

    io.to(matchId).emit("matchStatusChanged", {
      match_id: match.match_id,
      status: match.status
    });

    res.json(match);
  } catch (err) {
    console.error("Error updating match status:", err);
    res.status(500).json({ error: 'Failed to update match status' });
  }
});


// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("🔌 New client connected");

  // Join a room per match (so clients only get their match updates)
  socket.on("joinMatch", (matchId) => {
    socket.join(matchId);
    console.log(`✅ Client joined room for match ${matchId}`);
  });

  // 🔧 NEW: Leave match room
  socket.on("leaveMatch", (matchId) => {
    socket.leave(matchId);
    console.log(`❌ Client ${socket.id} left room for match ${matchId}`);
  });

  // Timer update
  socket.on("timerUpdate", ({ matchId, totalSeconds, isPaused, displayMinutes, displaySeconds }) => {
    console.log("Timer update:", { matchId, totalSeconds, isPaused });

    io.emit("timerUpdated", {
      match_id: matchId,
      total_seconds: totalSeconds,
      is_paused: isPaused,
      status: "Live"
    });

    // Broadcast to all clients in this match room
    io.to(matchId).emit("timerUpdated", {
      match_id: matchId,
      total_seconds: totalSeconds,
      is_paused: isPaused,
      display_minutes: displayMinutes,
      display_seconds: displaySeconds,
      status: "Live"
    });
  });

  // Event add
  socket.on("eventAdded", ({ matchId, event }) => {
    console.log("Event added:", { matchId, event });

    io.emit("eventAdded", {
      match_id: matchId,
      match_events: [event],
      status: "Live"
    });

    io.to(matchId).emit("eventAdded", {
      match_id: matchId,
      event: event,
      status: "Live"
    });
  });

  // Score update
  socket.on("scoreUpdated", ({ matchId, team1_score, team2_score }) => {
    console.log("Score update:", { matchId, team1_score, team2_score });

    // emit globally instead of io.to(matchId)
    io.emit("scoreUpdated", {
      match_id: matchId,
      team1_score: team1_score,
      team2_score: team2_score,
      status: "Live"
    });

    io.to(matchId).emit("scoreUpdated", {
      match_id: matchId,
      team1_score: team1_score,
      team2_score: team2_score,
      status: "Live"
    });
  });

  // 🔧 NEW: Handle quarter changes
  socket.on("quarterChanged", ({ matchId, currentQuarter }) => {
    console.log("Quarter changed from client:", { matchId, currentQuarter });

    io.to(matchId).emit("quarterChanged", {
      match_id: matchId,
      current_quarter: currentQuarter,
      status: "Live"
    });
  });

  // 🔧 NEW: Handle match status changes
  socket.on("matchStatusChanged", ({ matchId, status }) => {
    console.log("Match status changed from client:", { matchId, status });

    io.to(matchId).emit("matchStatusChanged", {
      match_id: matchId,
      status: status
    });
  });

  // 🔧 NEW: Handle complete match state updates
  socket.on("matchStateUpdate", (matchState) => {
    console.log("Complete match state update:", matchState.matchId);

    io.to(matchState.matchId).emit("matchStateUpdated", matchState);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected");
  });
});



// API To Send email for contact us page --> MAke sure 2FA is enabled
const nodemailer = require("nodemailer");
const AddTournament = require("./models/AddTournament");
const Teams = require("./models/Teams");
const TeamMembers = require("./models/TeamMembers");

app.post("/api/send-email", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // Configure transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // your gmail
        pass: process.env.EMAIL_PASS, // your gmail app password
      },
    });

    // Email options
    const mailOptions = {
      from: `"StickStats Contact" <${process.env.EMAIL_USER}>`,
      to: "stickstatsindia@gmail.com", // your email where you want to receive
      subject: `📩 New Contact Form Submission from ${name}`,
      text: `
        Name: ${name}
        Email: ${email}
        Message: ${message}
      `,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Message:</b> ${message}</p>
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Email sent successfully!" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: "Failed to send email." });
  }
});




const PORT = 3000;
console.log(`✅ MONGODB_URI=${process.env.MONGODB_URI}`);
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
