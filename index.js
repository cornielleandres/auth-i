const express = require('express');
const bcrypt = require('bcryptjs');
const userDb = require('./data/models/userDb.js');

// middleware
const applyGlobalMiddleware = require('./config/middleware/global.js');
const usersProtected = require('./config/middleware/usersProtected.js');

const server = express();
const port = 5000;

applyGlobalMiddleware(server);

// get all the users
server.get('/api/users', usersProtected, (req, res) => {
	return userDb
		.getAllUsers()
		.then(users => {
			if (users.length) {
				return res.status(200).json(users);
			}
			return res.status(404).json({ error: 'There are no users in the database. You should register a user first.' });
		})
		.catch(err => res.status(500).json({ error: `Server failed to GET all users: ${ err }` }));
});

// get restricted access
server.get('/api/restricted/:section', (req, res) => {
	// the only way to get here is if the 'restricted' global middleware sees that you
	// are logged into a session
	const { section } = req.params;
	res.status(200).json({ message: `You are in ${ section }. You are allowed to view this because you are logged in as ${ req.session.username }.` });
});

// check if a user is logged in during this session
server.get('/api/checklogin', (req, res) => {
	// if not logged in, req.session.username will be undefined
	return res.status(200).json(req.session.username || false);
});

// login a user
server.post('/api/login', (req, res) => {
	const credentials = req.body;
	if (req.session.username) {
		return res.status(401).json({ error: `You are already logged in as ${ req.session.username }. Please log out first before logging in again.`});
	}
	if (!credentials.username) {
		return res.status(401).json({ error: 'Username cannot be empty.' });
	}
	if (!credentials.password) {
		return res.status(401).json({ error: 'Password cannot be empty.' });
	}
	return userDb
		.getUser(credentials.username)
		.then(user => {
			if (user) {
				return bcrypt
					.compare(credentials.password, user.password)
					.then((match) => {
						if (match) {
							req.session.username = credentials.username;
							return res.status(201).json({ welcome: credentials.username });
						}
						return res.status(401).json({ error: 'You shall not pass!' });
					});
			}
			return res.status(401).json({ error: 'You shall not pass!' });
		})
		.catch(err => res.status(500).json({ error: `Server failed to login user: ${ err }` }));
});

// logout a user
server.post('/api/logout', (req, res) => {
	// if user is logged in
	if (req.session.username) {
		// destroy session
		return req.session.destroy(err => {
			if (err) {
				return res.status(500).json({ error: `Server failed to logout user: ${ err }` });
			}
			return res.status(200).json({ message: 'Successfully logged out.' });
		});
	}
	// if user is not logged in, send error message
	return res.status(400).json({ error: 'You are not logged in.' });
});

// register a new user
server.post('/api/register', (req, res) => {
	const credentials = req.body;
	if (!credentials.username) {
		return res.status(401).json({ error: 'Username cannot be empty.' });
	}
	if (!credentials.password) {
		return res.status(401).json({ error: 'Password cannot be empty.' });
	}
	return userDb
		.getUser(credentials.username)
		.then(user => {
			// if username does not exist, you can register it
			if (!user) {
				return bcrypt
					.hash(credentials.password, 12, function(bcryptErr, hash) {
						if (bcryptErr) {
							return res.status(500).json({ error: `Bcrypt hashing failed: ${ bcryptErr }` });
						}
						credentials.password = hash;
						return userDb
							.registerNewUser(credentials)
							.then(id => res.status(201).json(id.id[0]))
							.catch(err => res.status(500).json({ error: `Server failed to register new user: ${ err }` }));
					});
			}
			// if username already exists, send error message
			return res.status(403).json({ error: `Username ${ credentials.username } already exists. Please register with a new username.` });
		})
		.catch(err => res.status(500).json({ error: `Server failed to GET user: ${ err }` }));
});

server.listen(port, () => { console.log(`\n=== Listening on port ${ port } ===`) });
