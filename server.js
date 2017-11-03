const express = require('express');
const app = express();
const firebase = require('firebase');
const fs = require('fs');
const bcrypt = require('bcrypt');

let http = require('http').Server(app);
let io = require('socket.io')(http);


let config = {
    apiKey: "AIzaSyAZcQvDEjjoIOj4yRndpQvp2P9S5Om6UIA",
    authDomain: "server-eb0a3.firebaseapp.com",
    databaseURL: "https://server-eb0a3.firebaseio.com",
    projectId: "server-eb0a3",
    storageBucket: "server-eb0a3.appspot.com",
    messagingSenderId: "833102713061"
  };

firebase.initializeApp(config);
let database = firebase.database();

// app.listen(3000, function(){	
// 	console.log('Listening on port 3000');
// });

app.use(express.static('html'));

app.get('/', (req, res)=>{
	res.end('heelo');
});

http.listen(process.env.PORT || 3000, ()=>{
	console.log('listening on : '+(process.env.PORT||3000));
});


io.on('connection', (socket)=>{
	console.log('a user connected');
	socket.on('disconnect', ()=>{
		console.log('user disconnected');
	})

	socket.on('signup', data=>{
		//console.log(data);
		if(data.password != data.confirm_password)
			io.emit('alert', "Error. Psswords don't match");
		else{
			database.ref('database/users/'+data.username).once('value').then(snapshot=>{
				console.log(snapshot.val());
				if(snapshot.val())
					return io.emit('alert', 'Username already in use. Please use a different username.');
				else{
					database.ref('database/users/'+data.username).set({
						email:data.email,
						fullname:data.fullname,
						phone:data.phone,
						password:bcrypt.hashSync(data.password, 10),
						level:'normal'
					});
					io.emit('alert', "Account created");
				}
			});
			
		}

	});

	socket.on('login', data=>{
		console.log('login event');
		database.ref('database/users/'+data.username).once('value').then(snapshot=>{
			if(!snapshot || !bcrypt.compareSync(data.password, snapshot.val().password))	 
				return io.emit('alert', {message:'Incorrect username or password',username:"", success:false});
			io.emit('alert', {message:'Signed in as '+data.username, username:data.username, success:true});
		}).catch(err=>{
			io.emit('alert', {message:'An error occured while signing in, please try later.',username:"", success:false});
			console.log(err.message);
		});
	});

	socket.on('dashboard', username=>{
		console.log('Dashboard load', username);
		database.ref('database/users/'+username).once('value').then(snapshot=>{
			data = snapshot.val();
			delete data.password;
			io.emit('load', data);
			//console.log(snapshot.val());
		}).catch(err=>console.log("Error loading data. "+err.message));

	});

	socket.on('investment', data=>{
		database.ref('database/wallet/'+data.timestamp).set({
			amount:data.amount,
			timestamp:data.timestamp,
			created_by:data.username
		});

		io.emit('update', data);
		io.emit('alert', 'Investment made.');
	});

});