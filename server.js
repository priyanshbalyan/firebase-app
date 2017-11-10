const express = require('express');
const app = express();
const firebase = require('firebase');
const bcrypt = require('bcrypt');

let bodyParser = require('body-parser');
let multer = require('multer');
let upload = multer();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));

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

http.listen(process.env.PORT || 3000, ()=>{
	console.log('listening on : '+(process.env.PORT||3000));
});

app.get('/', (req, res)=>{
	res.sendFile(__dirname+'/html/index.html');
});

// app.get('/dashboard.html', upload.array(), (req, res, next)=>{
// 	database.ref('database/users/'+req.headers.username).once('value').then(snapshot=>{
// 		if(!snapshot || !bcrypt.compareSync(req.headers.password, snapshot.val().password))	 
// 			return res.sendFile(__dirname+'/html/index.html');

// 		if(snapshot.val().level == 'exec'){
// 			console.log('exec trigger');
// 			return res.sendFile(__dirname+'/html/admindashboard.html');
// 		}
// 		res.sendFile(__dirname+'/html/dashboard.html');
// 	}).catch(err=>{
// 		res.sendFile(__dirname+'/html/index.html');
// 		console.log(err.message);
// 	});
	
// });



app.use(express.static('html'));

io.on('connection', socket=>{
	console.log('a user connected');
	socket.on('disconnect', ()=>{
		console.log('user disconnected');
	})

	socket.on('signup', data=>{
		//console.log(data);
		if(data.password != data.confirm_password)
			io.emit('alert', "Error. Passwords don't match");
		else{
			database.ref('database/users/'+data.username).once('value').then(snapshot=>{
				//console.log(snapshot.val());
				if(snapshot.val())
					return io.emit('alert', 'Username already in use. Please use a different username.');
				else{
					database.ref('database/users/'+data.username).set({
						email:data.email,
						fullname:data.fullname,
						phone:data.phone,
						password:bcrypt.hashSync(data.password, 10),
						level:'normal',
						acc_created:Date.now()+""
					});
					console.log("refcode passed : "+data.refcode);
					
					if(data.refcode!=""){
						database.ref('database/users').orderByChild('acc_created').equalTo(data.refcode).once('value', snapshot=>{
							database.ref('database/users/'+Object.keys(snapshot.val())[0]+'/referrals').push().set(data.username);
							database.ref('database/users/'+data.username).update({ref_from:Object.keys(snapshot.val())[0]});
						});
					}
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

			io.emit('alert', {message:'Signed in as '+data.username, username:data.username, success:true, privilege:snapshot.val().level});
		}).catch(err=>{
			io.emit('alert', {message:'An error occured while signing in, please try later.',username:"", success:false});
			console.log(err);
		});
	});

	socket.on('dashboard', username=>{
		console.log('Dashboard load', username);
		database.ref('database/users/'+username).once('value').then(snapshot=>{
			data = snapshot.val();
			io.emit('load', data);
			//console.log(snapshot.val());
		}).catch(err=>console.log("Error loading data. "+err.message));

	});

	socket.on('admindashboard', admin=>{

		database.ref('database/users/'+admin).once('value').then(snapshot=>{
			data = snapshot.val();
			io.emit('load', snapshot.val());
			//console.log(snapshot.val());
		}).catch(err=>console.log("Error loading data. "+err.message));

		database.ref('database/wallet/').once('value').then(snapshot=>{
			//console.log(snapshot.val());
			io.emit('walletload', snapshot.val());
		}).catch(err=>console.log(err.message));

		database.ref('database/users/').once('value').then(snapshot=>{
			io.emit('userload', snapshot.val());
		}).catch(err=>console.log(err.message));
	});

	socket.on('investment', data=>{

		database.ref('database/wallet/'+data.timestamp).set({
			amount:data.amount,
			timestamp:data.timestamp,
			created_by:data.username,
			status:'pending',
			refcheck:false
		});

		let ref = database.ref('database/users/'+data.username+'/walletids');
		let newchildref = ref.push();
		newchildref.set(data.timestamp);

		console.log('invested : ', data);
		//io.emit('update', data);

		database.ref('database/users/'+data.username+'/walletids').once('value').then(snapshot=>{
			io.emit('update', snapshot.val());
		});
		io.emit('alert', 'Investment made.');
	});

	socket.on('updatewallet', data=>{
		database.ref('database/wallet/'+data.walletid).update({
			status:data.status
		});
		updatereferrals(data.walletid);
		database.ref('database/wallet/').once('value').then(snapshot=>{
			io.emit('walletload', snapshot.val());
		}).catch(err=>console.log(err.message));
	});

});

function updatereferrals(wid){
	if(wid.status == "Approved" && wid.refcheck==false)
	database.ref('database/wallet/'+wid).once('value').then(snapshot=>{
		amount = snapshot.val().amount;
		user = snapshot.val().created_by;
		
		database.ref('database/users/'+user).once('value').then(snapshot=>{
			//console.log('created_bgiy',snapshot.val().ref_from);
			database.ref('database/users/'+snapshot.val().ref_from).once('value').then(s=>{
				//console.log(s.val());
				upd = parseInt(s.val().deposit);
				upd += 0.1*amount;
				database.ref('database/users/'+snapshot.val().ref_from).update({deposit: upd});
				database.ref('database/wallet/'+wid).update({refcheck:true});
			});

		});
	});
}