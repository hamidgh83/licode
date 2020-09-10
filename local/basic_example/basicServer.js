/* global require, __dirname, console */

/* eslint-disable import/no-extraneous-dependencies, no-console */

const express = require('express');
const bodyParser = require('body-parser');
const errorhandler = require('errorhandler');
const morgan = require('morgan');
const logger = require('log4js');
// eslint-disable-next-line import/no-unresolved
const N = require('./nuve');
const fs = require('fs');
const https = require('https');
// eslint-disable-next-line import/no-unresolved
const config = require('./../../licode_config');

config.erizoController.ssl_key = config.erizoController.ssl_key || '../../cert/key.pem';
config.erizoController.ssl_cert = config.erizoController.ssl_cert || '../../cert/cert.pem';
config.basicExample.nuveUrl = config.basicExample.nuveUrl || 'http://localhost:3000/';

config.basicExample.logger = config.basicExample.logger || {};
const logFile = config.basicExample.logger.configFile || './log4js_configuration.json';

logger.configure(logFile);
const log = logger.getLogger('BasicExample');


const options = {
  key: fs.readFileSync(config.erizoController.ssl_key).toString(),
  cert: fs.readFileSync(config.erizoController.ssl_cert).toString(),
};

if (config.erizoController.sslCaCerts) {
  options.ca = [];
  config.erizoController.sslCaCerts.forEach((cert) => {
    options.ca.push(fs.readFileSync(cert).toString());
  });
}

const app = express();

// app.configure ya no existe
app.use(errorhandler({
  dumpExceptions: true,
  showStack: true,
}));
app.use(morgan('dev', {
  stream: {
    write: (str) => { log.debug(str.trim()); },
  },
  skip: (req, res) => (res.statusCode >= 400),
}));
app.use(morgan('dev', {
  stream: {
    write: (str) => { log.error(str.trim()); },
  },
  skip: (req, res) => (res.statusCode < 400),
}));
app.use(express.static(`${__dirname}/public`));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true,
}));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});


// app.set('views', __dirname + '/../views/');
// disable layout
// app.set("view options", {layout: false});

N.API.init(config.nuve.superserviceID, config.nuve.superserviceKey, config.basicExample.nuveUrl);

let defaultRoom;
const defaultRoomName = 'basicExampleRoom';

const getOrCreateRoom = (name, type = 'erizo', mediaConfiguration = 'default',
  callback = () => {}) => {
  if (name === defaultRoomName && defaultRoom) {
    callback(defaultRoom);
    return;
  }

  N.API.getRooms((roomlist) => {
    let theRoom = '';
    const rooms = JSON.parse(roomlist);
    for (let i = 0; i < rooms.length; i += 1) {
      const room = rooms[i];
      if (room.name === name &&
                room.data &&
                room.data.basicExampleRoom) {
        theRoom = room._id;
        callback(theRoom);
        return;
      }
    }
    const extra = { data: { basicExampleRoom: true }, mediaConfiguration };
    if (type === 'p2p') extra.p2p = true;

    N.API.createRoom(name, (roomID) => {
      theRoom = roomID._id;
      callback(theRoom);
    }, () => {}, extra);
  });
};

const deleteRoomsIfEmpty = (theRooms, callback) => {
  if (theRooms.length === 0) {
    callback(true);
    return;
  }
  const theRoomId = theRooms.pop()._id;
  N.API.getUsers(theRoomId, (userlist) => {
    const users = JSON.parse(userlist);
    if (Object.keys(users).length === 0) {
      N.API.deleteRoom(theRoomId, () => {
        deleteRoomsIfEmpty(theRooms, callback);
      });
    } else {
      deleteRoomsIfEmpty(theRooms, callback);
    }
  }, (error, status) => {
    log.error('Error getting user list for room ', theRoomId, 'reason: ', error);
    switch (status) {
      case 404:
        deleteRoomsIfEmpty(theRooms, callback);
        break;
      case 503:
        N.API.deleteRoom(theRoomId, () => {
          deleteRoomsIfEmpty(theRooms, callback);
        });
        break;
      default:
        break;
    }
  });
};

const cleanExampleRooms = (callback) => {
  log.debug('Cleaning basic example rooms');
  N.API.getRooms((roomlist) => {
    const rooms = JSON.parse(roomlist);
    const roomsToCheck = [];
    rooms.forEach((aRoom) => {
      if (aRoom.data &&
                aRoom.data.basicExampleRoom &&
                aRoom.name !== defaultRoomName) {
        roomsToCheck.push(aRoom);
      }
    });
    deleteRoomsIfEmpty(roomsToCheck, () => {
      callback('done');
    });
  }, (err) => {
    log.debug('Error cleaning example rooms', err);
    setTimeout(cleanExampleRooms.bind(this, callback), 3000);
  });
};

