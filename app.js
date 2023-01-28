const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server running at http://localhost:3000/  .....");
    });
  } catch (error) {
    console.log(error.message);
  }
};
initializer();

//login api

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userQuery = `
    SELECT * FROM user
    WHERE username='${username}'`;
  const user = await db.get(userQuery);
  if (user === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const pwMatched = await bcrypt.compare(password, user.password);
    if (pwMatched) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "secrete_token");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// middleware

const authorizer = (request, response, next) => {
  let token;
  const header = request.headers["authorization"];
  if (header !== undefined) {
    token = header.split(" ")[1];
  }
  if (token === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(token, "secrete_token", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

function convertState(state) {
  return {
    stateId: state.state_id,
    stateName: state.state_name,
    population: state.population,
  };
}
function convertDistrict(district) {
  return {
    districtId: district.district_id,
    districtName: district.district_name,
    stateId: district.state_id,
    cases: district.cases,
    cured: district.cured,
    active: district.active,
    deaths: district.deaths,
  };
}

//get states
app.get("/states/", authorizer, async (request, response) => {
  const getStatesQuery = `
    SELECT * FROM state`;
  const states = await db.all(getStatesQuery);
  const result = states.map(convertState);
  console.log(result);
  response.send(result);
});

//get one state
app.get("/states/:stateId/", authorizer, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    SELECT * FROM state
    WHERE state_id='${stateId}'`;
  const resultStates = await db.get(getStateQuery);
  response.send(convertState(resultStates));
});

//post district
app.post("/districts/", authorizer, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postQuery = `
        INSERT into district
        (district_name,state_id,cases,cured,active,deaths)
        VALUES('${districtName}',
               ${stateId},${cases},${cured},${active},${deaths})`;
  const resultDistrict = await db.run(postQuery);
  response.send("District Successfully Added");
});

//get one district
app.get("/districts/:districtId/", authorizer, async (request, response) => {
  const { districtId } = request.params;
  const getDistrictQuery = `
    SELECT * FROM district
    WHERE district_id='${districtId}'`;
  const resultDistrict = await db.get(getDistrictQuery);
  response.send(convertDistrict(resultDistrict));
});

//6 update district

app.delete("/districts/:districtId/", authorizer, async (request, response) => {
  const { districtId } = request.params;
  const getDistrictQuery = `
    DELETE FROM district
    WHERE district_id='${districtId}'`;
  const result = await db.get(getDistrictQuery);
  response.send("District Removed");
});

//7 update district
app.put("/districts/:districtId/", authorizer, async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postQuery = `
        UPDATE district
        SET district_name='${districtName}',
               state_id=${stateId},
               cases=${cases},
               cured=${cured},
               active=${active},
               deaths=${deaths}
        WHERE district_id=${districtId}`;
  const resultDistrict = await db.run(postQuery);
  response.send("District Details Updated");
});

//8
app.get("/states/:stateId/stats/", authorizer, async (request, response) => {
  const { stateId } = request.params;
  const getQuery = `
    SELECT 
        sum(cases) as totalCases,
        sum(cured) as totalCured,
        sum(active) as totalActive,
        sum(deaths) as totalDeaths
     FROM district
    WHERE state_id='${stateId}'`;
  const result = await db.get(getQuery);
  response.send(result);
});

module.exports = app;
