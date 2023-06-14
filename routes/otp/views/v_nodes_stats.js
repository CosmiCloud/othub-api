require('dotenv').config()
var express = require('express')
var router = express.Router()
const purl = require('url')
const queryTypes = require('../../../public/util/queryTypes')
const mysql = require('mysql')
const { DESTRUCTION } = require('dns')
const otp_connection = mysql.createConnection({
  host: process.env.DBHOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: 'otp'
})

router.get('/', async function (req, res) {
  url_params = purl.parse(req.url, true).query
  ip = req.socket.remoteAddress
  if (process.env.SSL_KEY_PATH) {
    ip = req.headers['x-forwarded-for']
  }

  res.setHeader('Access-Control-Allow-Origin', '*')

  if (!url_params.api_key) {
    console.log(`v_nodes_stats request without authorization.`)
    resp_object = {
      result: 'Authorization key not provided.'
    }
    res.send(resp_object)
    return
  }

  type = 'v_nodes_stats'
  api_key = url_params.api_key

  const apiSpamProtection = await queryTypes.apiSpamProtection()
  permission = await apiSpamProtection
    .getData(type, api_key)
    .then(async ({ permission }) => {
      return permission
    })
    .catch(error => console.log(`Error : ${error}`))

  if (permission == `no_user`) {
    console.log(`No user found for api key ${api_key}`)
    resp_object = {
      result: 'Unauthorized key provided.'
    }
    res.send(resp_object)
    return
  }

  if (permission == `block`) {
    console.log(`Request frequency limit hit from ${api_key}`)
    resp_object = {
      result:
        'Request blocked by spam protection. Only 1 request is allowed per 5 minutes without a premium authorization key.'
    }
    res.send(resp_object)
    return
  }

  limit = url_params.limit
  if (!limit) {
    limit = 500
  }

  if (limit > 2000) {
    limit = 2000
  }
  query = `SELECT nodeId,networkId,tokenName,TokenSymbol,nodeGroup,date,nodeStake,pubsCommited,pubsCommited_inclOutOfTop3,pubsCommited1stEpochOnly,pubsCommited1stEpochOnly_inclOutOfTop3,estimatedEarnings,cumulativeEstimatedEarnings,txFees,payouts,cumulativePayouts,ask FROM otp.v_nodes_stats`

  conditions = []
  params = []

  if (url_params.nodeId) {
    conditions.push(`nodeId = ?`)
    params.push(url_params.nodeId)
  }

  whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
  sqlQuery = query + ' ' + whereClause + ` order by date desc LIMIT ${limit}`

  console.log(sqlQuery)
  v_node_stats = []
  await otp_connection.query(sqlQuery, params, function (error, row) {
    if (error) {
      throw error
    } else {
      setValue(row)
    }
  })

  function setValue (value) {
    v_node_stats = value
    res.json(v_node_stats)
  }
})

module.exports = router
