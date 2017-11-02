
var db = require('byteballcore/db.js')
var eventBus = require('byteballcore/event_bus.js');
var device = require('byteballcore/device.js');
var walletDefinedByKeys = require('byteballcore/wallet_defined_by_keys.js');
var conf = require('./conf.js');
require("byteballcore/wallet.js");
var headlessWallet = require("headless-byteball");
var mail = require('byteballcore/mail.js');
var wallet;


// Total 'TODO' 4!!!
// multi payment
// С какого адреса прилетел платеж


// Sending message to mail
function sendMessageToUser(to, code){
	mail.sendmail({
		to: to,
		from: conf.admin_mail,
		subject: "Verification",
		body: "It is your verification code "+ code
	});
}

// Gen code between min and max integers
function genVerifyCode(min, max){
	var rand = min + Math.random() * (max + 1 - min);
    return Math.floor(rand);
}

// Insert new record in table
function CreateNewNote(device_address, callback){
	db.query("INSERT INTO user_verification_process (deviceAddress) VALUES (?)", [device_address], function() {
		if (callback) callback();
	})
}

// Update anything row in table
function updateNote(object, user_id, callback){
	db.query(`UPDATE user_verification_process SET verifyCode = ?, address = ?, amount = ?, email = ?, status = ? WHERE id = ?`, [object.verifyCode, object.address, object.amount, object.email, object.status, user_id], function(){
		if(callback) callback();
	})
}

// Return item with the same device address
function returnStatusByDevice(user_id, callback){
	db.query("SELECT * FROM user_verification_process WHERE id = ?", [user_id], function(rows){
		if (rows.length === 0)
			throw Error('no current object');
		var result = rows[0];
		if(callback) callback(result);
	});
}

// Cancel atestation
function cancelAtestation(user_id){
	db.query("UPDATE user_verification_process SET cancel_date="+db.getNow()+" WHERE id=?", [user_id]);
}

function replaceConsoleLog(){
	var clog = console.log;
	console.log = function(){
		Array.prototype.unshift.call(arguments, Date().toString()+':');
		clog.apply(null, arguments);
	}
}

replaceConsoleLog();

// Preparing wallet 
eventBus.on('headless_wallet_ready', function(){
	headlessWallet.setupChatEventHandlers();
	headlessWallet.readSingleWallet(function(_wallet){
		wallet = _wallet;
	});
});

var userId;

// Pairing bot with user, Welcome text
eventBus.on('paired', function(from_address){
	if (!wallet)
		return handleNoWallet(from_address);
	CreateNewNote(from_address, function(){
		// Selecting user's ID by device address
		db.query("SELECT id FROM user_verification_process WHERE deviceAddress=?", [from_address], function(rows){
			if (rows.length === 0)
				throw Error('no current object');
			userId = rows[0].id;
			console.log("looooooooooooooooooooooo "+userId)
		});
		device.sendMessageToDevice(from_address, 'text', "Hi! I am Atestation Bot, I will atestate you.\t Please send me your current email address")
	});
});

var verifCode;
var inputsCount = 1;

