// Author: Amay Kataria
// Date: 08/19/2019
// File: store.js
// Description: Server side implementation to store all the responses put on Encryption-Archive 

var express = require('express'); 
var socket = require('socket.io');
var Pool = require('pg').Pool; 

// ------------------ postgresql database ---------------------- // 
const connString = process.env['DATABASE_URL'];
console.log('Database Connection String: ' + connString); 
const pool = new Pool({
    connectionString: connString
}); 

// ------------------ Express webserver ------------------------ //
var app = express(); 
var server = app.listen(process.env.PORT || 5000, function() {
    console.log('Store server successfully started'); 
});
app.use(express.static('Public')); 

// ------------------ Websocket ------------------------ //
var io = socket(server); 
var appSocket = io.of('/app').on('connection', onMainAppConnected); // Connects all web instance to this. 
var receiptSocket = io.of('/receipt').on('connection', onReceiptClient); // Connects receipt server to this. 
var storeSocket = io.of('/store').on('connection', onHerokuAppConnected); // Connects the web instance to read data. 

// Send an event to all connected clients to keep the Socket Connection Alive. 
// This event is sent every 1 second to every client. 
setInterval(() => io.emit('time_all', new Date().toTimeString()), 1000);

function onMainAppConnected(socket) {
    console.log('New Client App connection : ' + socket.id); 
    socket.on('writePayload', onPayload); 
    socket.on('disconnect', () => console.log('App Client ' + socket.id + ' disconnected')); 
}

function onReceiptClient(socket) {
    console.log('Receipt Client Connected : ' + socket.id);
    socket.on('disconnect', () => console.log('Receipt Client ' + socket.id + ' disconnected'));
}

function onHerokuAppConnected(socket) {
    console.log('New Heroku WebApp Connection : ' + socket.id); 
    socket.on('readEntries', onReadEntries); 
    socket.on('diconnect', () => console.log('Heroku Client ' + socket.id + ' diconnected'));
}

function onReadEntries() {
    console.log('Request to Read All Entries');
    pool.query('SELECT * FROM entries', (err, results) => {
        if (err) {
            throw error; 
        }

        storeSocket.emit('showEntries', results.rows); 
    });
}

function onPayload(payload) {
    console.log('New Write Payload Received');
    
    // Store this payload into the file. 
    writePayload(payload); 

    console.log('Emitting Print Payload');
    // Emit this payload to be printed on the receipt printer. 
    receiptSocket.emit('printPayload', payload); 
}

function writePayload(payload) {
    const date = payload.date; 
    const time = payload.time; 
    const key = payload.key; 
    const encrypted = payload.binary; 

    // Write the payload to the database. 
    pool.query('INSERT INTO entries (date, time, key, encrypted) VALUES ($1, $2, $3, $4)', [date, time, key, encrypted], (error, result) => {
        if (error) {
            throw error; 
        }

        console.log('Success: New entry in the databse with key ' + key); 
    }); 
}