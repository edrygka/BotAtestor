
var db = require('byteballcore/db.js')
var eventBus = require('byteballcore/event_bus.js');
var device = require('byteballcore/device.js');
var walletDefinedByKeys = require('byteballcore/wallet_defined_by_keys.js');
require("byteballcore/wallet.js");
var headlessWallet = require("headless-byteball");
var wallet;
var stateAtest = {
	email: false,
	payment: false
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
function CreateNewNote(byteball_address, callback){
	db.query("INSERT INTO VerificationCode (Address) VALUES (?)", [byteball_address], function() {
		if (callback) callback();
	})
}

//Update anything row in table
function updateNote(row, byteball_address, object, callback){
	db.query(`UPDATE VerificationCode SET ${row} = ? WHERE Address = ?`, [object, byteball_address], function(){
		if(callback) callback();
	})
}

function selectRecordByAddress(byteball_address, callback){
	db.query("SELECT status FROM VerificationCode WHERE address = ?", [byteball_address], function(err, result){
		if(callback) callback(result);
	})
}

eventBus.on('headless_wallet_ready', function(){
	headlessWallet.setupChatEventHandlers();
	headlessWallet.readSingleWallet(function(_wallet){
		wallet = _wallet;
	});
});

// First text
eventBus.on('paired', function(from_address){
	if (!wallet)
		return handleNoWallet(from_address);
	device.sendMessageToDevice(from_address, 'text', "Hi! I am Atestation Bot, I will atestate you.\t Please send me your current email address")
})

var addressOfUser;

// Get user's byteball address
eventBus.on('text', function (from_address, text){
	addressOfUser = text;//current user's byteball address
	//TODO: validation byteball address
	CreateNewNote(addressOfUser, function(){
		
		// selectRecordByAddress(addressOfUser, function (result){
		// 	device.sendMessageToDevice(from_address, 'text', "result = " + result)
		// })
	})
	if(addressOfUser){
		walletDefinedByKeys.issueNextAddress(wallet, 0, function(objAddress){
			var byteball_address = objAddress.address;
			device.sendMessageToDevice(from_address, 'text', "I am memorize your byteball address "+addressOfUser+" .\tPlease pay to continue atestation.\n[1000 bytes](byteball:"+byteball_address+"?amount=1000)");//cost of assets 1000 bytes
			// TODO: await confirmation, canceled payment, double spent, unconfirmed payment, done 
		});
	}
})

//Wait for confirming TX
eventBus.on('new_my_transactions', function(arrUnits){
	// react to receipt of payment(s)
	
});






