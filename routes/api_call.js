var tools = require('../tools/tools.js')
var config = require('../config.json')
var request = require('request')
var express = require('express')
var router = express.Router()

/** /api_call **/
router.get('/', function (req, res) {
  //this is the Quickbook API call button route 
  var token = tools.getToken(req.session)
  if (!token) return res.json({ error: 'Not authorized' })
  if (!req.session.realmId) return res.json({
    error: 'No realm ID.  QBO calls only work if the accounting scope was passed!'
  })

  // Set up API call (with OAuth2 accessToken)
  //var query = '/query?query = Select * from Customer'
  // 'https://{{baseurl}}/v3/company/{{companyid}}/customer/1'

  //var query = '/customer/0'
  //var query = '/query'
  var url = config.api_uri + req.session.realmId + '/companyinfo/' + req.session.realmId
  //var url = config.api_uri + req.session.realmId + query
  console.log('Making API call to: ' + url)
  var requestObj = {
    url: url,
    headers: {
      'Authorization': 'Bearer ' + token.accessToken,
      'Accept': 'application/json'
    }
    //think I need to add a body here with whatever we want for call
  }

  // Make API call
  request(requestObj, function (err, response) {
    // Check if 401 response was returned - refresh tokens if so!
    tools.checkForUnauthorized(req, requestObj, err, response).then(function ({ err, response }) {
      if (err || response.statusCode != 200) {
        return res.json({ error: err, statusCode: response.statusCode })
      }

      // API Call was a success!
      res.json(JSON.parse(response.body))
    }, function (err) {
      console.log(err)
      return res.json(err)
    })
  })
})

/** /api_call/revoke **/
router.get('/revoke', function (req, res) {
  var token = tools.getToken(req.session)
  if (!token) return res.json({ error: 'Not authorized' })

  var url = tools.revoke_uri
  request({
    url: url,
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + tools.basicAuth,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      'token': token.accessToken
    })
  }, function (err, response, body) {
    if (err || response.statusCode != 200) {
      return res.json({ error: err, statusCode: response.statusCode })
    }
    tools.clearToken(req.session)
    res.json({ response: "Revoke successful" })
  })
})

/** /api_call/refresh **/
// Note: typical use case would be to refresh the tokens internally (not an API call)
// We recommend refreshing upon receiving a 401 Unauthorized response from Intuit.
// A working example of this can be seen above: `/api_call`
router.get('/refresh', function (req, res) {
  var token = tools.getToken(req.session)
  if (!token) return res.json({ error: 'Not authorized' })

  tools.refreshTokens(req.session).then(function (newToken) {
    // We have new tokens!
    res.json({
      accessToken: newToken.accessToken,
      refreshToken: newToken.refreshToken
    })
  }, function (err) {
    // Did we try to call refresh on an old token?
    console.log(err)
    res.json(err)
  })
})

//possible router to get client details
router.get('/customer', function (req, res) {
  var query = '/query?query= select * from customer'
  var url = config.api_uri + req.session.realmId + query
  // console.log('Making API Customer call to: ' + url)
  var requestObj = {
    url: url,
    headers: {
      // 'Authorization': 'Bearer ' + token.accessToken,
      'Accept': 'application/json'
    }

  }

  request(requestObj, function (err, response) {

    tools.checkForUnauthorized(req, requestObj, err, response).then(function ({ err, response }) {
      if (err || response.statusCode != 200) {
        return res.json({ error: err, statusCode: response.statusCode })
      }
      //success
      // maybe in our app we would limit what we sent back at this point
      res.json(JSON.parse(response.body))
      filterCustomers(JSON.parse(response.body))
    }, function (err) {
      console.log(err)
      return res.json(err)
    })
  })

})

function filterCustomers(customers) {
  // console.log('customer function', customers.QueryResponse)
  let customerArray = customers.QueryResponse.Customer
  let customerNotes = []
  for (let oneCustomer of customerArray) {
    let customer = {
      client_id: Number(oneCustomer.Id),
      notesObj: oneCustomer.Notes
    }
    // console.log('id?', oneCustomer.Id)
    // console.log('id is a number?', Number(oneCustomer.Id))
    customerNotes.push(customer)
  }
  getDogSchedule(customerNotes)
}

function getDogSchedule(dogNotes) {
  // this function processes the data from the Notes field on QB
  //and breaks it out into dog and schedule arrays to be added to customer object
  //and sent to client in CK app
  let customerArray = []
  for (let dog of dogNotes) {
    let result = dog.notesObj.split("-")

    //this sections gets rid of extra spaces that might be surrounding each string 
    let dogsArray = result[0].split(",").map(function (dogName) {
      return dogName.trim();
    })
    let scheduleArray = result[1].split(",").map(function (dayName) {
      return dayName.trim();
    })
    // console.log('dogs array', dogsArray)
    // console.log('schedule array', scheduleArray)
    let customer = {
      dogs: dogsArray,
      schedule: scheduleArray,
      client_id: dog.client_id
    }
    //adds each indidual customer object to the array of objects (customers)
    customerArray.push(customer)
    // console.log('one customer is:', customer)
  }

  console.log(customerArray)
 

}

module.exports = router



