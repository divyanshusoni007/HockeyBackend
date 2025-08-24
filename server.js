const User = require("./models/User");
const Match = require("./models/Match");
const AddTournament = require("./models/AddTournament");
const Teams = require("./models/Teams");
const TeamMembers = require("./models/TeamMembers");
const MatchEvent = require("./models/MatchEvent");

require("dotenv").config();

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());

const cors = require("cors");
app.use(cors());

const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});


// Replace with your local or Atlas URI
console.log("👉 Attempting to connect to MongoDB...");
console.log(`MONGODB_URI: ${process.env.MONGODB_URI}`);

mongoose
  .connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

app.get("/", (req, res) => {
  res.send("Hockey App Backend Running");
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
      .json({ message: "User created successfully", user: newUser });
  } catch (error) {
    console.error("Error creating user:", error);
    // Handle specific MongoDB duplicate key error (code 11000)
    if (error.code === 11000) {
      let errorMessage = "A user with this data already exists.";
      if (error.keyPattern && error.keyPattern.email) {
        errorMessage =
          "This email is already registered. Please use a different email.";
      } else if (error.keyPattern && error.keyPattern.user_id) {
        errorMessage =
          "Generated user ID already exists. Please try again (rare conflict).";
      }
      return res.status(409).json({ error: errorMessage });
    }
    res.status(500).json({ error: "Server error: Could not create user." });
  }
});

// POST METHOD FOR ADD MATCH
app.post("/api/match", async (req, res) => {
  try {
    const {
      tournament_name, // Changed from tournament_id
      home_team_name, // Changed from home_team_id
      away_team_name, // Changed from away_team_id
      rounds,
      match_type,
      city,
      venue,
      match_date,
      referee_name_one, // Assuming these are names, not IDs for simplicity
      referee_name_two,
      scorer_name,
      // home_score, away_score, winner_team_id are excluded as they'll be updated later
    } = req.body;

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
      rounds,
      home_team_id,
      away_team_id,
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


// POST METHOD FOR ADD TEAMS
app.post("/api/tournament/:tournament_id/team", async (req, res) => {
  try {
    // Extract tournament_id from URL parameters
    const { tournament_id } = req.params;
    const { team_name, city, logo_url } = req.body; // --- Validate tournament_id from URL ---

    if (!tournament_id) {
      return res
        .status(400)
        .json({ error: "Tournament ID is missing from the URL." });
    } // Verify if the provided tournament_id actually exists

    const tournamentExists = await AddTournament.findOne({
      tournament_id: tournament_id,
    });
    if (!tournamentExists) {
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

    const newTeam = new Teams({
      team_id, // Auto-generated
      tournament_id, // Fetched from URL
      team_name,
      city,
      logo_url,
    });

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

app.get("/api/teams", async (req, res) => {
  try {
    const teams = await Teams.find({});
    res.status(200).json(teams);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/users/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params; // Extract match_id from URL parameters
    const user = await User.findOne({ user_id: user_id });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user); // Send the found match as JSON
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});


// GET all matches for the dashboard
app.get("/api/matches", async (req, res) => {
  try {
    const matches = await Match.find({});
    res.status(200).json(matches);
  } catch (error) {
    console.error("Error fetching matches:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET a specific match by ID (for the scorer page)
// This route now also fetches the team names
app.get("/api/matches/:matchId", async (req, res) => {
  try {
    const { matchId } = req.params;
    const match = await Match.findOne({ match_id: matchId });
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
      away_team_name: awayTeam?.team_name,
    };

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching match:", error);
    res.status(500).json({ error: "Server error" });
  }
});


// NEW: API endpoint to update the score
app.post("/api/matches/:matchId/score", async (req, res) => {
  try {
    const { matchId } = req.params;
    const { teamName } = req.body;

    const match = await Match.findOne({ match_id: matchId });
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    // Find the team by name to determine which score to update
    const homeTeam = await Teams.findOne({ team_id: match.home_team_id });
    const awayTeam = await Teams.findOne({ team_id: match.away_team_id });

    if (homeTeam && homeTeam.team_name === teamName) {
        match.home_score = (match.home_score || 0) + 1;
    } else if (awayTeam && awayTeam.team_name === teamName) {
        match.away_score = (match.away_score || 0) + 1;
    } else {
        return res.status(400).json({ message: "Invalid team name provided." });
    }
    
    const updatedMatch = await match.save();
    
    // Broadcast the update to all clients
    io.emit("scoreUpdate", {
      matchId,
      homeScore: updatedMatch.home_score,
      awayScore: updatedMatch.away_score,
    });

    res.status(200).json({ message: "Score updated successfully", match: updatedMatch });
  } catch (error) {
    console.error("Error updating score:", error);
    res.status(500).json({ error: "Server error" });
  }
});


io.on("connection", (socket) => {
  console.log("A user connected");
  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
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

const PORT = 3000;
console.log(`✅ MONGODB_URI=${process.env.MONGODB_URI}`);
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
