
var db = require('byteballcore/db.js')
var eventBus = require('byteballcore/event_bus.js');
var device = require('byteballcore/device.js');
var walletDefinedByKeys = require('byteballcore/wallet_defined_by_keys.js');
var conf = require('./conf.js');
require("byteballcore/wallet.js");
var headlessWallet = require("headless-byteball");
var mail = require('byteballcore/mail.js');
var wallet;
var stateAtest = {
	email: false,
	payment: false
}

// Sending message to mail
function sendMessageToUser(to, code){
	mail.sendmail({
		to: to,
		from: "edrygha@gmail.com",
		subject: "Verification",
		body: "It is your verification code "+ code
	});
}

// This function check verification status of object, return true if object is verificated
function verificationState(object){
	for (key in object){
		if(object[key] == false)
			return false;
	}
	return true;
}

// Gen code between min and max integers
function genVerifyCode(min, max){
	var rand = min + Math.random() * (max + 1 - min);
    return Math.floor(rand);
}

// Insert new record in table
function CreateNewNote(device_address, callback){
	db.query("INSERT INTO VerificationCode (deviceAddress) VALUES (?)", [device_address], function() {
		if (callback) callback();
	})
}

//Update anything row in table
function updateNote(object, device_address, callback){
	db.query(`UPDATE VerificationCode SET verifyCode = ?, address = ?, amount = ?, email = ?, status = ? WHERE deviceAddress = ?`, [object.verifyCode, object.address, object.amount, object.email, object.status, device_address], function(){
		if(callback) callback();
	})
}

function returnStatusByDevice(device_address, callback){
	db.query("SELECT * FROM VerificationCode WHERE deviceAddress = ?", [device_address], function(rows){
		if (rows.length === 0)
			throw Error('no current object');
		var result = rows[0];
		if(callback) callback(result);
	})
}

function cancelState(device_address){
	db.query("UPDATE VerificationCode SET cancelDate="+db.getNow()+" WHERE deviceAddress=?", [device_address]);
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

// Pairing bot with user, Welcome text
eventBus.on('paired', function(from_address){
	if (!wallet)
		return handleNoWallet(from_address);
	CreateNewNote(from_address, function(){
		device.sendMessageToDevice(from_address, 'text', "Hi! I am Atestation Bot, I will atestate you.\t Please send me your current email address")
	})
})

var verifCode;

// Get user's byteball address
eventBus.on('text', function (from_address, text){
	var usersText = text;
	
	returnStatusByDevice(from_address, function(result){
		switch(result.status){
			case 'unverified':
				verifCode = genVerifyCode(99999, 999999);
				// Sending message with validation code 
				//sendMessageToUser(usersText, verifCode);//TODO: Fix sendmail(config)
				console.log("looooooooooooooooooooooooooooooo " + verifCode);
				result.status = 'wait for verification code';
				result.email = usersText;
				updateNote(result, from_address);
				device.sendMessageToDevice(from_address, 'text', "Message sending to your email address. \nInput your confirmation code here")
				break;
			case 'wait for verification code':
				if(verifCode == usersText){
					result.status = 'Success code verification';
					result.verifyCode = usersText;
					updateNote(result, from_address);
					device.sendMessageToDevice(from_address, 'text', "Confirmation code is valid, to continue atestation input your current byteball address")
				} else{
					result.status = 'unverified';
					updateNote(result, from_address);
					device.sendMessageToDevice(from_address, 'text', "It is invalid confirmation code, please try again")
				}
				break;
			case 'Success code verification':
				walletDefinedByKeys.issueNextAddress(wallet, 0, function(objAddress){
					result.address = objAddress.address;
					result.status = 'Wait for payment';
					updateNote(result, from_address);
					device.sendMessageToDevice(from_address, 'text', "I am memorize your byteball address "+usersText+" .\tPlease pay to continue atestation.\n["+conf.price+" bytes](byteball:"+objAddress.address+"?amount="+conf.price+")");//cost of assets 1 bytes
				});
				break;
			case 'Wait for payment':
				//TODO: add ability to cancel order
				device.sendMessageToDevice(from_address, 'text', "Waiting for your payment.\t End of algoritm, comming soon");
				break;
		}
	})
})

//Wait for confirming TX
eventBus.on('new_my_transactions', function(arrUnits){
	// react to receipt of payment(s)
	console.log("qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq " + arrUnits);
});