app.get('/getRooms/', (req, res) => {
  N.API.getRooms((rooms) => {
    res.send(rooms);
  });
});

app.get('/getUsers/:room', (req, res) => {
  const room = req.params.room;
  N.API.getUsers(room, (users) => {
    res.send(users);
  });
});


app.post('/createToken/', (req, res) => {
  log.debug('Creating token. Request body: ', req.body);

  const username = req.body.username;
  const role = req.body.role;

  let room = defaultRoomName;
  let type;
  let roomId;
  let mediaConfiguration;

  if (req.body.room) room = req.body.room;
  if (req.body.type) type = req.body.type;
  if (req.body.roomId) roomId = req.body.roomId;
  if (req.body.mediaConfiguration) mediaConfiguration = req.body.mediaConfiguration;

  const createToken = (tokenRoomId) => {
    N.API.createToken(tokenRoomId, username, role, (token) => {
      log.debug('Token created', token);
      res.send(token);
    }, (error) => {
      log.error('Error creating token', error);
      res.status(401).send('No Erizo Controller found');
    });
  };

  if (roomId) {
    createToken(roomId);
  } else {
    getOrCreateRoom(room, type, mediaConfiguration, createToken);
  }
});



// New APIs

global._triedHooks = {}
function callRoomHooks() {
    N.API.getRooms(function (result) {
        JSON.parse(result).forEach(checkRoomExists);
    });
}

function checkRoomExists(room) {
    if (room.data.creationTime + 30000 > Date.now()) {
        return;
    }
    N.API.getUsers(room._id, function (result) {
 
        if (JSON.parse(result).length <= 0) {

            if (!room.data || !room.data.hookUrl) {
                N.API.deleteRoom(room._id, function () {});
                return;
            }

            if (_triedHooks.hasOwnProperty(room._id)) {
                _triedHooks[room._id] += 1;
            } else {
                _triedHooks[room._id] = 1;
            }

            request.post(
                {
                    'url' : room.data.hookUrl,
                    form : {event : "finished"},
                    strictSSL : false
                },
                function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                        N.API.deleteRoom(room._id, function () {});
                        return;
                    }

                    if (room._id in _triedHooks && _triedHooks[room._id] > 3) {
                        delete _triedHooks[room._id];
                        N.API.deleteRoom(room._id, function () {});
                    }
                }
            );
        }
    });
}

setInterval(callRoomHooks, 30000);

app.post('/session/create', function (req, res) {
  N.API.getRooms(function (r) { console.log(r);});
  var roomName   = req.body.room;
  var hookUrl    = req.body.hook_url;
  var data       = {
      data : {
          hookUrl      : hookUrl,
          creationTime : Date.now()
      }
  };
  if (!roomName) {
      res.send(JSON.stringify({success : false, error : 'Invalid Room Name'}));
  }
  N.API.createRoom(
      roomName,
      function (room) {
          res.status(200).send({room_name : room.name, session_id : room._id});
      },
      function () {
          res.status(400).send();
      },
      data
  );
});

app.post('/token/generate', function (req, res) {
  "use strict";
  var session_id = req.body.session_id;
  var user_id    = req.body.user_id;
  var role       = req.body.role;
  var data       = req.body.data || [];

  N.API.getRoom(
      session_id,
      function (resp) {
          var room= JSON.parse(resp);
          N.API.createToken(room._id, user_id, role, function (token) {
              res.status(200).send({token: token, success: true});
          }, function () {
              res.status(400).send();
          });
      },
      function () {
          res.status(410).send();
      }
  );
});

app.get('/session/:session_id/users', function(req, res) {
  "use strict";
  var room = req.params.session_id;

  N.API.getUsers(room, function(users) {
      res.send(users);
  }, function () {
      res.status(400).send({error : 'Invalid room'});
  });
});

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE');
  res.header('Access-Control-Allow-Headers', 'origin, content-type');
  if (req.method === 'OPTIONS') {
    res.send(200);
  } else {
    next();
  }
});

cleanExampleRooms(() => {
  getOrCreateRoom(defaultRoomName, undefined, undefined, (roomId) => {
    defaultRoom = roomId;
    let port = 3001;
    let tlsPort = 3004;
    if (config.basicExample && config.basicExample.port) {
      port = config.basicExample.port;
    }
    if (config.basicExample && config.basicExample.tlsPort) {
      tlsPort = config.basicExample.tlsPort;
    }

    app.listen(port);
    const server = https.createServer(options, app);
    log.info(`BasicExample started and listenting on port ${port}`);
    server.listen(tlsPort);
  });
});
