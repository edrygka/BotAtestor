
var db = require('byteballcore/db.js')
var eventBus = require('byteballcore/event_bus.js');
var device = require('byteballcore/device.js');
var walletDefinedByKeys = require('byteballcore/wallet_defined_by_keys.js');
//var mysql = require('mysql');
require("byteballcore/wallet.js");
var headlessWallet = require("headless-byteball");
var wallet;
var stateAtest = {
	payment: false,
	verified: false
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

// Insert object with param 'Code'
function insertItemIntoTable(row, object, callback){
	db.query(`INSERT INTO VerificationCode (${row}) VALUES (?)`, [object], function (err, result) {
		if (err) throw  err;
		if (callback) callback()
	})
}

function updateItemIntoTable(id ,row, object, callback){
	db.query(`UPDATE VerificationCode SET ${row} = ? WHERE Id = ?`, [object, id], function (err, result){
		if (err) throw err;
		if(callback) callback(result)
	})
}

eventBus.on('headless_wallet_ready', function(){
	headlessWallet.setupChatEventHandlers();
	headlessWallet.readSingleWallet(function(_wallet){
		wallet = _wallet;
		//bHeadlessWalletReady = true;
	});
});

// First text
eventBus.on('paired', function(from_address){
	if (!wallet)
		return handleNoWallet(from_address);
	device.sendMessageToDevice(from_address, 'text', "Hi! I am Atestation Bot, I will atestate you.\t Please send me your current byteball address")
})

eventBus.on('text', function (from_address, text){
	var addressOfUser = text;
	insertItemIntoTable("Address", addressOfUser, function(result){
		device.sendMessageToDevice(from_address, 'text', result)
	})
	if(addressOfUser){
		walletDefinedByKeys.issueNextAddress(wallet, 0, function(objAddress){
			var byteball_address = objAddress.address;
			device.sendMessageToDevice(from_address, 'text', "I am memorize your byteball address "+addressOfUser+" .\tPlease pay to continue atestation.\n[1000 bytes](byteball:"+byteball_address+"?amount=1000)");//cost of assets 1000 bytes
			// TODO: await confirmation, canceled payment, double spent, unconfirmed payment, done 
		});
	}
})