// Get user's byteball address
eventBus.on('text', function (from_address, text){
	var usersText = text;
	
	returnStatusByDevice(userId, function(result){
		switch(result.status){
			case 'unverified':
				verifCode = genVerifyCode(99999, 999999);
				// Sending message with validation code 
				sendMessageToUser(usersText, verifCode);//TODO: to fix sendmail config at my desktop computer
				console.log("looooooooooooooooooooooooooooooo " + verifCode);
				result.status = 'waiting for verification code';
				result.email = usersText;
				updateNote(result, userId, function(){
					device.sendMessageToDevice(from_address, 'text', "Message sending to your email address. \nInput your confirmation code here");
				});
				break;
			case 'waiting for verification code':
				if(verifCode == usersText){
					result.status = 'Offer to pay';
					result.verifyCode = usersText;
					updateNote(result, userId);
					device.sendMessageToDevice(from_address, 'text', "Confirmation code is valid, to continue atestation input your current byteball address")
				} else{
					inputsCount++;
					if(inputsCount !== 4){
						device.sendMessageToDevice(from_address, 'text', "Cofirmation code is not valid, please try again ");
					} else {
						result.status = 'unverified';
						updateNote(result, userId);
						device.sendMessageToDevice(from_address, 'text', "It is invalid confirmation code. \n Please enter your email address again.")
					}
				}
				break;
			case 'Offer to pay':
				walletDefinedByKeys.issueNextAddress(wallet, 0, function(objAddress){
					result.address = objAddress.address;
					result.status = 'Wait for payment';
					updateNote(result, userId);
					device.sendMessageToDevice(from_address, 'text', "I am memorize your byteball address "+usersText+" .\tPlease pay to continue atestation.\n["+conf.price+" bytes](byteball:"+objAddress.address+"?amount="+conf.price+")");//cost of assets 1 bytes
				});
				break;
			case 'Wait for payment':
				//TODO: to fix skiping text
				if (text !== 'cancel')
					return device.sendMessageToDevice(from_address, 'text', "Waiting for your payment.  If you want to cancel atestation and start over, click [Cancel](command:cancel).");
				cancelAtestation(userId);
				CreateNewNote(from_address, function(){
					device.sendMessageToDevice(from_address, 'text', "Atestation canceled.\n If you want run atestation, input your current email address.");
				});
				break;
			case 'unconfirmed transaction':
				device.sendMessageToDevice(from_address, 'text', "We are waiting for confirmation of your payment.  Be patient.");
				break;
			case 'double spent':
				CreateNewNote(from_address, function(){
					var response = (result.status === 'done')
						? "The payment was paid and you atestated.\n"
						: "Your payment appeared to be double-spend and was rejected.\n";
					response += " If you want run atestation, input your current email address.";
					device.sendMessageToDevice(from_address, 'text', response);
				});
				break;
			default:
				throw Error("unknown position "+result);
		}
	})
})

//Wait for confirming TX
eventBus.on('new_my_transactions', function(arrUnits){
	// console.log("qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq " + arrUnits);
	"SELECT id, outputs.unit, deviceAddress, outputs.address AS paid_address, outputs.amount AS paid_amount \n\
	FROM outputs JOIN user_verification_process USING(address) WHERE outputs.unit IN(?) AND outputs.asset IS NULL", 
	[arrUnits],
	function(rows){
		rows.forEach(function(row){
			db.query("SELECT address FROM user_verification_process WHERE id=?", [userId], function(Rows){
				if(Rows[0].address !== row.paid_address)
					return device.sendMessageToDevice(row.deviceAddress, 'text', "Payment came from the not claimed address, check you are in the single-address wallet, turn on your single address wallet or begin atestation at first");
				
			})
			if (conf.price !== row.paid_amount)
				return device.sendMessageToDevice(row.deviceAddress, 'text', "Received incorect amount from you: expected "+conf.price+" bytes, received "+row.paid_amount+" bytes.  The payment is ignored.");
			db.query("UPDATE user_verification_process SET amount=?, status='unconfirmed transaction' WHERE id=?", [row.unit, row.id]);
			device.sendMessageToDevice(row.deviceAddress, 'text', "Received your payment, please wait a few minutes while it is still unconfirmed.");
		});
	}
});

eventBus.on('my_transactions_became_stable', function(arrUnits){
	// console.log("wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww " + arrUnits);
	db.query(
		"SELECT id, deviceAddress, sequence \n\
		FROM user_verification_process JOIN units USING(unit) WHERE unit IN(?)", 
		[arrUnits], 
		function(rows){
			rows.forEach(function(row){
				var step = (row.sequence === 'good') ? 'done' : 'doublespend';
				db.query("UPDATE user_verification_process SET status=? WHERE id=?", [step, row.id]);
				device.sendMessageToDevice(
					row.deviceAddress, 'text', 
					(step === 'done') 
						? "Payment confirmed.  Now I am atesting you" 
						: "Your payment appeared to be double-spend.  The order will not be fulfilled"
				);
				// TODO: push tx with email address and byteball address
			});
		}
	);
});





