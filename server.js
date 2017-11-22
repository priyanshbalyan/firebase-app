const express = require('express');
const app = express();
const firebase = require('firebase');
const bcrypt = require('bcrypt-nodejs');

let bodyParser = require('body-parser');
let multer = require('multer');
let upload = multer();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));

let http = require('http').Server(app);
let io = require('socket.io')(http);

const nodemailer = require('nodemailer');
let jwt = require('jsonwebtoken');

let validator = require('validator');


let tokenkey = "JWT_TOKEN_KEY";
let hostname = "";

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

// app.get('/:id', (req, res, next)=>{
// 	res.sendFile(__dirname+'/html/index.html');
	
// 	// console.log(hostname);
// 	next();
// });

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

let smtpConfig = {
    host: 'smtp.elasticemail.com',
    port: 2525,
    secure: false, // upgrade later with STARTTLS
    auth: {
        user: 'zazzymax2@gmail.com',
        pass: '91a61051-5c24-4a3d-b197-a4a8ca5a8412'
    }
};

let flag = "";


// app.get('/', (req, res)=>{
// 	hostname = req.headers.host;
// 	if(flag=="verify"){
// 		res.sendFile(__dirname+'/html/verified.html');
// 		flag = "";
// 	}
// 	else if(flag=="pwdreset"){
// 		res.sendFile(__dirname+'/html/passwordreset.html');
// 		flag="";
// 	}
// 	else
// 		res.sendFile(__dirname+'/html/index.html');
	
// });

app.get('/verify/:id', (req, res, next)=>{
	hostname = req.headers.host;
	console.log(req.params.id, req.headers.host);
	try{
		decoded = jwt.verify(req.params.id, tokenkey);
	}catch(err){
		console.log(err);
		res.redirect('/');
	}
	console.log(JSON.stringify(decoded));
	if(decoded.hasOwnProperty("user")){
		flag = "verify";
	}
	else
		res.redirect('/');
});

app.get('/pwdreset', (req, res, next) =>{
	res.redirect('/');
});

app.use((req,res,next)=>{
	hostname = req.headers.host;
	next();
});

