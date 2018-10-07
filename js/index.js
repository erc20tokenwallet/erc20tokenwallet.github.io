var account;
var contract;

const CONTRACT_STRING = '0x278194af0f8DcAaa16660Df9a94DF5689d7b1344';

$(document).ready(init);

function init() {
  $('#blockexplorer').attr('href', 'https://etherscan.io/token/' + CONTRACT_STRING);
  var metaMaskChecker = setInterval(function() {
    if (typeof web3 == 'undefined') {
      var dlLink = '';
      switch(getBrowser()) {
        case 'Chrome':
          dlLink = 'https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn?hl=en';
          break;
        case 'Firefox':
          dlLink = 'https://addons.mozilla.org/en-US/firefox/addon/ether-metamask/';
          break;
        case 'Opera':
          dlLink = 'https://addons.opera.com/en/extensions/details/metamask/';
          break;
      }
      $('#dl-mm').attr('href', dlLink);
      if (dlLink == '')
        switchPage('wrong-browser');
      else
        switchPage('no-metamask');
    } else if (web3.eth.accounts.length == 0)
      switchPage('not-logged-in');
    else
      switchPage('wallet');
  },500);
  web3.version.getNetwork(function(err, netId) {
    switch (netId) {
      case '1':
        console.log('mainnet');
        break;
      case '2':
        console.log('deprecated Morden testnet');
        break;
      case '3':
        console.log('ropsten testnet');
        break;
      case '4':
        console.log('Rinkeby testnet');
        break;
      case '42':
        console.log('Kovan testnet');
        break;
      default:
        console.log('unknown network');
    }
  });
  getMetaMask();
}

function getMetaMask() {
  getAcc(function(acc) {
    account = acc;
  });
  getABI(function(abi) {
    contract = getContract(abi,CONTRACT_STRING);
  });
  var checker = setInterval(function() {
    if (typeof contract != 'undefined') {
      if (typeof account != 'undefined') {
        $('#wallet').show();
        startApp(account);
        clearInterval(checker);
      }
    }
  }, 100);
}

function processBlocks(blockNumberStart, blockNumberEnd) {
  for (var i = blockNumberStart; i <= blockNumberEnd; i++) {
    web3.eth.getBlock(i, true, function(err, block) {
      if (block != null && block.transactions != null) {
        block.transactions.forEach( function(tx) {
          if (account == "*" || account == tx.from || account == tx.to) {
            addTx(block, tx);
          }
        })
      }
    });
  }
}

function startApp(account) {
  $('#send').click(function() {
    sendTokens($('#txAddress').val(), $('#txAmount').val());
  });
  console.log('account public address: '+account);
  console.log('Locke contract address: '+CONTRACT_STRING);
  setBalance();
  setInterval(setBalance, 5000);

  var lastProcessedBlockNumber;

  web3.eth.getBlockNumber(function(err, blockNumber) {
    processBlocks(blockNumber - 500, blockNumber);

    lastProcessedBlockNumber = blockNumber;

    setInterval(function(){
      web3.eth.getBlockNumber(function(err, blockNumber) {
        if (blockNumber > lastProcessedBlockNumber) {
          processBlocks(lastProcessedBlockNumber + 1, blockNumber);
          lastProcessedBlockNumber = blockNumber;
        }
      });
    }, 2000);
  });

  $('#eth-address').html(account);
  $('#qr-address').attr('src', 'https://chart.googleapis.com/chart?cht=qr&chl=' + account + '&chs=235x235&chld=L|0')
}

function sendTokens(to,amount) {
  contract.transfer(to,amount*1000, function(err, res) {
    var txChecker = setInterval(function() {
      web3.eth.getTransactionReceipt(String(res), function(e,r) {
        setBalance();
        if (r)
          clearInterval(txChecker);
      });
    },100)
  });
}

function setBalance() {
  getBalance(account, function(b) {
    $('#balance').html(l(b));
  })
}

function addTx(block, tx) {
  var ref = 'https://etherscan.io/tx/' + tx.hash;

  var message = '';
  if (tx.to == account) {
    message += '<a href="'+ref+'" class="list-group-item"><div class="tx"><p><b>From:</b> '+tx.from+'</p>';
  } else {
    message += '<a href="'+ref+'" class="list-group-item"><div class="tx"><p><b>To:</b> '+tx.to+'</p>';
  }
  message += '<p>'+web3.fromWei(web3.toDecimal(tx.value))+'</p>';
  message += '<p class="date">' + date(block.timestamp * 1000) + '</p>';
  message += '</div></a>';
  $('#txList').append(message);
}

function no0s(add) {
  a = add.replace('0x', '');
  while(!web3.isAddress('0x'+a)) {
    a = a.substr(1);
    if (add.length == 0)
      return null;
  }
  return '0x'+a;
}

function date(unix) {
  var d = new Date(unix);
  return d.getMonth()+'/'+d.getDate()+'/'+d.getFullYear()+', '+d.getHours()+':'+d.getMinutes()+':'+d.getSeconds();
}

function getBalance(acc, callback) {
  contract.balanceOf(acc, function(err, res) {
    callback(res.c[0]);
  });
}

function getContract(abi, add) {
  return web3.eth.contract(abi).at(add);
}

function getABI(callback) {
  $.getJSON('/abi.json', callback);
}

function getAcc(callback) {
  var accInt = setInterval(function() {
    var acc = web3.eth.accounts[0];
    if (acc) {
      callback(acc);
      clearInterval(accInt);
    }
  }, 100);
}

function switchPage(id) {
  $('#wallet').hide();
  $('#no-metamask').hide();
  $('#not-logged-in').hide();
  $('#wrong-browser').hide();
  $('#'+id).show();
}

function getBrowser() {
  if (typeof InstallTrigger !== 'undefined')
    return 'Firefox';
  if ((!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0)
    return 'Opera';
  if (/constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || (typeof safari !== 'undefined' && safari.pushNotification)))
    return 'Safari';
  if (/*@cc_on!@*/false || !!document.documentMode)
    return 'Internet Explorer'
  if (!(/*@cc_on!@*/false || !!document.documentMode) && !!window.StyleMedia)
    return 'Edge';
  if (!!window.chrome && !!window.chrome.webstore)
    return 'Chrome';
  return '';
}

function l(inp) {
  return commas(inp/1000);
}

function commas(inp) {
  return String(inp).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}
