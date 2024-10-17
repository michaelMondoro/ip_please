const jGeoIP = require('jgeoip');
const express = require('express')
const fs = require('fs')
const dns = require('dns')
const https = require('https')
const cors = require('cors')

require('dotenv').config()

const app = express()
app.use(cors({origin:"*"}))

var geoip = new jGeoIP(process.env.IP_DB_FILENAME);
var asnip = new jGeoIP(process.env.ASN_DB_FILENAME);

function log(msg) {
    console.log(`[ ${new Date().toLocaleString()} ] - ${msg}`)
}
/* Lookup ASN Info for IP */
function getAsn(ip) {
    let record = asnip.getRecord(ip);
    data = {}
    if (record !== null) {
        data = {
            'number': record['autonomous_system_number'],
            'org': record['autonomous_system_organization']
        }
    }
    return data;
}

/* Lookup GEO Info For IP */
function getGeo(ip) {
    let record = geoip.getRecord(ip);
    data = {err:`couldn't find info on ip: ${ip}`}
    let asn_data = getAsn(ip);
    if (record !== null) {
        data = {
	          'ip':ip,
            'city': record['city']['names']['en'],
            'country': record['country']['names']['en'],
            'subdivision': record['subdivisions'] ? record['subdivisions'][0]['names']['en'] : '',
            'country_code': record['country']['iso_code'],
            'coordinates': record['location'],
            'asn': asn_data
        }
    }
    return data;
}

/* Check to see if we were passed a hostname, if so get its IP */
function checkHost(ip) {
  return new Promise((resolve,reject) => {
      dns.lookup(ip, (err, addr, fam)=>{
        if (err) return reject({message:"failed to get host info"})
        resolve(addr);
      })
  })
}

/* API Endpoint */
app.get('/api/ip_please', async function (req, res) {
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    log(`GET ${req.url} :: [${ip}]`)

    try {
        if (req.query.ip) {
          ip = req.query.ip;
        }

        var hostIP = await checkHost(ip);
        if (hostIP) ip = hostIP;

        let ip_data = getGeo(ip)
        res.status(200).send(ip_data)
    } catch (err) {
        res.status(500).send({error: err.message})
        log(`ERROR :: ${err.message}`)
    }  
})

/* Start Server */
if (process.env.ENV === "PROD") {
  const httpsServer = https.createServer({
    key: fs.readFileSync(process.env.SSL_KEY_PATH),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH),
  }, app);

  httpsServer.listen(443, () => {
      console.log('HTTPS Server running on port 443');
  });  
} else if (process.env.ENV === "DEV") {
  var server = app.listen(5000, function () {
    console.log('[ Starting IP API ]\n')
    console.log("HTTP server running at http://127.0.0.1:5000/");
    console.log(`ENV: ${process.env.ENV}`)
  })
} else {
  console.log("check your .env file");
}