app.use('/pwdreset/:id', (req, res, next)=>{
	if(req.params.hasOwnProperty("id")){
		try{
			decoded = jwt.verify(req.params.id, tokenkey);
		}catch(err){
			console.log(err);
			res.redirect('/');
		}
		console.log(decoded);
		res.redirect('/passwordreset.html');
	}else
		res.redirect('/');

});

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
		if(!validator.isEmail(data.email))
			io.emit('alert', "Wrong E-mail format.");
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
						password:bcrypt.hashSync(data.password),
						level:'normal',
						acc_created:Date.now()+"",
						rank:"0",
						deposit:"0"
					});
					console.log("refcode passed : "+data.refcode);
					
					serializedtoken = jwt.sign({user:data.username}, tokenkey, {expiresIn: '1h'});
					url = "http://"+hostname+'/verify/'+serializedtoken;
					let mailOptions = {
        				from: 'zazzymax2@gmail.com', // sender address
        				to: data.email, // list of receivers
        				subject: 'Email verification', // Subject line
        				text: 'Hello '+data.fullname+'!, verify your email by clicking the following link', // plain text body
        				html: 'Hello '+data.fullname+'!, verify your email by clicking '+'<a href="'+url+'">here.</a>' // html body
    				};
    				let transporter = nodemailer.createTransport(smtpConfig);
    				transporter.sendMail(mailOptions, (error, info)=>{
    					if(error) return console.log(error);
    					console.log('Message sent', info.messageId);
    					console.log('Preview URL', nodemailer.getTestMessageUrl(info));
    					
    				});
    				io.emit('toast', "A verification mail has been sent to your E-mail.");
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
			//console.log(snapshot.val().password, bcrypt.compare(data.password))
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
			io.emit("load", data);
			database.ref('database/requests/').once('value').then(snapshot=>{
				if(snapshot.hasChild(username)){
					database.ref('database/requests/'+username).once('value').then(snap=>{
						requests = Object.keys(snap.val()).map(key=>snap.val()[key]);
						io.emit('requests', {requests:requests, rank:data.rank});
					});
				}
			});

			console.log(snapshot.val());
			wids = Object.keys(snapshot.val().walletids).map(k=>snapshot.val().walletids[k]);
			database.ref('database/wallet/').once('value').then(snap=>{
				console.log(wids);
				data = snap.val();
				wids.sort(); wids.reverse();
				wids = wids.map(w=>data[w]);
				io.emit('update', wids);
			});
			
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
			data = snapshot.val();
			io.emit('userload', data);

			a = [];
			for(user in data){
  				itr(user, data, a);
  			}
  			io.emit('structure', a);
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
			wids = Object.keys(snapshot.val()).map(k=>snapshot.val()[k]);
			database.ref('database/wallet/').once('value').then(snap=>{
				//console.log(wids);
				data = snap.val();
				wids = wids.map(w=>data[w]);
				io.emit('update', wids);
			});
			
		});
		io.emit('alert', 'Investment made.');
	});

	socket.on('updatewallet', data=>{
		database.ref('database/wallet/'+data.walletid).update({
			status:data.status, refcheck:true
		});
		database.ref('database/wallet/'+data.walletid).once('value').then(snapshot=>{
			updatereferrals(data.walletid, snapshot.val());
		});
		database.ref('database/wallet/').once('value').then(snapshot=>{
			io.emit('walletload', snapshot.val());
		}).catch(err=>console.log(err.message));
	});

	socket.on('rankrequest', data=>{
		console.log("function trigger",data);
		database.ref('database/requests').once('value', snapshot=>{
			console.log(snapshot.val());
			if(!snapshot.hasChild(data.to)){
				database.ref('database/requests').child(data.to).push().set(data.requester);
			}else{
				database.ref('database/requests/'+data.to).push().set(data.requester);
			}
		});
	});

	socket.on('updaterank', data=>{
		console.log("function triggered", data);
		database.ref('database/users/'+data.username).once('value').then(snap=>{
			if(parseInt(data.newrank)>0 && parseInt(data.newrank)<snap.val().rank){
				database.ref('database/users/'+data.name).update({rank:data.newrank});
				io.emit('alert', 'Rank updated');
				database.ref('database/requests/'+data.username).once('value').then(snap=>{
			
					k = Object.keys(snap.val())[0];
					console.log(k, data.username, snap.val()[k]);
					database.ref('database/requests/'+data.username+'/'+k).remove();
				})
			}
			else
				io.emit('alert', "Invalid rank.");
		});

	});

	socket.on('adminupdaterank', data=>{
		console.log(data);
		database.ref('database/users/'+data.username).update({rank:data.newrank});
		io.emit('alert', "Rank updated");
		database.ref('database/users/').once('value').then(snapshot=>{
			io.emit('userload', snapshot.val());
		}).catch(err=>console.log(err.message));
	});

	socket.on('pwdreset', username=>{
		database.ref('database/users/'+username).once('value').then(snapshot=>{
			if(!snapshot.val())
				return io.emit('toast', "No matching username found.");
			pwdresettoken = jwt.sign({user:username}, tokenkey, {expiresIn:'1h'});
			url = "http://"+hostname+"/pwdreset/"+pwdresettoken;			
			//console.log(pwdresettoken, url);
			let mailOptions = {
        		from: 'zazzymax2@gmail.com', // sender address
        		to: snapshot.val().email, // list of receivers
        		subject: '(Zazzy) Password reset', // Subject line
        		text: 'Here is your password reset link', // plain text body
        		html: 'Here is your password reset '+'<a href="'+url+'">link</a>' // html body
    		};
    		let transporter = nodemailer.createTransport(smtpConfig);
    		transporter.sendMail(mailOptions, (error, info)=>{
    			if(error) return console.log(error);
    			io.emit('toast', 'A password reset email has been sent to the corresponding username\'s email');
    			console.log('Message sent', info.messageId);
    			console.log('Preview URL', nodemailer.getTestMessageUrl(info));
    		});
		});
	});

	socket.on('newpwd', data=>{

	});
});

function updatereferrals(wid, data){
	console.log("trigger update", wid);
	if(data.status == "Approved" && data.refcheck==false)
		database.ref('database/wallet/'+wid).once('value').then(snapwallet=>{
			amount = parseInt(snapwallet.val().amount);
			user = snapwallet.val().created_by;
			console.log(amount, user);
			database.ref('database/users/'+user).once('value').then(snapuser1=>{
				rank1 = parseInt(snapuser1.val().rank);
				
				newdeposit = parseFloat(snapuser1.val().deposit) + amount;
				database.ref('database/users/'+user).update({deposit: newdeposit});

				user2 = snapuser1.val().ref_from;
				//console.log(user2);
				
				refloop(user2, rank1);

			});
		});
}

function refloop(user2, rank1){
	console.log("looping");
	if(!user2) return;
	database.ref('database/users/'+user2).once('value').then(s=>{
		//console.log(s.val());     //user detail of the user the investor referred from
		rank2 = parseInt(s.val().rank);
		rankupd = (rank2-rank1)*0.0025*amount;
		console.log(rank1, rank2);
		upd = parseFloat(s.val().deposit)+rankupd;
		console.log(rankupd, upd);
		database.ref('database/users/'+user2).update({deposit: upd});
		if(s.val().hasOwnProperty("ref_from"))
			user2 = s.val().ref_from;
		else
			user2 = null;
		rank1 = s.val().rank;
		refloop(user2, rank1);
		console.log(user2);

	});
}

function itr(u, users, a){
	if(a.indexOf(u) == -1)
		a.push(u);
 	if(!users[u].hasOwnProperty("referrals"))	
 		return;
  	else{
  		a.push("-->");
  		for(ref in users[u].referrals){
	    	itr(users[u].referrals[ref], users, a);
    	}
    	a.push("<--");
  	}
}