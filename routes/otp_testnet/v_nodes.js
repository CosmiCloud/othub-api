require("dotenv").config();
var express = require("express");
var router = express.Router();
const purl = require("url");
const queryTypes = require("../../util/queryTypes");
const mysql = require("mysql");
const otp_connection = mysql.createConnection({
  host: process.env.DBHOST,
  user: process.env.DBUSER,
  password: process.env.DBPASSWORD,
  database: process.env.SYNC_DB_TESTNET,
});

router.get("/", async function (req, res) {
  try {
    url_params = purl.parse(req.url, true).query;
    ip = req.socket.remoteAddress;
    if (process.env.SSL_KEY_PATH) {
      ip = req.headers["x-forwarded-for"];
    }

    type = "stats";
    data = req.body;
    api_key = req.headers["x-api-key"];

    if (!api_key || api_key === "") {
      console.log(`Create request without authorization.`);
      res.status(401).json({
        success: false,
        msg: "Authorization key not provided.",
      });
      return;
    }

    apiSpamProtection = await queryTypes.apiSpamProtection();

    permission = await apiSpamProtection
      .getData(type, api_key)
      .then(async ({ permission }) => {
        return permission;
      })
      .catch((error) => console.log(`Error : ${error}`));

    if (permission == `no_app`) {
      console.log(`No app found for api key ${api_key}`);
      res.status(401).json({
        success: false,
        msg: "Unauthorized key provided.",
      });
      return;
    }

    if (permission == `block`) {
      console.log(`Request frequency limit hit from ${api_key}`);
      res.status(429).json({
        success: false,
        msg: "The rate limit for this api key has been reached. Please upgrade your key to increase your limit.",
      });
      return;
    }

    limit = data.limit;
    if (!limit) {
      limit = 500;
    }

    query = `SELECT nodeId,networkId,tokenName,TokenSymbol,nodeGroup,createProfile_adminWallet,createProfile_adminWallet_hash,current_adminWallet_hashes, createProfile_blockNumber, createProfile_txHash, createProfile_ts, createProfile_date, nodeStake, nodeAsk FROM v_nodes`;
    conditions = [];
    params = [];

    if (data.nodeId) {
      conditions.push(`nodeId = ?`);
      params.push(data.nodeId);
    }

    whereClause =
      conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
    sqlQuery = query + " " + whereClause + `LIMIT ${limit}`;

    v_nodes = [];
    await otp_connection.query(sqlQuery, params, function (error, row) {
      if (error) {
        res.status(504).json({
          success: false,
          msg: "Error occured while querying for the data.",
        });
        return;
      } else {
        setValue(row);
      }
    });

    function setValue(value) {
      res.status(200).json({
        success: true,
        data: value,
      });
    }
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      msg: `Oops, something went wrong! Please try again later.`,
    });
  }
});

module.exports = router;
